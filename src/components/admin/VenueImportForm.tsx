"use client";

import { useRef, useState } from "react";
import { requestJson } from "@/lib/http/requestJson";
import { CSV_TEMPLATE_HEADER } from "@/lib/venues/importParser";
import { IMPORT_MAX_ROWS } from "@/config/constants";

type RowStatus = "added" | "skipped_duplicate" | "failed_geocode" | "invalid";
interface RowResult {
  row: number;
  name: string;
  status: RowStatus;
  detail?: string;
}

const STATUS_LABEL: Record<RowStatus, string> = {
  added: "Added",
  skipped_duplicate: "Already exists",
  failed_geocode: "Couldn't geocode",
  invalid: "Invalid",
};

const STATUS_CLASS: Record<RowStatus, string> = {
  added: "badge-high",
  skipped_duplicate: "",
  failed_geocode: "badge-low",
  invalid: "badge-low",
};

export function VenueImportForm() {
  const [pasteText, setPasteText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"paste" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(mode: "paste" | "csv") {
    const raw = mode === "paste" ? pasteText : csvText;
    if (!raw.trim()) return;
    setSubmitting(mode);
    setError(null);
    setResults(null);
    const result = await requestJson<{ results: RowResult[] }>("/api/admin/venues/import", { method: "POST", body: { mode, raw } });
    setSubmitting(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setResults(result.data.results);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    file.text().then(setCsvText);
  }

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_HEADER + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pulse-venue-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-2">Paste a list</h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          One venue per line: <code>Name | Address | Venue Type | Neighborhood</code>
        </p>
        <textarea
          className="input"
          rows={8}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"The Wren | 369 Rivington St, New York, NY | BAR | Lower East Side"}
        />
        <button className="btn btn-primary mt-3" disabled={!pasteText.trim() || submitting !== null} onClick={() => submit("paste")}>
          {submitting === "paste" ? "Importing…" : "Import list"}
        </button>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-2">Upload CSV</h3>
        <p className="text-[13px] text-[var(--text-secondary)] mb-3">
          Header row required (name, address, venueType, neighborhood, website, instagramHandle, priceLevel, musicType, plus optional
          per-day hours columns).
        </p>
        <div className="flex items-center gap-3 mb-3">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="input" />
          <button className="btn btn-ghost btn-sm" type="button" onClick={downloadTemplate}>
            Download template
          </button>
        </div>
        {csvFileName && <p className="text-[12px] text-[var(--text-muted)] mb-3">Loaded: {csvFileName}</p>}
        <button className="btn btn-primary" disabled={!csvText.trim() || submitting !== null} onClick={() => submit("csv")}>
          {submitting === "csv" ? "Importing…" : "Import CSV"}
        </button>
      </section>

      {submitting && (
        <p className="text-[13px] text-[var(--text-secondary)]">
          Importing up to {IMPORT_MAX_ROWS} venues — this can take about a minute (geocoding is rate-limited). Don&apos;t navigate away.
        </p>
      )}

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      {results && (
        <section>
          <h3 className="mb-2">Results</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>{r.name || "—"}</td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                    </td>
                    <td className="text-[12px] text-[var(--text-muted)]">{r.detail ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
