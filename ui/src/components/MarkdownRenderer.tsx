import { useState, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]">
      <div className="flex items-center justify-between bg-[#1b1b1b] px-3.5 py-2 text-xs text-[#b4b4b4]">
        <span className="font-mono lowercase">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-[#10a37f]" />
              <span className="text-[#10a37f]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[0.85rem] leading-relaxed text-[#ececec]">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className ?? '');
            const text = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || text.includes('\n');

            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? ''} code={text} />;
            }

            return (
              <code
                className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.86em] text-[#ececec]"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          table({ children }) {
            return (
              <div className="my-4 max-w-full overflow-x-auto rounded-lg border border-white/12">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
