"use client";

import { useMemo, useState } from "react";

import type { GearImportCommitResult, GearImportMode, GearImportPreview } from "@/lib/gear-bulk-ops";

type ImportResponse =
  | { ok: true; preview: GearImportPreview }
  | { ok: false; error: string };

type CommitResponse =
  | { ok: true; result: GearImportCommitResult }
  | { ok: false; error: string };

async function readFileAsText(file: File) {
  return file.text();
}

export function GearBulkOperationsPanel() {
  const [csvText, setCsvText] = useState("");
  const [mode, setMode] = useState<GearImportMode>("CREATE_ONLY");
  const [preview, setPreview] = useState<GearImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<GearImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);

  const canCommit = useMemo(() => Boolean(preview && preview.issues.length === 0 && preview.rows.length > 0), [preview]);

  async function runPreview() {
    setLoading("preview");
    setError(null);
    setCommitResult(null);

    try {
      const response = await fetch("/gear-ops/bulk/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode }),
      });

      const body = (await response.json()) as ImportResponse;
      if (!response.ok || !body.ok) {
        setError(body.ok ? "Unable to preview import." : body.error);
        setPreview(null);
        return;
      }

      setPreview(body.preview);
    } catch {
      setError("Unable to preview import right now.");
      setPreview(null);
    } finally {
      setLoading(null);
    }
  }

  async function runCommit() {
    if (!canCommit) {
      return;
    }

    setLoading("commit");
    setError(null);

    try {
      const response = await fetch("/gear-ops/bulk/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, mode }),
      });

      const body = (await response.json()) as CommitResponse;
      if (!response.ok || !body.ok) {
        setError(body.ok ? "Unable to commit import." : body.error);
        return;
      }

      setCommitResult(body.result);
    } catch {
      setError("Unable to commit import right now.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Import inventory CSV</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload or paste a CSV, preview validation results, then commit when safe.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <label htmlFor="gear-csv" className="text-sm font-medium">
            CSV payload
          </label>
          <textarea
            id="gear-csv"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            rows={12}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono"
            placeholder="item_name,category,serial_number,asset_tag,location,..."
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="gear-import-mode" className="text-sm font-medium">
              Create/update behavior
            </label>
            <select
              id="gear-import-mode"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as GearImportMode);
                setPreview(null);
                setCommitResult(null);
              }}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="CREATE_ONLY">Create only</option>
              <option value="CREATE_OR_UPDATE">Create or update existing identifiers</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="gear-csv-file" className="text-sm font-medium">
              Upload .csv
            </label>
            <input
              id="gear-csv-file"
              type="file"
              accept=".csv,text/csv"
              className="w-full rounded-md border px-2 py-1.5 text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                const text = await readFileAsText(file);
                setCsvText(text);
                setPreview(null);
                setCommitResult(null);
                setError(null);
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={loading !== null || csvText.trim().length === 0}
            className="w-full rounded-md bg-black px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {loading === "preview" ? "Previewing..." : "Preview import"}
          </button>

          <button
            type="button"
            onClick={() => void runCommit()}
            disabled={loading !== null || !canCommit}
            className="w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "commit" ? "Committing..." : "Commit import"}
          </button>
        </div>
      </div>

      {error ? <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {preview ? (
        <div className="space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Preview summary</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Rows: {preview.rowCount} · Create: {preview.createCount} · Update: {preview.updateCount}
          </p>

          {preview.issues.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              {preview.issues.map((issue, index) => (
                <li key={`${issue.rowNumber}-${issue.field}-${index}`}>
                  Row {issue.rowNumber || "—"} · {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Preview is valid and safe to commit.
            </p>
          )}

          {preview.warnings.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900">
              {preview.warnings.map((warning, index) => (
                <li key={`${warning.rowNumber}-${warning.field}-${index}`}>
                  Row {warning.rowNumber || "—"} · {warning.field}: {warning.message}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full divide-y text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-2 py-1 text-left">Row</th>
                  <th className="px-2 py-1 text-left">Action</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Identifier</th>
                  <th className="px-2 py-1 text-left">Type</th>
                  <th className="px-2 py-1 text-left">Qty</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={`${row.rowNumber}-${row.identifier}`} className="border-t">
                    <td className="px-2 py-1">{row.rowNumber}</td>
                    <td className="px-2 py-1">{row.action}</td>
                    <td className="px-2 py-1">{row.itemName}</td>
                    <td className="px-2 py-1 font-mono">{row.identifier}</td>
                    <td className="px-2 py-1">{row.inventoryType}</td>
                    <td className="px-2 py-1">{row.quantityOnHand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {commitResult ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Import committed. Created {commitResult.createdCount} and updated {commitResult.updatedCount} rows.
        </p>
      ) : null}
    </div>
  );
}
