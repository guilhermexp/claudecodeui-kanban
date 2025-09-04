import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import PromptsHub from './PromptsHub';

export default function PromptsModal({ isOpen, onClose, onExecutePrompt }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-5xl h-[62vh] min-h-[420px] p-0 bg-card border border-border mx-2 sm:mx-auto overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 pt-4 pb-3 border-b border-border bg-card/95 backdrop-blur">
          <DialogTitle className="text-xl font-semibold text-foreground tracking-tight">Prompts Hub</DialogTitle>
        </DialogHeader>
        <div className="h-full">
          <PromptsHub onClose={onClose} onExecutePrompt={onExecutePrompt} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
