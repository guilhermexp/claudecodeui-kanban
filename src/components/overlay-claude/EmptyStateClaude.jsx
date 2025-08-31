import React from 'react';
import CtaButton from '../ui/CtaButton';

export default function EmptyStateClaude({ onStart, onBypass, isStarting, isConnected }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[220px] py-2">
      <div className="flex items-center gap-3">
        <CtaButton onClick={onStart} disabled={isStarting || !isConnected} icon={false} variant="default" className="w-32 sm:w-36 justify-center text-xs sm:text-sm">Start Claude</CtaButton>
        <CtaButton onClick={onBypass} disabled={isStarting || !isConnected} icon={false} variant="default" className="w-32 sm:w-36 justify-center text-xs sm:text-sm">Start Bypass</CtaButton>
      </div>
      <div className="text-center select-none">
        <div className="text-sm sm:text-base font-semibold text-foreground/90">Start a new Claude session</div>
        <div className="text-muted-foreground text-xs">Arraste imagens ou pressione ⌘V para adicionar ao chat</div>
      </div>
    </div>
  );
}

