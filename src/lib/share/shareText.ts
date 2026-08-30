import type { PulseLabel, TrendDirection, WaitEstimate } from "@/types";
import { PULSE_LABEL_TEXT, TREND_TEXT } from "@/lib/pulse/labels";
import { formatWaitEstimate } from "@/lib/pulse/waitEstimate";

export interface ShareStatusInput {
  venueName: string;
  /** True for a directory-only venue with no live PULSE data yet — everything below is
   * ignored in that case, since there's nothing real to report. */
  isDirectory: boolean;
  isClosed: boolean;
  pulseScore: number;
  pulseLabel: PulseLabel;
  /** e.g. "Open until 2:00 AM" — already-composed, timezone-aware display text. */
  openStatusText: string;
  trend: TrendDirection;
  waitEstimate: WaitEstimate | null;
}

/** One shared format for every "share this venue's live status" surface (the venue page's
 * own Share button and the post-contribution share prompt) — spec's share card fields:
 * venue name, PULSE score, status, trend, wait, hours. Pure/testable, no DOM/share APIs. */
export function buildShareStatusText(input: ShareStatusInput): string {
  if (input.isDirectory) return `Check out ${input.venueName} on PULSE`;
  if (input.isClosed) return `${input.venueName} on PULSE — ${input.openStatusText}`;

  const parts = [`${input.venueName} — ${input.pulseScore} · ${PULSE_LABEL_TEXT[input.pulseLabel]}`, input.openStatusText, TREND_TEXT[input.trend]];
  const wait = formatWaitEstimate(input.waitEstimate);
  if (wait !== "No wait estimate") parts.push(wait);
  return parts.join(" · ");
}
