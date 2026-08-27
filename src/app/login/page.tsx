"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Radio } from "lucide-react";
import { requestJson } from "@/lib/http/requestJson";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await requestJson("/api/auth/login", { method: "POST", body: { email, password } });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(searchParams.get("next") || "/map");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight mb-8 justify-center">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--hot)" }}>
            <Radio size={15} color="white" />
          </span>
          PULSE
        </div>
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-5">Log in</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="Email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <input
              type="password"
              required
              placeholder="Password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
            <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
              {loading ? "Logging in…" : "Log in"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-[var(--text-secondary)] mt-4">
          New here?{" "}
          <Link
            href={searchParams.get("next") ? `/signup?next=${encodeURIComponent(searchParams.get("next")!)}` : "/signup"}
            className="text-[var(--text)] font-medium"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
