import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const withCitationLinks = (text) => text.replace(/\[((?:S|C|A|B)\d+)\]/g, "[$1](#cite-$1)");

export const Markdown = ({ content, onCite, className = "" }) => (
  <div className={`prose-nexus ${className}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("#cite-")) {
            const tag = href.slice(6);
            return <button type="button" className="nx-citation" onClick={() => onCite?.(tag)} data-testid={`citation-badge-${tag}`}>{tag}</button>;
          }
          return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
        },
      }}>
      {withCitationLinks(content || "")}
    </ReactMarkdown>
  </div>
);
