// Minimal markdown renderer for concierge responses. The generation prompt
// (packages/prompts/base.md) is never told to avoid markdown, and sonnet-5
// reliably produces **bold**, `- ` lists, and `|` tables (findings-log #45's
// live-verification run alone surfaced all three) — ConciergeMessage used to
// render that text as a raw string, so guests saw literal asterisks, dashes,
// and pipe characters. No markdown package exists anywhere in this monorepo
// yet, and the actual surface area seen in practice is small (bold, bullet
// lists, simple tables, paragraphs) — a small parser here is a contained fix,
// not grounds to newly depend on a full markdown engine.
import { Fragment, type ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes("-");
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

/** Renders the small, real subset of markdown concierge responses actually use. */
export function renderMarkdownLite(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Table: a header row, a separator row, then N body rows.
    if (isTableRow(line) && isTableSeparator(lines[i + 1] ?? "")) {
      const header = splitTableRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <table
          key={key++}
          style={{
            width: "100%",
            borderCollapse: "collapse",
            margin: "var(--space-2) 0",
            fontSize: "var(--type-sm)",
          }}
        >
          <thead>
            <tr>
              {header.map((cell, ci) => (
                <th
                  key={ci}
                  style={{
                    textAlign: "left",
                    borderBottom: "1px solid var(--neutral-300)",
                    padding: "var(--space-1) var(--space-2)",
                  }}
                >
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{
                      borderBottom: "1px solid var(--neutral-100)",
                      padding: "var(--space-1) var(--space-2)",
                    }}
                  >
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Bullet list: consecutive lines starting with "- " or "* ".
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} style={{ margin: "var(--space-2) 0", paddingLeft: "var(--space-5)" }}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Plain paragraph line.
    blocks.push(<p key={key++} style={{ margin: "0 0 var(--space-2) 0" }}>{renderInline(line)}</p>);
    i++;
  }

  return <>{blocks}</>;
}
