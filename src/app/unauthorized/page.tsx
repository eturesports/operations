import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-4">
      <div className="card max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-fg">No access</h1>
        <p className="mb-6 text-sm text-muted">
          You do not have permission to view this section. If you think this is a
          mistake, ask an administrator to review your role.
        </p>
        <Link href="/dashboard" className="btn-primary">
          Back to overview
        </Link>
      </div>
    </main>
  );
}
