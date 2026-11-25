/**
 * Minimal, safe Markdown → React renderer for chat replies (no HTML injection).
 * Supports paragraphs, headings (#–###), bullet & numbered lists, **bold**, *italic*,
 * `code`, [links](https://…), bare URLs, and line breaks.
 */
import React from "react";

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|tel:)[^)\s]+\)|https?:\/\/[^\s)]+|\b(?:[a-z0-9-]+\.)+(?:gov\.in|org\.in|co\.in|org|in|com)(?:\/[^\s)]*)?)/gi;

function inline(text: string, key: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of text.matchAll(INLINE)) {
    const tok = m[0];
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const k = `${key}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="md-code">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) out.push(<a key={k} href={mm[2]} target="_blank" rel="noopener noreferrer">{mm[1]}</a>);
    } else {
      const href = tok.startsWith("http") ? tok : `https://${tok}`;
      out.push(<a key={k} href={href} target="_blank" rel="noopener noreferrer">{tok}</a>);
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, b = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const key = `b${b++}`;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      blocks.push(<p key={key} className="md-h">{inline(h[2], key)}</p>);
      i++; continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && (/^\s*[-*•]\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        if (/^\s*[-*•]\s+/.test(lines[i])) items.push([lines[i].replace(/^\s*[-*•]\s+/, "")]);
        else (items[items.length - 1] as string[]).push(lines[i].trim());
        i++;
      }
      blocks.push(<ul key={key} className="md-ul">{(items as string[][]).map((it, j) =>
        <li key={j}>{it.map((seg, s) => <React.Fragment key={s}>{s > 0 && <br />}{inline(seg, `${key}-${j}-${s}`)}</React.Fragment>)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, "")); i++; }
      blocks.push(<ol key={key} className="md-ol">{items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)]|#{1,3})\s+/.test(lines[i])) { para.push(lines[i]); i++; }
    blocks.push(<p key={key}>{para.map((p, j) => <React.Fragment key={j}>{j > 0 && <br />}{inline(p, `${key}-${j}`)}</React.Fragment>)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
