import React from 'react';
import ReactMarkdown from 'react-markdown';
import CodeBlockCollapsible from './CodeBlockCollapsible';

export default function SystemMessage({ text, markdownComponents }) {
  const textContent = String(text || '');

  // Try to detect fenced code block
  const codeMatch = textContent.match(/```(\w+)?\n([\s\S]*?)```/m);
  const exitMatch = textContent.match(/Exit code:\s*(-?\d+)/i);

  if (codeMatch) {
    const lang = codeMatch[1] || 'bash';
    const code = codeMatch[2] || '';
    return (
      <div>
        {exitMatch && (
          <div className="text-[12px] text-muted-foreground mb-1">Exit code: {exitMatch[1]}</div>
        )}
        <div className="text-[12px] text-muted-foreground mb-1">🔧 {lang}</div>
        <CodeBlockCollapsible language={lang} text={code} />
      </div>
    );
  }

  // Fallback: default markdown for other system notes
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 opacity-80">
      <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
    </div>
  );
}
