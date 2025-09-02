import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function ThinkingCollapsible({ text }) {
  const body = String(text || '').replace(/^Thinking…\s*\n?/, '');
  return (
    <details className="group inline-block w-full max-w-full">
      <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <svg className="w-3 h-3 transition-transform group-open:rotate-90 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="thinking-indicator text-amber-500">✱</span>
        <span className="italic">Thinking…</span>
      </summary>
      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 ml-5 mt-1">
        <ReactMarkdown components={{}}>{body}</ReactMarkdown>
      </div>
    </details>
  );
}

