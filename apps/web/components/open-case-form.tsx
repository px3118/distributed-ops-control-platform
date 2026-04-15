"use client";

import { useState } from "react";

export function OpenCaseForm() {
  const [title, setTitle] = useState("Manual reconciliation review");
  const [description, setDescription] = useState("Operator review opened due to unresolved state mismatch.");
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
    <div className="rounded border border-line bg-panelMuted p-3">
      <h3 className="mb-2 text-sm font-semibold">Open Reconciliation Case</h3>
      <p className="mb-3 text-xs text-fgMuted">
        Create a manual case when an operator needs to investigate drift outside alert automation.
      </p>
      <div className="grid gap-3 lg:grid-cols-12">
        <label className="flex flex-col gap-1 lg:col-span-3">
          <span className="text-left text-xs text-fgMuted">Case Title</span>
          <input
            aria-label="Case title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="app-control"
          />
        </label>
        <label className="flex flex-col gap-1 lg:col-span-5">
          <span className="text-left text-xs text-fgMuted">Case Description</span>
          <textarea
            aria-label="Case description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="app-textarea resize-y"
          />
        </label>
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-left text-xs text-fgMuted">Opened By</span>
          <input
            aria-label="Opened by"
            value={openedBy}
            onChange={(event) => setOpenedBy(event.target.value)}
            className="app-control"
          />
        </label>
        <div className="lg:col-span-2 lg:flex lg:items-end lg:justify-end">
          <button
            className="app-button h-fit w-full px-3 py-2 text-sm lg:w-auto"
            onClick={createCase}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Case"}
          </button>
        </div>
      </div>
    </div>
  );
}
