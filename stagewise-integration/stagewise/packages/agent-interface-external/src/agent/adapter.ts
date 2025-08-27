import type { TransportInterface } from '../router';
import type { AgentInterface } from './interface';
import {
  type AgentAvailability,
  AgentAvailabilityError,
} from '../router/capabilities/availability/types';
import {
  type AgentState,
  AgentStateType,
} from '../router/capabilities/state/types';
import type {
  AgentMessageContentItemPart,
  AgentMessageUpdate,
  UserMessage,
} from '../router/capabilities/messaging/types';
import type { AvailabilityImplementation } from '../router/capabilities/availability';
import type { MessagingImplementation } from '../router/capabilities/messaging';
import type { StateImplementation } from '../router/capabilities/state';

/**
 * Optional configuration for the AgentTransportAdapter.
 */
export interface AdapterOptions {
  toolCallTimeoutMs?: number;
  idGenerator?: () => string;
}

type RequiredAdapterOptions = Required<AdapterOptions>;

// --- PushController Implementation ---

/**
 * A controller for managing an AsyncIterable stream. It allows pushing new values
 * to all subscribers and ensures new subscribers immediately get the latest value.
 */
class PushController<T> {
  private latestValue: T | undefined;
  private subscribers: Set<(value: T) => void> = new Set();

  constructor(initialValue?: T) {
    this.latestValue = initialValue;
  }

  /**
   * Pushes a new value to all current subscribers and updates the latest value.
   * @param value The new value to push to the stream.
   */
  public push(value: T): void {
    this.latestValue = value;
    for (const subscriber of this.subscribers) {
      subscriber(value);
    }
  }

  /**
   * Retrieves the most recently pushed value.
   * @returns The latest value, or undefined if no value has been pushed.
   */
  public getLatestValue(): T | undefined {
    return this.latestValue;
  }

  /**
   * Creates and returns a new AsyncIterable for a consumer.
   * @returns An async iterable that will yield the latest value upon subscription,
   * and all subsequent values pushed to the controller.
   */
  public subscribe(): AsyncIterable<T> {
    const controller = this;
    let pullQueue: ((value: IteratorResult<T>) => void)[] = [];
    let pushQueue: T[] = [];
    let done = false;

    const pushValue = (value: T) => {
      if (pullQueue.length > 0) {
        pullQueue.shift()!({ value, done: false });
      } else {
        pushQueue.push(value);
      }
    };

    const listener = (value: T) => {
      if (!done) {
        pushValue(value);
      }
    };

    return {
      [Symbol.asyncIterator]: () => {
        // Immediately yield the latest value upon subscription.
        if (controller.getLatestValue() !== undefined) {
          pushValue(controller.getLatestValue()!);
        }
        controller.subscribers.add(listener);

        return {
          next: (): Promise<IteratorResult<T>> => {
            return new Promise((resolve) => {
              if (pushQueue.length > 0) {
                resolve({ value: pushQueue.shift()!, done: false });
              } else if (done) {
                resolve({ value: undefined, done: true });
              } else {
                pullQueue.push(resolve);
              }
            });
          },
          return: async (): Promise<IteratorResult<T>> => {
            done = true;
            controller.subscribers.delete(listener);
            pullQueue.forEach((resolve) =>
              resolve({ value: undefined, done: true }),
            );
            pullQueue = [];
            pushQueue = [];
            return { value: undefined, done: true };
          },
        };
      },
    };
  }
}

// --- Main AgentTransportAdapter Class ---

export class AgentTransportAdapter implements TransportInterface {
  // --- Public TransportInterface Implementation ---
  public readonly availability: AvailabilityImplementation;
  public readonly messaging: MessagingImplementation;
  public readonly state: StateImplementation;

  // --- Internal State Properties ---
  private _agentInterface: AgentInterface | null = null;
  private readonly _options: RequiredAdapterOptions;

  // State controllers
  private readonly _availabilityController: PushController<AgentAvailability>;
  private readonly _stateController: PushController<AgentState>;
  private readonly _messageController: PushController<AgentMessageUpdate>;

  // Internal state stores
  private _availability: AgentAvailability;
  private _state: AgentState;
  private _currentMessageId: string | null = null;
  private _messageContent: AgentMessageContentItemPart[] = [];
  private _userMessageListeners: Set<(message: UserMessage) => void> =
    new Set();

