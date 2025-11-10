// LoadingFallback.jsx - Simple loading component for Suspense
import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingFallback({ message = 'Loading...' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
