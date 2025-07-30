import { memo } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';

interface MarkdownRendererCompactProps {
  content: string;
  className?: string;
}

function MarkdownRendererCompact({ content, className = '' }: MarkdownRendererCompactProps) {
  const components: Components = {
        // Headings with minimal margins
        h1: ({ children, ...props }) => (
          <h1 {...props} className="text-2xl font-bold mt-1 mb-0.5">
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 {...props} className="text-xl font-bold mt-1 mb-0.5">
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 {...props} className="text-lg font-semibold mt-0.5 mb-0.5">
            {children}
          </h3>
        ),
        h4: ({ children, ...props }) => (
          <h4 {...props} className="text-base font-semibold mt-0.5 mb-0.5">
            {children}
          </h4>
        ),
        h5: ({ children, ...props }) => (
          <h5 {...props} className="text-sm font-semibold mt-0.5 mb-0.5">
            {children}
          </h5>
        ),
        h6: ({ children, ...props }) => (
          <h6 {...props} className="text-xs font-semibold mt-0.5 mb-0.5">
            {children}
          </h6>
        ),
        // Paragraphs with compact spacing
        p: ({ children, ...props }) => (
          <p {...props} className="leading-tight mb-0">
            {children}
          </p>
        ),
        // Lists with tight spacing
        ul: ({ children, ...props }) => (
          <ul {...props} className="list-disc list-inside mb-0 -space-y-2 leading-tight">
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol {...props} className="list-decimal list-inside mb-0 -space-y-2 leading-tight">
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li {...props} className="leading-none -mb-1">
            {children}
          </li>
        ),
        // Blockquotes
        blockquote: ({ children, ...props }) => (
          <blockquote {...props} className="border-l-4 border-gray-300 pl-3 my-0.5 italic">
            {children}
          </blockquote>
        ),
        // Code blocks
        code: ({ children, ...props }) => (
          <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        ),
        // Preformatted text
        pre: ({ children, ...props }) => (
          <pre {...props} className="overflow-x-auto my-0.5">
            {children}
          </pre>
        ),
        // Links
        a: ({ children, href, ...props }) => (
          <a
            {...props}
            href={href}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        // Horizontal rules
        hr: ({ ...props }) => (
          <hr {...props} className="my-1 border-gray-300 dark:border-gray-700" />
        ),
        // Tables
        table: ({ children, ...props }) => (
          <div className="overflow-x-auto my-0.5">
            <table {...props} className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead {...props} className="bg-gray-50 dark:bg-gray-800">
            {children}
          </thead>
        ),
        tbody: ({ children, ...props }) => (
          <tbody {...props} className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
            {children}
          </tbody>
        ),
        th: ({ children, ...props }) => (
          <th {...props} className="px-2 py-1 text-left text-xs font-medium text-gray-900 dark:text-gray-100 uppercase tracking-wider">
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td {...props} className="px-2 py-1 text-sm text-gray-900 dark:text-gray-100">
            {children}
          </td>
        ),
        // Images
        img: ({ src, alt, ...props }) => (
          <img {...props} src={src} alt={alt} className="max-w-full h-auto my-0.5 rounded" />
        ),
        // Strong and emphasis
        strong: ({ children, ...props }) => (
          <strong {...props} className="font-semibold">
            {children}
          </strong>
        ),
        em: ({ children, ...props }) => (
          <em {...props} className="italic">
            {children}
          </em>
        ),
  };

  return (
    <div className={`${className} ultra-compact-markdown`}>
      <style>{`
        .ultra-compact-markdown > *:first-child {
          margin-top: 0 !important;
        }
        .ultra-compact-markdown > *:last-child {
          margin-bottom: 0 !important;
        }
        .ultra-compact-markdown p + p {
          margin-top: 0.125rem;
        }
        .ultra-compact-markdown li p {
          margin-bottom: 0 !important;
          margin-top: 0 !important;
        }
        .ultra-compact-markdown li {
          margin-bottom: 0 !important;
          margin-top: 0 !important;
          line-height: 1.2 !important;
        }
        .ultra-compact-markdown li + li {
          margin-top: -0.5rem !important;
        }
        .ultra-compact-markdown li > ul,
        .ultra-compact-markdown li > ol {
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }
        .ultra-compact-markdown h1,
        .ultra-compact-markdown h2,
        .ultra-compact-markdown h3,
        .ultra-compact-markdown h4,
        .ultra-compact-markdown h5,
        .ultra-compact-markdown h6 {
          line-height: 1.1;
        }
        .ultra-compact-markdown ul,
        .ultra-compact-markdown ol {
          padding-left: 1.25rem;
          margin-top: -0.25rem !important;
          margin-bottom: -0.25rem !important;
        }
        .ultra-compact-markdown pre {
          background-color: rgb(243 244 246);
          padding: 0.5rem;
          border-radius: 0.25rem;
          overflow-x: auto;
          margin-top: 0.25rem;
          margin-bottom: 0.25rem;
        }
        .dark .ultra-compact-markdown pre {
          background-color: rgb(31 41 55);
        }
        .ultra-compact-markdown pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
          font-size: 0.75rem;
        }
      `}</style>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRendererCompact);