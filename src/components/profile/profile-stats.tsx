/**
 * Basic verified-org analytics — not a dashboard.
 * Deliberately understated: this is a secondary detail for the
 * profile owner, never competing visually with identity/counts.
 */
export function ProfileStats({
  profileViews,
  postReach,
}: {
  profileViews: number;
  postReach: number;
}) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-4 rounded-[10px] border border-[var(--separator)] bg-card px-3.5 py-2.5">
      <Stat label="Visualizações" value={profileViews} />
      <div className="h-6 w-px bg-[var(--separator)]" aria-hidden />
      <Stat label="Alcance" value={postReach} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-[12px] text-muted-foreground">
      <span className="font-semibold tabular-nums text-foreground">
        {formatCompact(value)}
      </span>{" "}
      {label.toLowerCase()}
    </p>
  );
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
