"use client";

import { useState } from "react";

export function ReconciliationActions({
  caseId,
  defaultOperator
}: {
  caseId: string;
  defaultOperator: string;
}) {
  const [resolutionSummary, setResolutionSummary] = useState("Projection aligned after replay review.");
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
    <div className="grid min-w-[13rem] gap-1.5 lg:grid-cols-[minmax(11rem,1fr)_auto] lg:items-start">
      <textarea
        aria-label="Resolution summary"
        rows={2}
        className="app-textarea w-full text-xs leading-5"
        value={resolutionSummary}
        onChange={(event) => setResolutionSummary(event.target.value)}
      />
      <button
        className="app-button px-2 py-1 text-xs lg:self-start"
        onClick={resolveCase}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Resolving..." : "Resolve"}
      </button>
    </div>
  );
}
