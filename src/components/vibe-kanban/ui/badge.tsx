import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../../lib/vibe-kanban/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-800 text-white hover:bg-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'border-transparent bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
        outline: 'text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
