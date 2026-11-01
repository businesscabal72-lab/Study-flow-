import "server-only";
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from "@google/genai";
import { AIProviderError, type AIProvider, type AIRequest } from "./provider";

const SAFETY = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE }));

function mapError(e: unknown): AIProviderError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|401|403/i.test(msg))
    return new AIProviderError("The AI service rejected the server's API key. The site owner needs to check GEMINI_API_KEY.", 503);
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(msg)) return new AIProviderError("The AI service is busy or out of quota right now. Please try again in a minute.", 429);
  if (/not found|404/i.test(msg)) return new AIProviderError("The configured AI model isn't available. The site owner should check GEMINI_MODEL.", 503);
  if (/timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg)) return new AIProviderError("Couldn't reach the AI service. Please try again.", 504);
  return new AIProviderError("The AI service returned an error. Please try again.", 502);
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private client: GoogleGenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  private params(req: AIRequest) {
    return {
      model: this.model,
      contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      config: {
        systemInstruction: req.system,
        temperature: req.temperature ?? 0.6,
        maxOutputTokens: req.maxOutputTokens ?? 2048,
        safetySettings: SAFETY,
        ...(req.json ? { responseMimeType: "application/json" } : {}),
      },
    };
  }

  async generate(req: AIRequest): Promise<string> {
    let res;
    try {
      res = await this.client.models.generateContent(this.params(req));
    } catch (e) {
      throw mapError(e);
    }
    if (res.promptFeedback?.blockReason) throw new AIProviderError("That request can't be answered here. Try rephrasing it as a study question.", 422);
    const text = res.text;
    if (!text) throw new AIProviderError("The AI returned an empty response. Try rephrasing your request.", 502);
    return text;
  }

  async *stream(req: AIRequest): AsyncIterable<string> {
    let stream;
    try {
      stream = await this.client.models.generateContentStream(this.params(req));
    } catch (e) {
      throw mapError(e);
    }
    let any = false;
    try {
      for await (const chunk of stream) {
        if (chunk.promptFeedback?.blockReason) throw new AIProviderError("That request can't be answered here. Try rephrasing it as a study question.", 422);
        const t = chunk.text;
        if (t) {
          any = true;
          yield t;
        }
      }
    } catch (e) {
      throw e instanceof AIProviderError ? e : mapError(e);
    }
    if (!any) throw new AIProviderError("The AI returned an empty response. Try rephrasing your request.", 502);
  }
}
