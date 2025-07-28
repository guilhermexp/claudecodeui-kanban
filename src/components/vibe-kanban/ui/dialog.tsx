import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '../../../lib/vibe-kanban/utils';
import { useDialogKeyboardShortcuts } from '../../../lib/vibe-kanban/keyboard-shortcuts';

const Dialog = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    uncloseable?: boolean;
  }
>(({ className, open, onOpenChange, children, uncloseable, ...props }, ref) => {
  // Add keyboard shortcut support for closing dialog with Esc
  useDialogKeyboardShortcuts(() => {
    if (open && onOpenChange && !uncloseable) {
      onOpenChange(false);
    }
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center sm:items-start">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => (uncloseable ? {} : onOpenChange?.(false))}
      />
      <div className="overflow-y-auto max-h-screen w-full sm:max-w-fit sm:py-8 flex items-center justify-center">
        <div
          ref={ref}
          className={cn(
            'relative z-[9999] grid w-full max-w-lg gap-4 bg-background p-4 sm:p-6 shadow-lg duration-200 sm:rounded-2xl min-h-screen sm:min-h-0 overflow-hidden',
            className
          )}
          {...props}
        >
        {!uncloseable && (
          <button
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        )}
        {children}
        </div>
      </div>
    </div>
  );
});
Dialog.displayName = 'Dialog';

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
DialogTitle.displayName = 'DialogTitle';

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & { asChild?: boolean }
>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? React.Fragment : 'p';
  const childProps = asChild ? {} : {
    ref,
    className: cn('text-sm text-muted-foreground', className),
    ...props
  };
  
  return asChild ? (
    <>{props.children}</>
  ) : (
    <Comp {...childProps} />
  );
});
DialogDescription.displayName = 'DialogDescription';

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('grid gap-4', className)} {...props} />
));
DialogContent.displayName = 'DialogContent';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
};
