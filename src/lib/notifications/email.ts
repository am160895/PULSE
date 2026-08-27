// Free-tier email via Resend (https://resend.com) — no npm dependency needed, their API is
// a single POST. Requires two env vars this app doesn't set by default:
//   RESEND_API_KEY          — from the Resend dashboard, after signing up (free, no card)
//   CLAIM_NOTIFICATION_EMAIL — where claim alerts should land (kept out of source control
//                              deliberately — an operator's personal inbox has no business
//                              being a literal in a shared codebase)
// Neither is required for the app to run — every call here is best-effort and silently
// no-ops if unconfigured, since a missing notification must never break the claim request
// it's attached to.
const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendClaimNotificationEmail(params: {
  venueName: string;
  requesterDisplayName: string;
  requesterUsername: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CLAIM_NOTIFICATION_EMAIL;
  if (!apiKey || !to) return;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        // Resend's shared sending domain — works immediately with no DNS/domain
        // verification, which matters here since this is a single-purpose admin alert,
        // not transactional email to end users.
        from: "PULSE <onboarding@resend.dev>",
        to,
        subject: `New venue claim: ${params.venueName}`,
        text: `${params.requesterDisplayName} (@${params.requesterUsername}) requested to claim "${params.venueName}" on PULSE.\n\nReview it in the admin panel under Venues > Claims.`,
      }),
    });
    if (!res.ok) console.error("sendClaimNotificationEmail: Resend returned", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("sendClaimNotificationEmail failed:", err);
  }
}
