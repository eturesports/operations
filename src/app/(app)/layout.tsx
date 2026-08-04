import { signOut } from "@/auth";
import { requireSession } from "@/lib/guards";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { WheelToPage } from "@/components/WheelToPage";

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
    <div className="min-h-[100dvh]">
      {/* Every screen here has a table on it somewhere. */}
      <WheelToPage />
      {/* Held clear of the notch in landscape, now that the page is allowed
          to reach the edges of the screen. */}
      <div className="mx-auto max-w-6xl px-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:px-4">
        <TopBar user={session.user} signOutAction={signOutAction} />
        {/* Room for the floating navigation and the home indicator beneath it. */}
        <main className="py-6 pb-[calc(7rem+env(safe-area-inset-bottom))]">{children}</main>
      </div>
      <BottomNav role={session.user.role} />
    </div>
  );
}
