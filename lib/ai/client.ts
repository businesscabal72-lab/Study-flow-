"use client";
/** Browser helpers for StudyFlow's AI API routes. Errors carry the server's message. */

export class AIRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function readError(res: Response): Promise<AIRequestError> {
  let msg = "The AI request failed. Please try again.";
  try {
    const body = await res.json();
    if (body?.error) msg = body.error;
  } catch {
    /* non-JSON error */
  }
  return new AIRequestError(msg, res.status);
}

export async function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AIRequestError("Can't reach StudyFlow. Check your connection.", 0);
  }
  if (!res.ok) throw await readError(res);
  return res.json() as Promise<T>;
}

/** POST and stream plain-text chunks; resolves with the full text. */
export async function postStream(
  path: string,
  body: unknown,
  onChunk: (full: string) => void,
  signal?: AbortSignal,
  onResponse?: (res: Response) => void
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new AIRequestError("Can't reach StudyFlow. Check your connection.", 0);
  }
  if (!res.ok || !res.body) throw await readError(res);
  onResponse?.(res);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    // Server signals a mid-stream failure with a sentinel line.
    const marker = full.indexOf("\n[[STUDYFLOW_ERROR]]");
    if (marker !== -1) {
      const msg = full.slice(marker + "\n[[STUDYFLOW_ERROR]]".length).trim() || "The AI response was interrupted.";
      onChunk(full.slice(0, marker));
      throw new AIRequestError(msg, 502);
    }
    onChunk(full);
  }
  return full;
}
