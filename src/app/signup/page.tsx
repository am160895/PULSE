"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio } from "lucide-react";
import { requestJson } from "@/lib/http/requestJson";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", displayName: "", username: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await requestJson("/api/auth/signup", { method: "POST", body: form });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/map");
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
          <h2 className="mb-4">Create your account</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input required placeholder="Display name" className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            <input
              required
              placeholder="Username"
              className="input"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
            />
            <input type="email" required placeholder="Email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Password (8+ characters)"
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
            {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
            <button type="submit" className="btn btn-primary mt-1" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-[var(--text-secondary)] mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--text)] font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
