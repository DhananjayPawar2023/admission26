import React from "react";

/**
 * Parses inline formatting: ***bold-italic***, **bold**, *italic*, and `code` into React elements
 */
export function parseInline(text) {
  if (!text) return "";
  const parts = [];
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("***") && token.endsWith("***")) {
      parts.push(
        <strong key={match.index}>
          <em>{token.slice(3, -3)}</em>
        </strong>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code key={match.index} className="inline-code">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Clean, structured markdown message renderer.
 * Avoids messy raw markdown strings and formats headers, lists, and bold text cleanly.
 * Does NOT use dangerouslySetInnerHTML anywhere.
 */
export function ChatRenderer({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];
  let currentList = [];
  let isNumberedList = false;

  const flushList = () => {
    if (currentList.length > 0) {
      if (isNumberedList) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="chat-msg-ol">
            {currentList.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="chat-msg-ul">
            {currentList.map((item, idx) => (
              <li key={idx}>{parseInline(item)}</li>
            ))}
          </ul>
        );
      }
      currentList = [];
      isNumberedList = false;
    }
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      return;
    }

    // Dividers
    if (line === "---" || line === "___" || line === "***") {
      flushList();
      elements.push(<hr key={`hr-${idx}`} className="chat-msg-divider" />);
      return;
    }

    // Markdown Headers: ###, ##, #
    if (line.startsWith("### ")) {
      flushList();
      elements.push(
        <h4 key={`h4-${idx}`} className="chat-msg-heading">
          {parseInline(line.replace(/^###\s+/, ""))}
        </h4>
      );
      return;
    }
    if (line.startsWith("## ")) {
      flushList();
      elements.push(
        <h3 key={`h3-${idx}`} className="chat-msg-heading chat-msg-h3">
          {parseInline(line.replace(/^##\s+/, ""))}
        </h3>
      );
      return;
    }
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h2 key={`h2-${idx}`} className="chat-msg-heading chat-msg-h2">
          {parseInline(line.replace(/^#\s+/, ""))}
        </h2>
      );
      return;
    }

    // Whole-line callout/header formatted like ***Your Official Summary*** or **Your Official Summary**
    if (/^\*{2,3}[^*]+\*{2,3}$/.test(line)) {
      flushList();
      const cleanHeading = line.replace(/^\*{2,3}|\*{2,3}$/g, "").trim();
      elements.push(
        <h4 key={`h4-callout-${idx}`} className="chat-msg-heading chat-msg-callout">
          {parseInline(cleanHeading)}
        </h4>
      );
      return;
    }

    // Bullet points (• or - or *)
    if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
      if (isNumberedList) flushList();
      isNumberedList = false;
      currentList.push(line.replace(/^[•\-\*]\s+/, ""));
      return;
    }

    // Numbered lists (1. or 2.)
    const numMatch = line.match(/^\d+[\.\)]\s+(.*)/);
    if (numMatch) {
      if (!isNumberedList) flushList();
      isNumberedList = true;
      currentList.push(numMatch[1]);
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="chat-msg-p">
        {parseInline(line)}
      </p>
    );
  });

  flushList();

  return <div className="chat-rendered-content">{elements}</div>;
}
