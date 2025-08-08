import * as React from "react"
import { cn } from "../../lib/utils"

// Unified ScrollArea used across Sidebar, Files, Shell panels
// Matches styling semantics with the Vibe Kanban ScrollArea
const ScrollArea = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative overflow-auto",
      // Consistent scrollbar styles (WebKit)
      "[&::-webkit-scrollbar]:w-2",
      "[&::-webkit-scrollbar-track]:bg-transparent",
      "[&::-webkit-scrollbar-thumb]:bg-border",
      "[&::-webkit-scrollbar-thumb]:rounded-full",
      "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50",
      // Firefox
      "scrollbar-thin",
      className
    )}
    style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
    {...props}
  >
    {children}
  </div>
))
ScrollArea.displayName = "ScrollArea"

export { ScrollArea }