"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, UserPlus, X } from "lucide-react";
import { useFriends } from "@/hooks/api";
import { EmptyState, LoadingDots } from "@/components/ui/States";
import { requestJson } from "@/lib/http/requestJson";

export function FriendsView() {
  const { data, isLoading, isError, refetch } = useFriends();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["friends"] });
  }

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const result = await requestJson("/api/friends/request", { method: "POST", body: { username } });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setUsername("");
    refresh();
  }

  async function respond(friendshipId: string, accept: boolean) {
    if (respondingTo) return; // one in flight at a time — avoids duplicate accept/decline from a double-click
    setRespondingTo(friendshipId);
    setError(null);
    const result = await requestJson("/api/friends/respond", { method: "POST", body: { friendshipId, accept } });
    setRespondingTo(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    refresh();
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <EmptyState
          title="Couldn't load Friends"
          body="Something went wrong reaching PULSE. Check your connection and try again."
          action={
            <button className="btn btn-secondary" onClick={() => refetch()}>
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-6">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-6 pb-10">
      <h1 className="mb-1">Friends</h1>
      <p className="text-[13px] text-[var(--text-secondary)] mb-6">
        Presence is opt-in and expires automatically — see Settings &gt; Privacy to change what you share.
      </p>

      <form onSubmit={sendRequest} className="flex gap-2 mb-6">
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Add by username" className="input" />
        <button className="btn btn-secondary" disabled={sending || !username.trim()}>
          <UserPlus size={15} />
        </button>
      </form>
      {error && <p className="text-sm mb-4" style={{ color: "var(--danger)" }}>{error}</p>}

      {data.presence.length > 0 && (
        <Section title="Nearby right now">
          {data.presence.map((p) => (
            <Row key={p.profileId}>
              <span className="font-medium">{p.displayName}</span>
              <span className="text-[var(--text-secondary)]">
                {presenceText(p.status)}
                {p.venueName ? (
                  <>
                    {" "}
                    at{" "}
                    <Link href={`/venue/${p.venueId}`} className="underline">
                      {p.venueName}
                    </Link>
                  </>
                ) : null}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {data.pendingIncoming.length > 0 && (
        <Section title="Requests">
          {data.pendingIncoming.map((r) => (
            <Row key={r.friendshipId}>
              <span className="font-medium">{r.profile.displayName}</span>
              <span className="flex gap-2">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => respond(r.friendshipId, true)}
                  disabled={respondingTo === r.friendshipId}
                  aria-label="Accept"
                >
                  <Check size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => respond(r.friendshipId, false)}
                  disabled={respondingTo === r.friendshipId}
                  aria-label="Decline"
                >
                  <X size={14} />
                </button>
              </span>
            </Row>
          ))}
        </Section>
      )}

      <Section title="Your friends">
        {data.friends.length === 0 ? (
          <EmptyState title="No friends yet" body="Add friends by username to see when they're out." />
        ) : (
          data.friends.map((f) => (
            <Row key={f.id}>
              <span className="font-medium">{f.displayName}</span>
              <span className="text-[13px] text-[var(--text-muted)]">@{f.username}</span>
            </Row>
          ))
        )}
      </Section>

      {data.pendingOutgoing.length > 0 && (
        <Section title="Pending">
          {data.pendingOutgoing.map((r) => (
            <Row key={r.friendshipId}>
              <span>{r.profile.displayName}</span>
              <span className="text-[13px] text-[var(--text-muted)]">Waiting</span>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2" style={{ fontSize: 15 }}>
        {title}
      </h2>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
        {children}
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-between px-4 py-3 text-[14px]">{children}</div>;
}

function presenceText(status: string): string {
  switch (status) {
    case "AT_VENUE":
      return "Here";
    case "HEADING_THERE":
      return "Heading";
    case "NEARBY":
      return "Nearby";
    default:
      return "Recently";
  }
}