  constructor(options?: AdapterOptions) {
    // 1. Set default options
    this._options = {
      toolCallTimeoutMs: options?.toolCallTimeoutMs ?? 30000,
      idGenerator: options?.idGenerator ?? (() => crypto.randomUUID()),
    };

    // 2. Initialize state with defaults
    this._availability = {
      isAvailable: false,
      error: AgentAvailabilityError.NO_CONNECTION,
      errorMessage: 'Initializing',
    } as AgentAvailability;
    this._state = { state: AgentStateType.IDLE };

    // 3. Initialize controllers
    this._availabilityController = new PushController(this._availability);
    this._stateController = new PushController(this._state);
    this._messageController = new PushController(); // No initial value, sends resync on subscribe

    // 4. Define the public TransportInterface properties
    this.availability = this.createAvailabilityImplementation();
    this.state = this.createStateImplementation();
    this.messaging = this.createMessagingImplementation();

    // 5. Initialize controllers with default state
    this._availabilityController.push(this._availability);
    this._stateController.push(this._state);
  }

  /**
   * Retrieves the AgentInterface instance, which is the primary
   * entry point for an agent to interact with the adapter.
   */
  public getAgent(): AgentInterface {
    if (this._agentInterface) {
      return this._agentInterface;
    }

    // Memoize the interface to ensure stability
    this._agentInterface = this.createAgentInterface();
    return this._agentInterface;
  }

  // --- Private Helper Methods ---

  /**
   * Private method to clear the current message and generate a new ID.
   * This logic is shared between the public clear() method and addPart().
   */
  private _clearMessage(): void {
    this._currentMessageId = this._options.idGenerator();
    this._messageContent = [];

    const update: AgentMessageUpdate = {
      messageId: this._currentMessageId,
      updateParts: [],
      createdAt: new Date(),
      resync: true, // Signal to consumer to clear previous content
    };
    this._messageController.push(update);
  }

  // --- Interface Implementation Factories ---

