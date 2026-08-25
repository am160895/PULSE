import { z } from "zod";
import type { CrowdLevel, EnergyLevel, ReportSource, WaitLevel } from "@/types";
import { REPORT_PROXIMITY_RADIUS_METERS } from "@/config/constants";
import { isWithinRadius, type LatLng } from "@/lib/geo";
import { checkReportCooldown } from "./cooldown";

export const reportInputSchema = z.object({
  crowdLevel: z.enum(["EMPTY", "QUIET", "MODERATE", "BUSY", "PACKED"]),
  waitLevel: z.enum(["NONE", "SHORT", "MEDIUM", "LONG", "VERY_LONG"]),
  energyLevel: z.enum(["LOW", "CHILL", "GOOD", "HIGH", "VERY_HIGH"]),
  crowdNote: z.string().max(100).optional(),
  userLocation: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

export interface SubmitReportContext {
  venueLocation: LatLng;
  lastReportAt: Date | null;
  now: Date;
  trustWeightAtSubmission: number;
  source: ReportSource;
}

export type SubmitReportResult =
  | {
      ok: true;
      report: {
        crowdLevel: CrowdLevel;
        waitLevel: WaitLevel;
        energyLevel: EnergyLevel;
        crowdNote: string | null;
        isVerifiedNearby: boolean;
        reportSource: ReportSource;
        trustWeightAtSubmission: number;
      };
    }
  | { ok: false; error: "COOLDOWN"; retryAfterMinutes: number }
  | { ok: false; error: "INVALID_INPUT"; message: string };

export function submitReport(rawInput: unknown, context: SubmitReportContext): SubmitReportResult {
  const parsed = reportInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid report" };
  }

  const cooldown = checkReportCooldown(context.lastReportAt, context.now);
  if (!cooldown.ok) {
    return { ok: false, error: "COOLDOWN", retryAfterMinutes: cooldown.retryAfterMinutes! };
  }

  const input = parsed.data;

  // Proximity is verified ephemerally and reduced to a boolean — the coordinate itself
  // is never persisted (spec's own privacy guidance, taken seriously rather than left
  // as a maybe: storing raw GPS "temporarily" tends to become storing it permanently).
  const isVerifiedNearby = input.userLocation
    ? isWithinRadius(input.userLocation, context.venueLocation, REPORT_PROXIMITY_RADIUS_METERS)
    : false;

  return {
    ok: true,
    report: {
      crowdLevel: input.crowdLevel,
      waitLevel: input.waitLevel,
      energyLevel: input.energyLevel,
      crowdNote: input.crowdNote?.trim() || null,
      isVerifiedNearby,
      reportSource: context.source,
      trustWeightAtSubmission: context.trustWeightAtSubmission,
    },
  };
}
