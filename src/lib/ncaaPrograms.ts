/**
 * How many Division I men's soccer programmes exist.
 *
 * This is the denominator behind "Eture is present in X% of Division I", so
 * it decides whether that claim is true. It is deliberately a reviewed number
 * rather than something derived at runtime:
 *
 *  - It is NOT the count of Division I institutions. There are 366 of those
 *    in the NCAA directory, and most of them do not field a men's soccer
 *    team. Dividing by 366 would understate the figure by about 40%.
 *  - It changes once a year at most, when a programme is added or dropped.
 *
 * The full list it was counted from lives in
 * `scripts/ncaa-di-mens-soccer.json`, with its source and the date it was
 * taken, so the number can be audited and replaced rather than trusted.
 */
export const NCAA_DI_MENS_SOCCER_PROGRAMS = 213;

/** Division I in the several ways the database spells it. */
export function isDivisionOne(division: string | null | undefined): boolean {
  const d = (division ?? "").trim().toLowerCase();
  return d === "division i" || d === "division 1" || d === "d1" || d === "di";
}
