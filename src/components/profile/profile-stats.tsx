/**
 * Basic verified-org analytics — not a dashboard.
 */
export function ProfileStats({
  profileViews,
  postReach,
}: {
  profileViews: number;
  postReach: number;
}) {
  return (
    <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
      <StatCard label="Visualizacoes" value={profileViews} />
      <StatCard label="Alcance" value={postReach} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[12px] border border-[var(--separator)] bg-card px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-[-0.03em]">
        {formatCompact(value)}
      </p>
    </div>
  );
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
