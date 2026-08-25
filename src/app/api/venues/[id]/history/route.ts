import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getVenueById, listBaselinesForVenue, listSnapshotHistory } from "@/lib/data/repository";
import { calculateHistoricalSignal } from "@/lib/pulse/signals/historicalBaseline";

const FORECAST_OFFSETS_MIN = [15, 30, 45, 60, 75, 90, 105, 120];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const venue = await getVenueById(id);
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

  const now = new Date();
  const [history, baselines] = await Promise.all([listSnapshotHistory(id, 180), listBaselinesForVenue(id)]);
  const past = history
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .map((s) => ({ time: s.capturedAt, score: s.pulseScore }));

  // Forecast is the historical-baseline curve only — we can't know future live reports,
  // so this is explicitly "what's typical," not a prediction of this specific night.
  const forecast = FORECAST_OFFSETS_MIN.map((minutes) => {
    const time = new Date(now.getTime() + minutes * 60_000);
    const { historicalScore } = calculateHistoricalSignal(baselines, time, venue.timezone);
    return { time: time.toISOString(), score: Math.round(historicalScore) };
  });

  return NextResponse.json({ past, forecast });
}
