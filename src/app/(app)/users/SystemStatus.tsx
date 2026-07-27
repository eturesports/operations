// Admin-only health strip: shows whether the optional integrations this app
// relies on are actually wired in the running deployment. Vercel only exposes
// an environment variable to deployments built after it was added, so a value
// can be set in the dashboard and still be missing here until a redeploy.

function Row({
  label,
  ok,
  okText,
  missingText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  missingText: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          ok ? "bg-emerald-400" : "bg-amber-400"
        }`}
        aria-hidden
      />
      <div>
        <div className="text-sm font-medium text-fg">
          {label}{" "}
          <span className={ok ? "text-emerald-400" : "text-amber-400"}>
            {ok ? "· enabled" : "· not active"}
          </span>
        </div>
        <div className="text-xs text-muted">{ok ? okText : missingText}</div>
      </div>
    </div>
  );
}

export function SystemStatus() {
  const blob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const cron = !!process.env.CRON_SECRET;

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-fg">System status</h2>
      <p className="mb-2 text-xs text-muted">
        What this deployment can currently do.
      </p>
      <div className="divide-y divide-ink-700/60">
        <Row
          label="Image uploads"
          ok={blob}
          okText="Photos can be uploaded directly from a player's form."
          missingText="Blob storage isn't reaching this deployment. If you just created the store, redeploy the project so the token is picked up. Meanwhile, pasting an image URL still works."
        />
        <Row
          label="Weekly NCAA stats refresh"
          ok={cron}
          okText="Stats for players marked as playing now refresh every Monday."
          missingText="Add a CRON_SECRET environment variable in Vercel and redeploy, otherwise the Monday job is rejected. The manual “Refresh all” button works either way."
        />
      </div>
    </section>
  );
}
