import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import ThinkingCollapsible from './ThinkingCollapsible';

export default function MessageItemClaude({ m, markdownComponents, typingStatus }) {
  const isUser = m.type === 'user';
  const isError = m.type === 'error';
  const isSystem = m.type === 'system';
  const isAssistant = !isUser && !isError && !isSystem;
  const containerClass = isUser
    ? 'text-foreground'
    : isError
    ? 'px-4 py-3 rounded-2xl shadow-sm bg-destructive/10 text-destructive border border-destructive/20'
    : isSystem
    ? 'text-muted-foreground italic'
    : 'text-foreground';

  const textContent = typeof m.text === 'string' ? m.text : (m.text?.toString() || '');
  const rawText = textContent.trim();
  const firstLine = rawText.split('\n')[0] || '';
  const looksLikeSpec = !isUser && !isError && !isSystem && /^(plan|observations|spec|plano|observa|especifica)/i.test(firstLine);
  const specTitle = looksLikeSpec ? (firstLine.length > 2 ? firstLine : 'Plan Specification') : null;
  const isToolMessage = !isError && isSystem && typeof m.text === 'string' && m.text.startsWith('🔧 ');

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

  const RuleCard = ({ children }) => {
    const linesAll = textContent.split('\n');
    const nonEmpty = linesAll.filter(l => l.trim().length > 0);
    const ruleMatch = !isUser && !isError && !isSystem && /^rule:\s*/i.test((nonEmpty[0] || ''));
    const ruleName = ruleMatch ? (nonEmpty[0].replace(/^rule:\s*/i, '').trim() || 'rule') : null;
    const ruleTags = ruleMatch && nonEmpty[1] && /,/.test(nonEmpty[1]) ? nonEmpty[1].trim() : null;
    if (!ruleMatch) return <>{children}</>;
    let body = textContent;
    body = body.replace(/^\s*Rule:.*\n?/i, '');
    if (ruleTags) body = body.replace(new RegExp(`^\s*${ruleTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n?`), '');
    return (
      <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-3 shadow-sm">
        <div className="text-[11px] text-muted-foreground mb-1">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/50">Rule: {ruleName}</span>
          {ruleTags && (
            <span className="ml-2 text-muted-foreground/80">{ruleTags}</span>
          )}
        </div>
        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 14, scale: isAssistant ? 0.995 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -14 }}
      transition={{ duration: isAssistant ? 0.35 : 0.25, ease: 'easeOut' }}
      className={`w-full`}
    >
      <div className={`${containerClass} w-full max-w-none pr-2`}>
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
                <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 ${isUser ? 'text-foreground/80' : ''}`}>
                  <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                </div>
              </SpecWrapper>
            ) : isSystem ? (
              (/^Thinking…/.test(textContent)) ? (
                <ThinkingCollapsible text={textContent} />
              ) : isToolMessage && typingStatus?.mode === 'tool' ? (
                <div className="inline-flex items-center gap-2 text-sm opacity-85">
                  <span className="w-3 h-3 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin inline-block" />
                  <span className="italic">
                    <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                  </span>
                </div>
              ) : (
                <div className="max-w-none leading-relaxed">
                  <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                </div>
              )
            ) : (
              <RuleCard>
                <SpecWrapper>
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                    <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                  </div>
                </SpecWrapper>
              </RuleCard>
            )
        )}
      </div>
    </motion.div>
  );
}

