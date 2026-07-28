import { signOut } from "@/auth";
import { requireSession } from "@/lib/guards";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { GlassFilter } from "@/components/GlassFilter";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <GlassFilter />
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <TopBar user={session.user} signOutAction={signOutAction} />
        <main className="py-6 pb-28">{children}</main>
      </div>
      <BottomNav role={session.user.role} />
    </div>
  );
}
