/**
 * Provider-agnostic AI interface. Swap providers by implementing this and
 * registering it in lib/ai/index.ts — routes never import a vendor SDK.
 */
export interface AIMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface AIRequest {
  system: string;
  messages: AIMessageInput[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Ask for a JSON response (provider should enforce JSON output). */
  json?: boolean;
}

export interface AIProvider {
  readonly name: string;
  generate(req: AIRequest): Promise<string>;
  stream(req: AIRequest): AsyncIterable<string>;
}

export class AINotConfiguredError extends Error {
  constructor(message = "AI isn't configured on this server yet. Ask the site owner to add an AI API key.") {
    super(message);
    this.name = "AINotConfiguredError";
  }
}

export class AIProviderError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
  }
}
