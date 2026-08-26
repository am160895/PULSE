import type { ContributorLevel } from "@/types";
import { CONTRIBUTOR_LEVELS } from "@/config/constants";

const LABEL_BY_NAME = new Map(CONTRIBUTOR_LEVELS.map((l) => [l.name, l.label]));

/** Level is a pure function of total XP, derived on every read — never persisted, so it
 * can never drift out of sync with the XP total it's supposed to describe. Same
 * band-lookup idiom as pulseLabelForScore. */
export function levelForXp(totalXp: number): ContributorLevel {
  let current = CONTRIBUTOR_LEVELS[0];
  for (const level of CONTRIBUTOR_LEVELS) {
    if (totalXp >= level.minXp) current = level;
    else break;
  }
  const currentIndex = CONTRIBUTOR_LEVELS.indexOf(current);
  const next = CONTRIBUTOR_LEVELS[currentIndex + 1];
  return {
    name: current.name,
    label: LABEL_BY_NAME.get(current.name)!,
    minXp: current.minXp,
    nextLevelXp: next ? next.minXp : null,
  };
}
