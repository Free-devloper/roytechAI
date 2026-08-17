"use client";

import { useMemo, type ReactNode } from "react";
import { lexer, type Token, type Tokens } from "marked";

type Props = {
  text: string;
};

const BOLD_LEAD = /^(?:\d+[.)]\s+)?\*\*[^*\n]+\*\*/;
const STEP_LABEL =
  /^(?:#{1,6}\s*)?(key steps|steps|how we (?:work|deliver)|our process|delivery (?:model|process)|the process)\s*:?\s*$/i;

function safeHref(href: string) {
  const value = href.trim();
  if (!value) return null;
  if (value.startsWith("#") || value.startsWith("/")) return value;
  try {
    const url = new URL(value, "https://www.roytechworkforce.com");
    if (url.protocol === "http:" || url.protocol === "https:" || url.protocol === "mailto:") return value;
  } catch {
    return null;
  }
  return null;
}

export function normalizeAssistantMarkdown(source: string) {
  const lines = source.replace(/\r\n/g, "\n").replace(/[\u2217\uFF0A\u204E]/g, "*").split("\n");
  const out: string[] = [];
  let index = 0;

  const peekNextContent = (from: number) => {
    let next = from;
    while (next < lines.length && !lines[next].trim()) next += 1;
    return next;
  };

  while (index < lines.length) {
    const trimmed = lines[index].trim();
    if (STEP_LABEL.test(trimmed)) {
      out.push(`### ${trimmed.replace(/^#{1,6}\s*/, "").replace(/:$/, "")}`);
      index = peekNextContent(index + 1);
      continue;
    }
    if (BOLD_LEAD.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length) {
        const current = lines[index].trim();
        if (!current) {
          const next = peekNextContent(index + 1);
          if (next < lines.length && BOLD_LEAD.test(lines[next].trim())) {
            index = next;
            continue;
          }
          break;
        }
        if (!BOLD_LEAD.test(current)) break;
        items.push(current.replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      if (items.length >= 2) {
        out.push(items.map((item, itemIndex) => `${itemIndex + 1}. ${item}`).join("\n"));
        continue;
      }
      out.push(items[0] ?? trimmed);
      continue;
    }
    out.push(lines[index]);
    index += 1;
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function Inline({ tokens }: { tokens?: Token[] }) {
  if (!tokens?.length) return null;
  return tokens.map((token, index) => <InlineToken key={`${token.type}-${index}`} token={token} />);
}

function InlineToken({ token }: { token: Token }) {
  switch (token.type) {
    case "text": {
      const text = token as Tokens.Text;
      return text.tokens?.length ? <Inline tokens={text.tokens} /> : <>{text.text}</>;
    }
    case "strong":
      return (
        <strong>
          <Inline tokens={(token as Tokens.Strong).tokens} />
        </strong>
      );
    case "em":
      return (
        <em>
          <Inline tokens={(token as Tokens.Em).tokens} />
        </em>
      );
    case "del":
      return (
        <del>
          <Inline tokens={(token as Tokens.Del).tokens} />
        </del>
      );
    case "codespan":
      return <code>{(token as Tokens.Codespan).text}</code>;
    case "br":
      return <br />;
    case "escape":
      return <>{(token as Tokens.Escape).text}</>;
    case "link": {
      const link = token as Tokens.Link;
      const href = safeHref(link.href);
      if (!href) return <Inline tokens={link.tokens} />;
      return (
        <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
          <Inline tokens={link.tokens} />
        </a>
      );
    }
    case "image":
      return <span>{(token as Tokens.Image).text}</span>;
    default:
      return "text" in token ? <>{String((token as { text?: string }).text ?? "")}</> : null;
  }
}

function ListBody({ tokens }: { tokens: Token[] }) {
  if (tokens.length === 1 && (tokens[0].type === "paragraph" || tokens[0].type === "text")) {
    const inner = tokens[0] as Tokens.Paragraph | Tokens.Text;
    return <Inline tokens={inner.tokens} />;
  }
  return <Blocks tokens={tokens} />;
}

function Table({ token }: { token: Tokens.Table }) {
  return (
    <div className="rt-md-table-wrap">
      <table>
        <thead>
          <tr>
            {token.header.map((cell, index) => (
              <th key={index} style={cell.align ? { textAlign: cell.align } : undefined}>
                <Inline tokens={cell.tokens} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} style={cell.align ? { textAlign: cell.align } : undefined}>
                  <Inline tokens={cell.tokens} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ token }: { token: Token }): ReactNode {
  switch (token.type) {
    case "space":
      return null;
    case "paragraph":
    case "text": {
      const block = token as Tokens.Paragraph | Tokens.Text;
      return (
        <p>
          <Inline tokens={block.tokens} />
        </p>
      );
    }
    case "heading": {
      const heading = token as Tokens.Heading;
      const Tag = (`h${Math.min(heading.depth, 4)}` as "h1" | "h2" | "h3" | "h4");
      return (
        <Tag>
          <Inline tokens={heading.tokens} />
        </Tag>
      );
    }
    case "list": {
      const list = token as Tokens.List;
      const Tag = list.ordered ? "ol" : "ul";
      return (
        <Tag start={typeof list.start === "number" ? list.start : undefined}>
          {list.items.map((item, index) => (
            <li key={index}>
              <div className="rt-md-li">
                {item.task && (
                  <input type="checkbox" checked={Boolean(item.checked)} readOnly tabIndex={-1} />
                )}
                <ListBody tokens={item.tokens} />
              </div>
            </li>
          ))}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote>
          <Blocks tokens={(token as Tokens.Blockquote).tokens} />
        </blockquote>
      );
    case "table":
      return <Table token={token as Tokens.Table} />;
    case "code":
      return (
        <pre>
          <code>{(token as Tokens.Code).text}</code>
        </pre>
      );
    case "hr":
      return <hr />;
    case "html":
    case "def":
      return null;
    default:
      return null;
  }
}

function Blocks({ tokens }: { tokens: Token[] }) {
  return tokens.map((token, index) => <Block key={`${token.type}-${index}`} token={token} />);
}

export default function AssistantMarkdown({ text }: Props) {
  const tokens = useMemo(() => {
    const source = normalizeAssistantMarkdown(text);
    if (!source) return null;
    try {
      return lexer(source, { gfm: true, breaks: true });
    } catch {
      return null;
    }
  }, [text]);

  if (!text.trim()) return null;
  if (!tokens) return <p>{normalizeAssistantMarkdown(text)}</p>;
  return (
    <div className="rt-md">
      <Blocks tokens={tokens} />
    </div>
  );
}
