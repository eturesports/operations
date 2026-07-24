export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-bone/55">
        {label}
      </div>
      <div className="mt-2 font-display text-4xl leading-none text-white">
        {value}
      </div>
      {sub && <div className="mt-2 text-xs text-bone/45">{sub}</div>}
    </div>
  );
}
