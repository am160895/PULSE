// Free-tier email via Resend (https://resend.com) — no npm dependency needed, their API is
// a single POST. Requires one env var this app doesn't set by default:
//   RESEND_API_KEY — from the Resend dashboard, after signing up (free, no card)
// CLAIM_NOTIFICATION_EMAIL (where claim alerts land) is also required for that specific
// email — kept out of source control deliberately, an operator's personal inbox has no
// business being a literal in a shared codebase.
//
// Sending domain: "onboarding@resend.dev" is Resend's shared sandbox sender — it works
// immediately with no DNS setup, but (per Resend's own restriction) can only deliver to
// the email address the Resend ACCOUNT ITSELF was created with. That's fine for
// sendClaimNotificationEmail (always sent to the operator, i.e. the account owner), but
// sendWelcomeEmail goes to arbitrary new users' signup addresses — those sends will be
// rejected until a real domain is verified in the Resend dashboard (still free, just
// requires owning a domain and adding the DNS records Resend provides).
//
// Every function here is best-effort and silently no-ops if RESEND_API_KEY isn't set, since
// a missing/failed notification must never break the request it's attached to.
const RESEND_API_URL = "https://api.resend.com/emails";

async function sendViaResend(params: { to: string; subject: string; text: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "PULSE <onboarding@resend.dev>", to: params.to, subject: params.subject, text: params.text }),
    });
    if (!res.ok) console.error("sendViaResend: Resend returned", res.status, await res.text().catch(() => ""));
  } catch (err) {
    console.error("sendViaResend failed:", err);
  }
}

export async function sendClaimNotificationEmail(params: {
  venueName: string;
  requesterDisplayName: string;
  requesterUsername: string;
}): Promise<void> {
  const to = process.env.CLAIM_NOTIFICATION_EMAIL;
  if (!to) return;
  await sendViaResend({
    to,
    subject: `New venue claim: ${params.venueName}`,
    text: `${params.requesterDisplayName} (@${params.requesterUsername}) requested to claim "${params.venueName}" on PULSE.\n\nReview it in the admin panel under Venues > Claims.`,
  });
}

export async function sendWelcomeEmail(to: string, displayName: string): Promise<void> {
  await sendViaResend({
    to,
    subject: "Welcome to PULSE",
    text: `Hey ${displayName},\n\nWelcome to PULSE — know where the night is happening, in real time.\n\nOpen the map, report what you're seeing, and start earning XP for accurate signals.\n\nSee you out there.`,
  });
}
