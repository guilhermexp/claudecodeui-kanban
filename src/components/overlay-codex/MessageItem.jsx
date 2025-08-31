import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import SystemMessage from './SystemMessage';

export default function MessageItem({ m, markdownComponents }) {
  const isUser = m.type === 'user';
  const isError = m.type === 'error';
  const isSystem = m.type === 'system';
  const containerClass = isUser
    ? 'text-foreground/80 text-right'
    : isError
    ? 'px-4 py-3 rounded-2xl shadow-sm bg-destructive/10 text-destructive border border-destructive/20'
    : isSystem
    ? 'text-muted-foreground italic'
    : 'text-foreground';

  const isToolMessage = !isError && isSystem && typeof m.text === 'string' && m.text.startsWith('🔧 ');
  const textContent = typeof m.text === 'string' ? m.text : (m.text?.toString() || '');
  const rawText = textContent.trim();
  const firstLine = rawText.split('\n')[0] || '';
  const looksLikeSpec = !isUser && !isError && !isSystem && /^(plan|observations|spec|plano|observa|especifica)/i.test(firstLine);
  const specTitle = looksLikeSpec ? (firstLine.length > 2 ? firstLine : 'Plan Specification') : null;

  const SpecWrapper = ({ children }) => {
    if (!looksLikeSpec) return <>{children}</>;
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-2 shadow-sm">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600/80 text-white">✓</span>
          <span>{specTitle}</span>
        </div>
        {children}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className={`w-full ${isUser ? 'flex justify-end' : ''}`}>
      <div className={`${containerClass} ${isUser ? 'max-w-[85%]' : 'w-full max-w-none pr-2'}`}>
        {/^(Updated Todo List|Lista de tarefas atualizada|TODO List:|Todo List:)/i.test(textContent) ? (
          <div>
            <div className="text-sm font-semibold mb-1">{(textContent.split('\n')[0] || '').trim()}</div>
            <ul className="space-y-1 ml-1">
              {textContent.split('\n').slice(1).filter(line => line.trim()).slice(0, 30).map((line, idx) => {
                const checked = /(^|\s)(\[x\]|✔)/i.test(line);
                const content = line.replace(/^[-*\d\.\)\s]+/, '');
                return (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
                    <span>{content}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          (isUser || isError)
            ? (
              <SpecWrapper>
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                  <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                </div>
              </SpecWrapper>
            ) : isSystem ? (
              <SystemMessage text={textContent} markdownComponents={markdownComponents} />
            ) : (
              <SpecWrapper>
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                  <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                </div>
              </SpecWrapper>
            )
        )}
      </div>
    </motion.div>
  );
}
