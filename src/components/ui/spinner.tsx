import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Small inline spinner for button/action loading states. */
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-4 w-4 animate-spin", className)}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