  private createAgentInterface(): AgentInterface {
    const self = this; // Capture 'this' for use in nested objects

    return {
      availability: {
        get: () => JSON.parse(JSON.stringify(self._availability)),
        set: (available, ...args) => {
          let newAvailability: AgentAvailability;
          if (available) {
            newAvailability = { isAvailable: true };
          } else {
            const [error, errorMessage] = args;
            if (!error) {
              throw new Error(
                "An 'error' type is required when setting availability to false.",
              );
            }
            newAvailability = { isAvailable: false, error, errorMessage };
          }
          self._availability = newAvailability;
          self._availabilityController.push(self._availability);
        },
      },
      state: {
        get: () => JSON.parse(JSON.stringify(self._state)),
        set: (state, description) => {
          self._state = { state, description };
          self._stateController.push(self._state);
        },
      },
      messaging: {
        get: () => JSON.parse(JSON.stringify(self._messageContent)),
        getCurrentId: () => self._currentMessageId,
        getCurrentMessage: () => {
          // Return by value using deep copy
          return {
            id: self._currentMessageId,
            parts: JSON.parse(JSON.stringify(self._messageContent)),
          };
        },
        addUserMessageListener: (listener) => {
          self._userMessageListeners.add(listener);
        },
        removeUserMessageListener: (listener) => {
          self._userMessageListeners.delete(listener);
        },
        clearUserMessageListeners: () => {
          self._userMessageListeners.clear();
        },
        clear: () => {
          this._clearMessage();
        },
        set: (content) => {
          // Always create a new message ID when setting a new message
          self._currentMessageId = self._options.idGenerator();
          self._messageContent = JSON.parse(JSON.stringify(content));

          const update: AgentMessageUpdate = {
            messageId: self._currentMessageId,
            updateParts: self._messageContent.map((part, i) => ({
              contentIndex: i,
              part: part,
            })),
            createdAt: new Date(),
            resync: true,
          };
          self._messageController.push(update);
        },
        addPart: (content) => {
          if (!self._currentMessageId) {
            // Call the private clear method directly to avoid circular dependency
            self._clearMessage();
          }

          const partsToAdd = Array.isArray(content) ? content : [content];
          for (const part of partsToAdd) {
            const contentIndex = self._messageContent.length;
            self._messageContent.push(part);

            const update: AgentMessageUpdate = {
              messageId: self._currentMessageId!,
              updateParts: [{ contentIndex, part }],
              createdAt: new Date(),
              resync: false,
            };
            self._messageController.push(update);
          }
        },
        updatePart: (content, index, type) => {
          // Allow adding a new part if index is exactly highest + 1
          if (index === self._messageContent.length) {
            // If no message ID exists yet, create one
            if (!self._currentMessageId) {
              self._clearMessage();
            }

            // Handle union type - if content is an array, only take the first element
            const contentPart = Array.isArray(content) ? content[0] : content;
            if (!contentPart) {
              throw new Error('Content cannot be empty');
            }

            // Add the new part
            self._messageContent.push(contentPart);

            const update: AgentMessageUpdate = {
              messageId: self._currentMessageId!,
              updateParts: [{ contentIndex: index, part: contentPart }],
              createdAt: new Date(),
              resync: type === 'replace',
            };
            self._messageController.push(update);
            return;
          }

          if (index < 0 || index >= self._messageContent.length) {
            throw new Error(
              `Invalid index ${index} for message content update.`,
            );
          }

          // Handle union type - if content is an array, only take the first element
          const contentPart = Array.isArray(content) ? content[0] : content;
          if (!contentPart) {
            throw new Error('Content cannot be empty');
          }

          if (type === 'replace') {
            self._messageContent[index] = contentPart;
            const update: AgentMessageUpdate = {
              messageId: self._currentMessageId!,
              updateParts: [{ contentIndex: index, part: contentPart }],
              createdAt: new Date(),
              resync: true,
            };
            self._messageController.push(update);
          } else if (type === 'append') {
            const existingPart = self._messageContent[index];
            if (existingPart.type !== 'text' || contentPart.type !== 'text') {
              throw new Error(
                'Append update is only valid for text-to-text parts.',
              );
            }
            existingPart.text += contentPart.text;
            const update: AgentMessageUpdate = {
              messageId: self._currentMessageId!,
              updateParts: [{ contentIndex: index, part: contentPart }],
              createdAt: new Date(),
              resync: false,
            };
            self._messageController.push(update);
          }
        },
      },
      cleanup: {
        clearAllListeners: () => {
          self._userMessageListeners.clear();
        },
      },
    };
  }

  private createAvailabilityImplementation(): AvailabilityImplementation {
    return {
      getAvailability: () => this._availabilityController.subscribe(),
    };
  }

  private createStateImplementation(): StateImplementation {
    return {
      getState: () => this._stateController.subscribe(),
    };
  }

  private createMessagingImplementation(): MessagingImplementation {
    const self = this;
    return {
      onUserMessage: (message) => {
        // In a real implementation, you would use the imported zod schema
        // const validation = userMessageSchema.safeParse(message);
        // if (!validation.success) {
        //     console.error("Invalid UserMessage received:", validation.error);
        //     return;
        // }
        self._userMessageListeners.forEach((listener) => listener(message));
      },
      getMessage: () => {
        // This custom subscription logic handles the resync requirement
        const sub = self._messageController.subscribe();
        const originalIterator = sub[Symbol.asyncIterator]();

        return {
          [Symbol.asyncIterator]: () => {
            let nextCallResynced = false; // Per-iterator state

            return {
              next: async () => {
                // On the very first call to next(), perform a resync
                if (!nextCallResynced) {
                  nextCallResynced = true;
                  const resyncUpdate: AgentMessageUpdate = {
                    messageId:
                      self._currentMessageId ?? self._options.idGenerator(),
                    updateParts: self._messageContent.map((part, i) => ({
                      contentIndex: i,
                      part: part,
                    })),
                    createdAt: new Date(),
                    resync: true,
                  };
                  // If there's no messageId, create one but don't persist it yet
                  if (!self._currentMessageId) {
                    self._currentMessageId = resyncUpdate.messageId;
                  }
                  return { value: resyncUpdate, done: false };
                }
                return originalIterator.next();
              },
              return: () => {
                return originalIterator.return
                  ? originalIterator.return()
                  : Promise.resolve({ value: undefined, done: true });
              },
            };
          },
        };
      },
    };
  }
}
