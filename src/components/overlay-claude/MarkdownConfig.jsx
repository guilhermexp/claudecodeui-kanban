import React from 'react';
import ReactMarkdown from 'react-markdown';
import CodeBlockCollapsible from './CodeBlockCollapsible';

export default function createClaudeMarkdownComponents() {
  return {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      if (!inline && language) {
        return <CodeBlockCollapsible language={language} text={String(children)} />;
      }
      return (<code className="chat-inline-code" {...props}>{children}</code>);
    },
    ul({ children, ...props }) { return (<ul className="list-disc list-outside pl-4 ml-0 my-2" {...props}>{children}</ul>); },
    ol({ children, ...props }) { return (<ol className="list-decimal list-outside pl-4 ml-0 my-2" {...props}>{children}</ol>); },
    li({ children, ...props }) {
      const raw = String(children && children[0] ? (children[0].props ? children[0].props.children : children[0]) : '');
      const unchecked = /^\s*\[[\s]\]\s+/.test(raw);
      const checked = /^\s*\[[xX]\]\s+/.test(raw);
      if (unchecked || checked) {
        const label = raw.replace(/^\s*\[[xX\s]\]\s+/, '');
        return (
          <li className="list-none my-1" {...props}>
            <label className="inline-flex items-start gap-2">
              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
              <span>{label}</span>
            </label>
          </li>
        );
      }
      return (<li className="my-1" {...props}>{children}</li>);
    },
    p({ children, ...props }) { return <p className="my-1" {...props}>{children}</p>; },
    a({ children, href, ...props }) { return (<a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" {...props}>{children}</a>); },
    blockquote({ children, ...props }) { return (<blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground" {...props}>{children}</blockquote>); },
    h1({ children, ...props }) { return <h1 className="text-xl font-bold mt-3 mb-2" {...props}>{children}</h1>; },
    h2({ children, ...props }) { return <h2 className="text-lg font-semibold mt-2 mb-1" {...props}>{children}</h2>; },
    h3({ children, ...props }) { return <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>; },
  };
}
