import { prisma } from "@/lib/prisma";
import { resolveShareToken } from "@/lib/share";
import { ShareForm, type ShareablePlayer } from "./ShareForm";

export const dynamic = "force-dynamic";
// A share link must never be indexed or cached by a proxy.
export const metadata = {
  title: "Edit player · Eture Sports",
  robots: { index: false, follow: false },
};

function Invalid({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card max-w-md p-8 text-center">
        <div className="kicker mb-3">Eture Sports</div>
        <h1 className="mb-2 text-2xl font-bold text-fg">Link unavailable</h1>
        <p className="text-sm text-muted">{reason}</p>
        <p className="mt-4 text-xs text-muted">
          Ask your Eture Sports contact for a new link.
        </p>
      </div>
    </main>
  );
}

export default async function SharePage({
  params,
}: {
  params: { token: string };
}) {
  const share = await resolveShareToken(params.token);
  if (!share.ok) return <Invalid reason={share.reason} />;

  const player = await prisma.player.findUnique({
    where: { id: share.playerId },
    select: {
      name: true,
      university: true,
      season: true,
      division: true,
      program: true,
      position: true,
      nationality: true,
      previousClub: true,
      notes: true,
      profileImageUrl: true,
      actionImageUrl: true,
      ncaaUrl: true,
      instagramUrl: true,
    },
  });
  if (!player) return <Invalid reason="This player no longer exists." />;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <div className="kicker mb-2">Eture Sports</div>
        <h1 className="text-2xl font-bold text-fg sm:text-3xl">{player.name}</h1>
        <p className="mt-1 text-sm text-muted">
          You&apos;ve been invited to keep this player&apos;s details up to date.
          Changes save straight to the Eture Sports database.
        </p>
      </div>

      <div className="card p-6">
        <ShareForm token={params.token} player={player as ShareablePlayer} />
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        This link is personal — anyone who has it can edit this player. It expires
        automatically and Eture Sports can revoke it at any time. Every change is
        recorded.
      </p>
    </main>
  );
}
