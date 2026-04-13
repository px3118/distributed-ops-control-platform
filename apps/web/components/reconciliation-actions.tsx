"use client";

import { useState } from "react";

export function ReconciliationActions({
  caseId,
  defaultOperator
}: {
  caseId: string;
  defaultOperator: string;
}) {
  const [resolutionSummary, setResolutionSummary] = useState("Projection aligned after review.");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function resolveCase() {
    setIsSubmitting(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/reconciliation-cases/${caseId}/resolve`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        resolvedBy: defaultOperator,
        resolutionSummary
      })
    });
    window.location.reload();
  }

  return (
    <div className="grid min-w-[22rem] gap-2 md:grid-cols-[minmax(18rem,1fr)_auto] md:items-start">
      <textarea
        aria-label="Resolution summary"
        rows={2}
        className="w-full rounded border border-line bg-slate-900 px-2 py-1 text-xs"
        value={resolutionSummary}
        onChange={(event) => setResolutionSummary(event.target.value)}
      />
      <button
        className="rounded border border-line bg-slate-800 px-2 py-1 text-xs md:self-start"
        onClick={resolveCase}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Resolving..." : "Resolve Case"}
      </button>
    </div>
  );
}
