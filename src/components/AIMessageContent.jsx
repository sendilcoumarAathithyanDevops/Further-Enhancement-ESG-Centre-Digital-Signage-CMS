import "./AIMessageContent.css";

const INLINE_PATTERN =
  /(\*\*\*[^*\n]+?\*\*\*|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|_[^_\n]+?_|<u>[^<\n]+<\/u>|\+\+[^+\n]+\+\+|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function renderInline(text, keyPrefix) {
  const parts = text.split(INLINE_PATTERN);
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return null;

    if (part.startsWith("***") && part.endsWith("***")) {
      return (
        <strong key={key}>
          <em>{renderInline(part.slice(3, -3), key)}</em>
        </strong>
      );
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return <strong key={key}>{renderInline(part.slice(2, -2), key)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={key}>{renderInline(part.slice(1, -1), key)}</em>;
    }
    if (part.startsWith("<u>") && part.endsWith("</u>")) {
      return <u key={key}>{renderInline(part.slice(3, -4), key)}</u>;
    }
    if (part.startsWith("++") && part.endsWith("++")) {
      return <u key={key}>{renderInline(part.slice(2, -2), key)}</u>;
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return <del key={key}>{renderInline(part.slice(2, -2), key)}</del>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }

    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export default function AIMessageContent({ content }) {
  const lines = String(content || "").split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = null;
  let code = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`paragraph-${blocks.length}`}>
        {paragraph.map((line, index) => (
          <span key={`line-${index}`}>
            {index > 0 && <br />}
            {renderInline(line, `paragraph-${blocks.length}-${index}`)}
          </span>
        ))}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const ListTag = list.type;
    blocks.push(
      <ListTag key={`list-${blocks.length}`}>
        {list.items.map((item, index) => (
          <li key={`item-${index}`}>{renderInline(item, `list-${blocks.length}-${index}`)}</li>
        ))}
      </ListTag>
    );
    list = null;
  };

  lines.forEach((line) => {
    if (code) {
      if (/^\s*```/.test(line)) {
        blocks.push(
          <pre key={`code-${blocks.length}`}>
            <code>{code.join("\n")}</code>
          </pre>
        );
        code = null;
      } else {
        code.push(line);
      }
      return;
    }

    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushList();
      code = [];
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const HeadingTag = `h${heading[1].length}`;
      blocks.push(
        <HeadingTag key={`heading-${blocks.length}`}>
          {renderInline(heading[2], `heading-${blocks.length}`)}
        </HeadingTag>
      );
      return;
    }

    const listItem = /^\s*(?:([-*+])\s+|(\d+)[.)]\s+)(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const type = listItem[2] ? "ol" : "ul";
      if (list?.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push(listItem[3]);
      return;
    }

    if (/^(?:---+|___+|\*\*\*+)\s*$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`rule-${blocks.length}`} />);
      return;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(
        <blockquote key={`quote-${blocks.length}`}>
          {renderInline(line.replace(/^\s*>\s?/, ""), `quote-${blocks.length}`)}
        </blockquote>
      );
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();
  if (code) {
    blocks.push(
      <pre key={`code-${blocks.length}`}>
        <code>{code.join("\n")}</code>
      </pre>
    );
  }

  return <div className="ai-support-markdown">{blocks}</div>;
}
