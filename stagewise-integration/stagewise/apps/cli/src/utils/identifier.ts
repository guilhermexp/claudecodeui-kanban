import { randomUUID } from 'node:crypto';
import { readDataFile, writeDataFile } from './config-path';

export interface MachineIdentifier {
  id: string;
  createdAt: string;
}

const IDENTIFIER_FILE = 'identifier.json';

export class IdentifierManager {
  private static instance: IdentifierManager;
  private identifier: MachineIdentifier | null = null;

  private constructor() {}

  static getInstance(): IdentifierManager {
    if (!IdentifierManager.instance) {
      IdentifierManager.instance = new IdentifierManager();
    }
    return IdentifierManager.instance;
  }

  async getMachineId(): Promise<string> {
    if (!this.identifier) {
      await this.loadOrCreateIdentifier();
    }
    return this.identifier!.id;
  }

  async getIdentifier(): Promise<MachineIdentifier> {
    if (!this.identifier) {
      await this.loadOrCreateIdentifier();
    }
    return this.identifier!;
  }

  private async loadOrCreateIdentifier(): Promise<void> {
    const existingIdentifier =
      await readDataFile<MachineIdentifier>(IDENTIFIER_FILE);

    if (existingIdentifier && this.isValidIdentifier(existingIdentifier)) {
      this.identifier = existingIdentifier;
    } else {
      // Create new identifier
      this.identifier = {
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      };

      // Save to file
      await writeDataFile(IDENTIFIER_FILE, this.identifier);
    }
  }

  private isValidIdentifier(
    identifier: unknown,
  ): identifier is MachineIdentifier {
    return (
      typeof identifier === 'object' &&
      identifier !== null &&
      'id' in identifier &&
      'createdAt' in identifier &&
      typeof (identifier as any).id === 'string' &&
      typeof (identifier as any).createdAt === 'string'
    );
  }
}

export const identifierManager = IdentifierManager.getInstance();
