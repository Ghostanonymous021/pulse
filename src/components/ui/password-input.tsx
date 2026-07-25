"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  /** Classes for the wrapping relative container. */
  wrapperClassName?: string;
};

/**
 * Password field with a show/hide toggle (Eye/EyeOff, lucide-react).
 * Single source of truth for this pattern — never re-implement a plain
 * `type="password"` input by hand (see AGENTS.md §5, componentes
 * reutilizáveis centralizados).
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    { className, wrapperClassName, ...props },
    ref,
  ) {
    const [visible, setVisible] = useState(false);

    return (
      <div className={cn("relative", wrapperClassName)}>
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-11", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.5} />
          ) : (
            <Eye className="h-[18px] w-[18px]" strokeWidth={1.5} />
          )}
        </button>
      </div>
    );
  },
);
