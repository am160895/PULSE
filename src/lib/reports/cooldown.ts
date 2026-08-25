import { REPORT_COOLDOWN_MINUTES } from "@/config/constants";

export interface CooldownCheck {
  ok: boolean;
  retryAfterMinutes?: number;
}

/** One report per user per venue per cooldown window — the main defense against "PACKED every 30 seconds." */
export function checkReportCooldown(lastReportAt: Date | null, now: Date): CooldownCheck {
  if (!lastReportAt) return { ok: true };
  const minutesSince = (now.getTime() - lastReportAt.getTime()) / 60_000;
  if (minutesSince >= REPORT_COOLDOWN_MINUTES) return { ok: true };
  return { ok: false, retryAfterMinutes: Math.ceil(REPORT_COOLDOWN_MINUTES - minutesSince) };
}
