import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
}

const MarkdownView = ({ content, className }: Props) => {
  return (
    <div className={`max-w-full break-words text-sm leading-relaxed text-foreground ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-6 mb-2 text-xl font-semibold break-words">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold break-words">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-4 mb-2 text-base font-semibold break-words">{children}</h4>,
          p: ({ children }) => <p className="mb-3 break-words">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="break-words">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-border pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 text-xs break-all">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded bg-muted p-3 text-xs">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="text-courier-600 underline break-all"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="mb-3 w-full overflow-x-auto">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-border p-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border-b border-border p-2 align-top">{children}</td>,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content || "_No content yet._"}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownView;
