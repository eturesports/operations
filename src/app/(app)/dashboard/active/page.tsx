import Link from "next/link";
import { TableScroller } from "@/components/TableScroller";
import { requireSession } from "@/lib/guards";
import { getActiveData, type ActivePlayerRow } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";
import { StatCard } from "@/components/StatCard";
import { AnalyticsTabs } from "@/components/AnalyticsTabs";
import { canEdit } from "@/lib/permissions";
import { RefreshAllButton } from "./RefreshAllButton";

export const dynamic = "force-dynamic";

function Avatar({ row }: { row: ActivePlayerRow }) {
  if (row.profileImageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={row.profileImageUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-ink-600 object-cover"
      />
    );
  }
  return (
    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-700 text-[11px] font-bold text-fg">
      {row.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function LeaderTable({
  title,
  rows,
  stat,
  statLabel,
}: {
  title: string;
  rows: ActivePlayerRow[];
  stat: (r: ActivePlayerRow) => number | null;
  statLabel: string;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-ink-600 px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          No stats yet. Open a player, add their current university profile and press ↻ NCAA.
        </p>
      ) : (
        <TableScroller>
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Player</th>
              <th className="px-4 py-2 font-medium">University</th>
              <th className="px-4 py-2 text-right font-medium">{statLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.profileId} className="border-t border-ink-700/60">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar row={r} />
                    <span className="font-medium text-fg">{r.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-muted">{r.university}</td>
                <td className="px-4 py-2 text-right font-display text-lg text-fg">{stat(r) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroller>
      )}
    </section>
  );
}

export default async function ActivePlayersPage() {
  const session = await requireSession();
  const editable = canEdit(session.user.role);
  const d = await getActiveData();

  return (
    <div className="space-y-6">
      <div>
        <div className="kicker mb-1">Data Intelligence</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">Active players</h1>
        <p className="text-sm text-muted">
          Players marked as playing on a university roster right now. Stats refresh automatically
          every Monday from the NCAA.
        </p>
      </div>

      <AnalyticsTabs />

      {editable && <RefreshAllButton />}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active players"
          value={formatNumber(d.activeCount)}
          sub={`${formatNumber(d.withStats)} with stats`}
        />
        <StatCard label="Total goals" value={formatNumber(d.totals.goals)} sub="This season" />
        <StatCard label="Total assists" value={formatNumber(d.totals.assists)} sub="This season" />
        <StatCard
          label="Minutes played"
          value={formatNumber(d.totals.minutes)}
          sub={`${formatNumber(d.totals.saves)} saves (GK)`}
        />
      </div>

      {d.activeCount === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">
            No active players yet. Open a player from{" "}
            <Link href="/players" className="text-brand hover:underline">
              Players
            </Link>
            , press <b className="text-fg">“Mark as playing now”</b> in their profile, and their
            NCAA stats will appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <LeaderTable
              title="Top scorers"
              rows={d.topScorers}
              stat={(r) => r.goals}
              statLabel="Goals"
            />
            <LeaderTable
              title="Top assists"
              rows={d.topAssists}
              stat={(r) => r.assists}
              statLabel="Assists"
            />
          </div>

          <section className="card overflow-hidden">
            <div className="border-b border-ink-600 px-4 py-3">
              <h2 className="text-sm font-semibold text-fg">All active players</h2>
            </div>
            <TableScroller>
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-900/60 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Player</th>
                    <th className="px-4 py-2 font-medium">University</th>
                    <th className="px-4 py-2 font-medium">Div</th>
                    <th className="px-4 py-2 text-right font-medium">GP</th>
                    <th className="px-4 py-2 text-right font-medium">Min</th>
                    <th className="px-4 py-2 text-right font-medium">G</th>
                    <th className="px-4 py-2 text-right font-medium">A</th>
                    <th className="px-4 py-2 text-right font-medium">Pts</th>
                    <th className="px-4 py-2 text-right font-medium">Sv</th>
                  </tr>
                </thead>
                <tbody>
                  {d.rows.map((r) => (
                    <tr key={r.profileId} className="border-t border-ink-700/60">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar row={r} />
                          <span className="font-medium text-fg">{r.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted">{r.university}</td>
                      <td className="px-4 py-2 text-muted">{r.division ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-fg">{r.matchesPlayed ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">{r.minutes ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-fg">{r.goals ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-fg">{r.assists ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-accent">{r.points ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted">{r.saves ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          </section>

          <p className="text-xs leading-relaxed text-muted">
            “Current” profiles only. Stats are pulled from the public NCAA statistics API (matched by
            player name across the tracked individual leaderboards) or entered by hand. A player can
            hold several university profiles; only the one marked current appears here.
          </p>
        </>
      )}
    </div>
  );
}
