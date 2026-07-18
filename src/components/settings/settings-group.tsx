import { cn } from "@/lib/utils";

/**
 * Apple Settings–style section: discrete title + inset group of rows.
 * No heavy cards, no shadows — surface + hairline separators only.
 */
export function SettingsGroup({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section data-app-chrome className={cn("px-4", className)}>
      {title ? (
        <h2 className="mb-1.5 px-3.5 text-[13px] font-normal tracking-[-0.01em] text-muted-foreground">
          {title}
        </h2>
      ) : null}
      <div className="overflow-hidden rounded-[12px] bg-card">
        <ul className="divide-y divide-[var(--separator)]">{children}</ul>
      </div>
    </section>
  );
}
