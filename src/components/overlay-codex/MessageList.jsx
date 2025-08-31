import React from 'react';
import { AnimatePresence } from 'framer-motion';
import MessageItem from './MessageItem';

export default function MessageList({ messages, markdownComponents }) {
  return (
    <AnimatePresence initial={false}>
      {messages.map((m) => (
        <MessageItem key={m.id} m={m} markdownComponents={markdownComponents} />
      ))}
    </AnimatePresence>
  );
}

