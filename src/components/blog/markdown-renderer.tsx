"use client";

import { Paperclip } from "lucide-react";

// ── Inline parser ─────────────────────────────────────────────────────────────
// Processes: images, links, bold, italic, inline code within a text segment.

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Combined regex: image | link | bold | italic | code
  const re = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));

    if (match[1] !== undefined) {
      // Image: ![alt](url)
      nodes.push(
        <img
          key={match.index}
          src={match[2]}
          alt={match[1]}
          className="max-w-full rounded-lg my-2 border border-border"
          loading="lazy"
        />
      );
    } else if (match[3] !== undefined) {
      // Link: [text](url)
      const isFile = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|csv|txt)(\?|$)/i.test(match[4]) ||
        match[4].includes("drive.google.com/file");
      nodes.push(
        isFile ? (
          <a
            key={match.index}
            href={match[4]}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-sm text-foreground hover:bg-surface hover:border-primary transition-colors"
          >
            <Paperclip className="w-3.5 h-3.5 text-muted shrink-0" />
            {match[3]}
          </a>
        ) : (
          <a
            key={match.index}
            href={match[4]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {match[3]}
          </a>
        )
      );
    } else if (match[5] !== undefined) {
      nodes.push(<strong key={match.index} className="font-semibold text-foreground">{match[5]}</strong>);
    } else if (match[6] !== undefined) {
      nodes.push(<em key={match.index} className="italic">{match[6]}</em>);
    } else if (match[7] !== undefined) {
      nodes.push(<code key={match.index} className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-xs font-mono">{match[7]}</code>);
    }

    last = match.index + match[0].length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

// ── Block renderer ────────────────────────────────────────────────────────────

function renderBlock(block: string, idx: number): React.ReactNode {
  const lines = block.split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  // Heading
  const headMatch = lines[0].match(/^(#{1,4})\s+(.+)/);
  if (headMatch) {
    const level = headMatch[1].length;
    const text = headMatch[2];
    const inline = parseInline(text);
    if (level === 1) return <h1 key={idx} className="text-2xl font-bold text-foreground mt-6 mb-2">{inline}</h1>;
    if (level === 2) return <h2 key={idx} className="text-xl font-bold text-foreground mt-5 mb-2">{inline}</h2>;
    if (level === 3) return <h3 key={idx} className="text-lg font-semibold text-foreground mt-4 mb-1">{inline}</h3>;
    return <h4 key={idx} className="text-base font-semibold text-foreground mt-3 mb-1">{inline}</h4>;
  }

  // Horizontal rule
  if (/^---+$/.test(lines[0].trim())) {
    return <hr key={idx} className="border-border my-4" />;
  }

  // Blockquote
  if (lines[0].startsWith("> ")) {
    return (
      <blockquote key={idx} className="border-l-4 border-primary/40 pl-4 py-1 my-2 text-muted italic">
        {lines.map((l, i) => <p key={i}>{parseInline(l.replace(/^>\s?/, ""))}</p>)}
      </blockquote>
    );
  }

  // Unordered list
  if (/^[-*+]\s/.test(lines[0])) {
    return (
      <ul key={idx} className="list-disc list-inside space-y-1 my-2 text-foreground text-sm">
        {lines.map((l, i) => (
          <li key={i}>{parseInline(l.replace(/^[-*+]\s/, ""))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list
  if (/^\d+\.\s/.test(lines[0])) {
    return (
      <ol key={idx} className="list-decimal list-inside space-y-1 my-2 text-foreground text-sm">
        {lines.map((l, i) => (
          <li key={i}>{parseInline(l.replace(/^\d+\.\s/, ""))}</li>
        ))}
      </ol>
    );
  }

  // Code block
  if (lines[0].startsWith("```")) {
    const code = lines.slice(1, lines[lines.length - 1] === "```" ? -1 : undefined).join("\n");
    return (
      <pre key={idx} className="bg-surface-2 border border-border rounded-lg p-3 my-3 overflow-x-auto text-xs font-mono text-foreground">
        <code>{code}</code>
      </pre>
    );
  }

  // Standalone image line
  if (lines.length === 1) {
    const imgMatch = lines[0].match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      return (
        <img key={idx} src={imgMatch[2]} alt={imgMatch[1]}
          className="max-w-full rounded-lg my-3 border border-border"
          loading="lazy"
        />
      );
    }
  }

  // Paragraph
  return (
    <p key={idx} className="text-sm text-foreground leading-relaxed">
      {lines.flatMap((line, i) => [
        ...parseInline(line),
        i < lines.length - 1 ? <br key={`br-${i}`} /> : null,
      ]).filter(Boolean)}
    </p>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function MarkdownRenderer({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => renderBlock(block.trim(), i))}
    </div>
  );
}
