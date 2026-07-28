import { getPublicRoster, seasonsOf, tidyUniversities } from "@/lib/publicRoster";
import { EmbedRoster } from "./EmbedRoster";

// A reader's view of the operations database, built to sit inside an iframe
// on eturesports.com. No sign-in, no navigation, no editing: the same photos
// and seasons the team maintains internally, rendered for visitors.
//
//   /embed/roster                 every season, newest first
//   /embed/roster?season=24/25    one season
//   /embed/roster?theme=dark      for a dark page around it
//
// Rebuilt every five minutes rather than on every visit.
export const revalidate = 300;

export const metadata = {
  title: "Eture Sports · Players",
  // An embedded fragment has no business in search results on its own.
  robots: { index: false, follow: false },
};

export default async function EmbedRosterPage({
  searchParams,
}: {
  searchParams: { season?: string; theme?: string };
}) {
  const all = tidyUniversities(await getPublicRoster());
  const seasons = seasonsOf(all);
  const season = searchParams.season && seasons.some((s) => s.season === searchParams.season)
    ? searchParams.season
    : null;

  // The theme lives on <html>, which this page does not own, and the parent
  // site decides the look — so it is applied here rather than read from the
  // visitor's stored preference for the internal app.
  const theme = searchParams.theme === "dark" ? "dark" : "light";

  return (
    <div className="min-h-screen px-3 py-4">
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.setAttribute('data-theme','${theme}');`,
        }}
      />
      <EmbedRoster players={all} seasons={seasons} initialSeason={season} />
    </div>
  );
}
