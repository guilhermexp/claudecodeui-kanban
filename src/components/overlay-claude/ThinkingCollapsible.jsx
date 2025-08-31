import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function ThinkingCollapsible({ text }) {
  const body = String(text || '').replace(/^Thinking…\s*\n?/, '');
  return (
    <details className="group w-full max-w-full">
      <summary className="list-none cursor-pointer flex items-center gap-2 mb-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-border/50 bg-transparent text-[12px] sm:text-sm text-muted-foreground hover:text-foreground">
        <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium truncate">Thinking…</span>
      </summary>
      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
        <ReactMarkdown components={{}}>{body}</ReactMarkdown>
      </div>
    </details>
  );
}

