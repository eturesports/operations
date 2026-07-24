import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.active === false) redirect("/unauthorized");
  if (session.user.approved) redirect("/dashboard");

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="kicker mb-3">Eture Sports</div>
        <h1 className="mb-2 text-2xl font-bold text-fg">Account pending approval</h1>
        <p className="mb-6 text-sm text-muted">
          Thanks for signing in{session.user.name ? `, ${session.user.name}` : ""}. Your
          account (<span className="text-fg">{session.user.email}</span>) is awaiting
          approval from an administrator. You&apos;ll get access as soon as it&apos;s
          reviewed.
        </p>
        <form action={signOutAction}>
          <button type="submit" className="btn-ghost">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
