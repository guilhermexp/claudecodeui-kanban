'use client';

import { useState } from 'react';
import { CopyIcon, CheckIcon } from 'lucide-react';
import { usePostHog } from 'posthog-js/react';
import { cn } from '@stagewise/ui/lib/utils';

export function Clipboard({
  text,
  className,
  buttonText,
}: {
  text: string;
  className?: string;
  buttonText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const posthog = usePostHog();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      posthog?.capture('quickstart_toolbar_copy_click');
      setTimeout(() => setCopied(false), 1500);
    } catch (_e) {
      // Optionally handle error
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100 p-4 pr-6 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-200 active:scale-95 sm:w-auto dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800',
        className,
      )}
      onClick={handleCopy}
      aria-label="Copy to clipboard"
    >
      <span className="select-all pr-6 font-mono">{buttonText || text}</span>
      {copied ? (
        <CheckIcon className="h-4 w-4 text-green-500" />
      ) : (
        <CopyIcon className="h-4 w-4" />
      )}
    </button>
  );
}
