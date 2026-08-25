"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Venue, VenueType } from "@/types";
import { requestJson } from "@/lib/http/requestJson";
import { VENUE_TYPE_LABELS } from "@/config/constants";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayHours = { open: string; close: string; enabled: boolean };

interface FormState {
  name: string;
  category: string;
  subcategory: string;
  venueType: VenueType;
  neighborhood: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  website: string;
  instagramHandle: string;
  capacityEstimate: string;
  priceLevel: 1 | 2 | 3 | 4;
  musicType: string;
  isActive: boolean;
  hours: DayHours[];
}

function initialState(venue?: Venue): FormState {
  const hours: DayHours[] = DAY_LABELS.map((_, dayOfWeek) => {
    const existing = venue?.hours.find((h) => h.dayOfWeek === dayOfWeek);
    return existing
      ? { open: existing.openTime, close: existing.closeTime, enabled: true }
      : { open: "18:00", close: "02:00", enabled: false };
  });

  return {
    name: venue?.name ?? "",
    category: venue?.category ?? "Nightlife",
    subcategory: venue?.subcategory ?? "",
    venueType: venue?.venueType ?? "BAR",
    neighborhood: venue?.neighborhood ?? "",
    streetAddress: venue?.streetAddress ?? "",
    city: venue?.city ?? "New York",
    state: venue?.state ?? "NY",
    postalCode: venue?.postalCode ?? "",
    latitude: venue ? String(venue.latitude) : "",
    longitude: venue ? String(venue.longitude) : "",
    timezone: venue?.timezone ?? "America/New_York",
    website: venue?.website ?? "",
    instagramHandle: venue?.instagramHandle ?? "",
    capacityEstimate: venue?.capacityEstimate ? String(venue.capacityEstimate) : "",
    priceLevel: venue?.priceLevel ?? 2,
    musicType: venue?.musicType ?? "",
    isActive: venue?.isActive ?? true,
    hours,
  };
}

export function VenueForm({ venue }: { venue?: Venue }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(venue));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!venue;

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setDay(index: number, patch: Partial<DayHours>) {
    setForm((f) => ({ ...f, hours: f.hours.map((d, i) => (i === index ? { ...d, ...patch } : d)) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError("Latitude and longitude must be numbers");
      return;
    }

    const body = {
      name: form.name,
      category: form.category,
      subcategory: form.subcategory || null,
      venueType: form.venueType,
      neighborhood: form.neighborhood,
      streetAddress: form.streetAddress,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      latitude: lat,
      longitude: lng,
      timezone: form.timezone,
      website: form.website || null,
      instagramHandle: form.instagramHandle || null,
      capacityEstimate: form.capacityEstimate ? Number(form.capacityEstimate) : null,
      priceLevel: form.priceLevel,
      musicType: form.musicType || null,
      isActive: form.isActive,
      hours: form.hours
        .map((d, dayOfWeek) => ({ dayOfWeek, openTime: d.open, closeTime: d.close, enabled: d.enabled }))
        .filter((d) => d.enabled)
        .map(({ dayOfWeek, openTime, closeTime }) => ({ dayOfWeek, openTime, closeTime })),
    };

    setSaving(true);
    const result = isEdit
      ? await requestJson(`/api/admin/venues/${venue.id}`, { method: "PATCH", body })
      : await requestJson("/api/admin/venues", { method: "POST", body });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/venues");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <Section title="Basics">
        <Field label="Name">
          <input className="input" required value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Venue type">
            <select className="input" value={form.venueType} onChange={(e) => set("venueType", e.target.value as VenueType)}>
              {Object.entries(VENUE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <input className="input" value={form.category} onChange={(e) => set("category", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Music type">
            <input className="input" value={form.musicType} onChange={(e) => set("musicType", e.target.value)} />
          </Field>
          <Field label="Price level">
            <select className="input" value={form.priceLevel} onChange={(e) => set("priceLevel", Number(e.target.value) as 1 | 2 | 3 | 4)}>
              {[1, 2, 3, 4].map((p) => (
                <option key={p} value={p}>
                  {"$".repeat(p)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          Active (visible on the map)
        </label>
      </Section>

      <Section title="Location">
        <Field label="Neighborhood">
          <input className="input" required value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
        </Field>
        <Field label="Street address">
          <input className="input" required value={form.streetAddress} onChange={(e) => set("streetAddress", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City">
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State">
            <input className="input" value={form.state} onChange={(e) => set("state", e.target.value)} />
          </Field>
          <Field label="Postal code">
            <input className="input" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input className="input" required value={form.latitude} onChange={(e) => set("latitude", e.target.value)} />
          </Field>
          <Field label="Longitude">
            <input className="input" required value={form.longitude} onChange={(e) => set("longitude", e.target.value)} />
          </Field>
        </div>
        <Field label="Timezone">
          <input className="input" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </Field>
      </Section>

      <Section title="Hours">
        <div className="flex flex-col gap-2">
          {DAY_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <label className="flex items-center gap-2 w-20 text-[13px]">
                <input type="checkbox" checked={form.hours[i].enabled} onChange={(e) => setDay(i, { enabled: e.target.checked })} />
                {label}
              </label>
              <input
                type="time"
                className="input"
                disabled={!form.hours[i].enabled}
                value={form.hours[i].open}
                onChange={(e) => setDay(i, { open: e.target.value })}
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="time"
                className="input"
                disabled={!form.hours[i].enabled}
                value={form.hours[i].close}
                onChange={(e) => setDay(i, { close: e.target.value })}
              />
            </div>
          ))}
          <p className="text-[12px] text-[var(--text-muted)]">
            Close time before open time means it crosses midnight (e.g. 22:00 → 02:00).
          </p>
        </div>
      </Section>

      <Section title="Extra">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Website">
            <input className="input" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Instagram">
            <input className="input" value={form.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} placeholder="@handle" />
          </Field>
        </div>
        <Field label="Capacity estimate">
          <input className="input" value={form.capacityEstimate} onChange={(e) => set("capacityEstimate", e.target.value)} />
        </Field>
      </Section>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create venue"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <h3 className="mb-3">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  );
}
