import * as React from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Minimal, safe Markdown renderer for AI output. Builds React elements
 * directly (no HTML injection). Supports headings, lists, numbered lists,
 * code blocks, inline code, bold, italic, blockquotes and paragraphs.
 */
export function Markdown({ text, className }: { text: string; className?: string }) {
  return <div className={cn("ai-prose text-sm", className)}>{parseBlocks(text)}</div>;
}

function parseBlocks(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(
        <pre key={key++} className="my-2 overflow-x-auto rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
          <code>{buf.join("\n")}</code>
        </pre>
      );
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2 ? "mt-4 mb-1.5 text-[15px] font-semibold" : "mt-3 mb-1 text-sm font-semibold";
      out.push(<p key={key++} className={cls}>{inline(h[2])}</p>);
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ""));
      out.push(<ul key={key++} className="my-1.5 list-disc space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out.push(<ol key={key++} className="my-1.5 list-decimal space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t)}</li>)}</ol>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""));
      out.push(<blockquote key={key++} className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{inline(buf.join(" "))}</blockquote>);
      continue;
    }
    if (line.trim() === "") {
      i++;
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|>)/.test(lines[i])) buf.push(lines[i++]);
    out.push(<p key={key++} className="my-1.5">{inline(buf.join(" "))}</p>);
  }
  return out;
}

function inline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`")) nodes.push(<code key={k++} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith("**") || t.startsWith("__")) nodes.push(<strong key={k++} className="font-semibold">{t.slice(2, -2)}</strong>);
    else nodes.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
