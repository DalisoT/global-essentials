/**
 * Tiny markdown renderer for the Learning Academy.
 *
 * Server-component-compatible (no client hooks, no `useEffect`). Renders
 * a subset of CommonMark that's enough for the seeded lessons:
 *
 *   - Headings:    #, ##, ###
 *   - Paragraphs:  separated by blank lines
 *   - Lists:       - item, 1. item
 *   - Quotes:      > text
 *   - Code spans:  `inline code`
 *   - Bold/italic: **bold**, *italic*
 *   - Links:       [text](url)
 *
 * We don't support fenced code blocks, tables, images, or HTML — the
 * seeded lessons don't need them, and bringing in `marked` or
 * `react-markdown` for 14 lessons is overkill.
 *
 * Sanitization:
 *   - Output is plain React elements, never innerHTML. XSS-safe by
 *     construction (no `dangerouslySetInnerHTML`).
 *   - The href on links is restricted to http(s), mailto, tel, and
 *     internal routes starting with / or app://. Anything else is
 *     dropped (the link still renders as text).
 */

import type { ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────────────
// Public entry
// ─────────────────────────────────────────────────────────────────────

export function Markdown({ source }: { source: string }): ReactNode {
  // Split on blank lines into block-level chunks. Each chunk is
  // parsed separately.
  const blocks = source.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return <div className="prose-tactical space-y-4">{blocks.map((b, i) => renderBlock(b, i))}</div>;
}

// ─────────────────────────────────────────────────────────────────────
// Block parsing
// ─────────────────────────────────────────────────────────────────────

function renderBlock(block: string, key: number): ReactNode {
  // Headings (use [\s\S] instead of the /s flag for max target compat)
  const h3 = block.match(/^###\s+([\s\S]*)$/);
  if (h3) return <h3 key={key} className="text-base font-black mt-6">{renderInline(h3[1])}</h3>;
  const h2 = block.match(/^##\s+([\s\S]*)$/);
  if (h2) return <h2 key={key} className="text-lg font-black mt-6">{renderInline(h2[1])}</h2>;
  const h1 = block.match(/^#\s+([\s\S]*)$/);
  if (h1) return <h1 key={key} className="text-2xl font-black mt-4">{renderInline(h1[1])}</h1>;

  // Blockquote
  if (block.startsWith('>')) {
    const lines = block.split('\n').map((l) => l.replace(/^>\s?/, ''));
    return (
      <blockquote
        key={key}
        className="border-l-4 border-tactical-blue/50 pl-4 py-1 my-2 text-white/70 italic"
      >
        {lines.map((l, i) => <p key={i} className={i > 0 ? 'mt-1' : ''}>{renderInline(l)}</p>)}
      </blockquote>
    );
  }

  // Unordered list
  if (/^(\s*[-*]\s+)/m.test(block)) {
    const items = block.split('\n').filter((l) => /^\s*[-*]\s+/.test(l));
    return (
      <ul key={key} className="list-disc pl-6 space-y-1.5 marker:text-white/40">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it.replace(/^\s*[-*]\s+/, ''))}</li>
        ))}
      </ul>
    );
  }

  // Ordered list
  if (/^\s*\d+\.\s+/m.test(block)) {
    const items = block.split('\n').filter((l) => /^\s*\d+\.\s+/.test(l));
    return (
      <ol key={key} className="list-decimal pl-6 space-y-1.5 marker:text-white/40 marker:font-bold">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it.replace(/^\s*\d+\.\s+/, ''))}</li>
        ))}
      </ol>
    );
  }

  // Code block (fenced with ```)
  if (block.startsWith('```')) {
    const inner = block.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim();
    return (
      <pre key={key} className="bg-black/60 border border-white/10 rounded-lg p-3 my-2 overflow-x-auto">
        <code className="text-xs font-mono text-tactical-neon whitespace-pre">{inner}</code>
      </pre>
    );
  }

  // Default: paragraph
  return <p key={key} className="leading-relaxed">{renderInline(block)}</p>;
}

// ─────────────────────────────────────────────────────────────────────
// Inline parsing
// ─────────────────────────────────────────────────────────────────────

/**
 * Render a single line / paragraph's worth of inline markdown. We
 * walk the string in order, splitting out code spans, links, and
 * bold/italic runs. Each non-matched chunk is a plain text run.
 *
 * The trick: we use a single regex with alternation and a single
 * pass. The matched group determines the kind; the unmatched parts
 * are plain text. We preserve the order by walking character-by-character
 * via split with capture groups.
 */
function renderInline(text: string): ReactNode[] {
  // Order matters: code spans first (so we don't process markdown
  // inside them), then links, then bold, then italic.
  // We split on a regex that captures the markdown tokens.
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      // Code span
      parts.push(
        <code key={key++} className="bg-black/50 px-1.5 py-0.5 rounded text-tactical-neon text-[0.9em] font-mono">
          {match[1].slice(1, -1)}
        </code>
      );
    } else if (match[2]) {
      // Link
      const linkMatch = match[2].match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label, rawHref] = linkMatch;
        const safeHref = safeHrefFor(rawHref);
        if (safeHref) {
          const isExternal = /^https?:\/\//i.test(safeHref);
          parts.push(
            <a
              key={key++}
              href={safeHref}
              className="text-tactical-blue underline underline-offset-2 hover:text-tactical-neon transition-colors"
              {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {label}
            </a>
          );
        } else {
          // Unsafe href — render the label as plain text.
          parts.push(label);
        }
      }
    } else if (match[3]) {
      // Bold
      parts.push(<strong key={key++} className="font-black text-white">{match[3].slice(2, -2)}</strong>);
    } else if (match[4]) {
      // Italic
      parts.push(<em key={key++} className="italic text-white/80">{match[4].slice(1, -1)}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Allow only safe URL schemes. Returns the input unchanged if safe;
 * returns null otherwise (and the caller renders the link label as
 * plain text).
 */
function safeHrefFor(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed) return null;
  // Internal routes
  if (trimmed.startsWith('/')) return trimmed;
  if (trimmed.startsWith('app://')) return trimmed;
  // Allow-listed external schemes
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^mailto:/i.test(trimmed)) return trimmed;
  if (/^tel:/i.test(trimmed)) return trimmed;
  // Anything else (javascript:, data:, etc.) is dropped.
  return null;
}
