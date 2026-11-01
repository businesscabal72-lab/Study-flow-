import "server-only";
import { AINotConfiguredError, type AIProvider } from "./provider";
import { GeminiProvider } from "./gemini";

let cached: AIProvider | null = null;

/**
 * Returns the configured provider or throws AINotConfiguredError.
 * Keys are read server-side only and never sent to the browser.
 */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  switch (provider) {
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new AINotConfiguredError();
      cached = new GeminiProvider(key, process.env.GEMINI_MODEL || "gemini-2.5-flash");
      return cached;
    }
    default:
      throw new AINotConfiguredError(`Unknown AI_PROVIDER "${provider}".`);
  }
}

export const isAIConfigured = () => {
  try {
    getAIProvider();
    return true;
  } catch {
    return false;
  }
};
