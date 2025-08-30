import React from 'react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { createMarkdownComponents } from './MarkdownComponents';

// Shared message renderer component
export const MessageRenderer = ({ message, markdownComponents = createMarkdownComponents() }) => {
  const isUser = message.type === 'user';
  const isError = message.type === 'error';
  const isSystem = message.type === 'system';
  
  const containerClass = isUser
    ? 'text-foreground text-left px-3 py-2 rounded-lg bg-accent/20 border border-accent/30'
    : isError
    ? 'px-4 py-3 rounded-2xl shadow-sm bg-destructive/10 text-destructive border border-destructive/20'
    : isSystem
    ? 'text-muted-foreground italic'
    : 'text-foreground';
  
  const textContent = typeof message.text === 'string' ? message.text : (message.text?.toString() || '');
  const rawText = textContent.trim();
  const firstLine = rawText.split('\n')[0] || '';
  const looksLikeSpec = !isUser && !isError && !isSystem && /^(plan|observations|spec|plano|observa|especifica)/i.test(firstLine);
  const specTitle = looksLikeSpec ? (firstLine.length > 2 ? firstLine : 'Plan Specification') : null;
  
  const isToolMessage = !isError && isSystem && typeof message.text === 'string' && message.text.startsWith('🔧 ');
  
  const extractCommand = (txt) => {
    const match = /`([^`]+)`/.exec(txt || '');
    return match ? match[1] : '';
  };
  
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
    <motion.div 
      key={message.id} 
      initial={{ opacity: 0, y: 16 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -16 }} 
      transition={{ duration: 0.25 }} 
      className="w-full"
    >
      <div className={`${containerClass} ${isUser ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[85%]'}`}>
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
          (isUser || isError) ? (
            <SpecWrapper>
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
              </div>
            </SpecWrapper>
          ) : isSystem ? (
            <div className="relative">
              {isToolMessage && (
                <button
                  className="absolute -top-1 -right-1 text-[10px] px-2 py-0.5 rounded bg-background/80 border border-border/50 opacity-60 hover:opacity-100 transition-opacity"
                  title="Copy command"
                  onClick={async () => {
                    try { 
                      await navigator.clipboard.writeText(extractCommand(message.text)); 
                    } catch {}
                  }}
                >
                  Copy
                </button>
              )}
              <SpecWrapper>
                <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 ${isSystem ? 'opacity-80' : ''}`}>
                  <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                </div>
              </SpecWrapper>
            </div>
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
};