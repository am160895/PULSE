"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Perk } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { trackEvent } from "@/lib/analytics/track";

/** Server component (you/page.tsx) already filters to eligible-and-unredeemed perks —
 * this only needs to handle the redeem action and its own in-flight/error state. */
export function PerksSection({ perks }: { perks: Perk[] }) {
  const router = useRouter();
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (perks.length === 0) return null;

  async function handleRedeem(perk: Perk) {
    setRedeemingId(perk.id);
    setError(null);
    const result = await requestJson(`/api/perks/${perk.id}/redeem`, { method: "POST" });
    setRedeemingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    trackEvent("PERK_REDEEMED");
    router.refresh();
  }

  return (
    <section className="mb-6">
      <h3
        className="mb-2.5"
        style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--text-secondary)" }}
      >
        Perks
      </h3>
      <div className="flex flex-col gap-2">
        {perks.map((perk) => (
          <div key={perk.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{perk.title}</p>
                <p className="text-[12.5px] text-[var(--text-secondary)]">{perk.description}</p>
              </div>
              <button className="btn btn-secondary shrink-0" disabled={redeemingId === perk.id} onClick={() => handleRedeem(perk)}>
                {redeemingId === perk.id ? "…" : "Redeem"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-[13px]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </section>
  );
}
