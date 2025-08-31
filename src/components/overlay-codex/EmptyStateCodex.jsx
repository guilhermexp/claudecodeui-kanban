import React from 'react';
import CtaButton from '../ui/CtaButton';

export default function EmptyStateCodex({ isStarting, isConnected, onStart }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 h-full min-h-[180px] py-3">
      <CtaButton
        onClick={onStart}
        disabled={isStarting || !isConnected}
        icon={false}
        className="w-32 sm:w-36 justify-center text-xs sm:text-sm"
      >
        Start Codex
      </CtaButton>
      <div className="text-center select-none mt-1">
        <div className="text-sm sm:text-base font-semibold text-foreground/90">Start a new Codex session</div>
        <div className="text-muted-foreground text-xs">Arraste imagens ou pressione ⌘V para adicionar ao chat</div>
      </div>
    </div>
  );
}

