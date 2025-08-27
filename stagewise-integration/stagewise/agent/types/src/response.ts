import type { CoreAssistantMessage, CoreToolMessage } from 'ai';

import type { LanguageModelResponseMetadata } from 'ai';

export type ResponseMessage = (CoreAssistantMessage | CoreToolMessage) & {
  id: string;
};

// Type that represents what we actually get from tRPC (with serialized dates)
export type Response = LanguageModelResponseMetadata & {
  messages: Array<ResponseMessage>;
};
