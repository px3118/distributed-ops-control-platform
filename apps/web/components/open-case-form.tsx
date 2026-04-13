"use client";

import { useState } from "react";

export function OpenCaseForm() {
  const [title, setTitle] = useState("State mismatch requires review");
  const [description, setDescription] = useState("Opened by operator after manual verification detected an unresolved state mismatch.");
  const [openedBy, setOpenedBy] = useState("ops-operator");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function createCase() {
    setIsSubmitting(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/reconciliation-cases`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ title, description, openedBy })
    });
    window.location.reload();
  }

  return (
    <div className="mb-5 rounded border border-line bg-panelMuted p-3">
      <h3 className="mb-2 text-sm font-semibold">Open Reconciliation Case</h3>
      <p className="mb-3 text-xs text-fgMuted">Create a manual case when operator review is required outside automatic alert flow.</p>
      <div className="grid gap-3 md:grid-cols-6">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-xs text-fgMuted">Case Title</span>
          <input
            aria-label="Case title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border border-line bg-slate-900 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-3">
          <span className="text-xs text-fgMuted">Case Description</span>
          <textarea
            aria-label="Case description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="rounded border border-line bg-slate-900 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-1">
          <span className="text-xs text-fgMuted">Opened By</span>
          <input
            aria-label="Opened by"
            value={openedBy}
            onChange={(event) => setOpenedBy(event.target.value)}
            className="rounded border border-line bg-slate-900 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        className="mt-3 rounded border border-line bg-slate-800 px-3 py-1 text-sm"
        onClick={createCase}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create Case"}
      </button>
    </div>
  );
}
