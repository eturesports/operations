import { Suspense } from "react";
import { getPublicRoster, seasonsOf, tidyUniversities } from "@/lib/publicRoster";
import { EmbedRoster } from "./EmbedRoster";

// A reader's view of the operations database, built to sit inside an iframe
// on eturesports.com. No sign-in, no navigation, no editing: the same photos
// and seasons the team maintains internally, rendered for visitors.
//
//   /embed/roster                 every season, newest first
//   /embed/roster?season=24/25    opens on one season
//   /embed/roster?theme=dark      for a dark page around it
//
// The season and theme are read in the browser rather than on the server, so
// this page stays static and is served from the CDN — a page that read them
// here would be rebuilt for every visitor, which is not what a marketing site
// needs. Rebuilt every five minutes.
export const revalidate = 300;

export const metadata = {
  title: "Eture Sports · Players",
  // An embedded fragment has no business in search results on its own.
  robots: { index: false, follow: false },
};

export default async function EmbedRosterPage() {
  const all = tidyUniversities(await getPublicRoster());
  const seasons = seasonsOf(all);

  return (
    <div className="p-3">
      <Suspense fallback={null}>
        <EmbedRoster players={all} seasons={seasons} />
      </Suspense>
    </div>
  );
}
