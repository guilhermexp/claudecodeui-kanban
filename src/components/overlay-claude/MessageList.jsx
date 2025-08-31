import React from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageItemClaude from './MessageItem';

export default function MessageListClaude({ messages, markdownComponents, typingStatus }) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((m) => (
        <MessageItemClaude key={m.id} m={m} markdownComponents={markdownComponents} typingStatus={typingStatus} />
      ))}
    </AnimatePresence>
  );
}

