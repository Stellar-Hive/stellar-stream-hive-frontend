"use client";

import { useId } from "react";
import type { StreamStatus } from "@/types";

const STYLES: Record<StreamStatus, { label: string; description: string; className: string }> = {
  scheduled: {
    label: "Scheduled",
    description: "The start time hasn't arrived yet, so nothing has accrued.",
    className: "bg-accent/10 text-accent border-accent/30",
  },
  active: {
    label: "Active",
    description: "Funds are accruing and the recipient can withdraw them now.",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  cliff: {
    label: "Cliff pending",
    description: "Funds are accruing, but nothing can be withdrawn until the cliff date.",
    className: "bg-warning/10 text-warning border-warning/30",
  },
  cancelled: {
    label: "Cancelled",
    description: "The sender cancelled the stream early, so accrual stopped at that point.",
    className: "bg-danger/10 text-danger border-danger/30",
  },
  completed: {
    label: "Completed",
    description: "The end time has passed and the full amount has streamed.",
    className: "bg-muted/10 text-muted border-muted/30",
  },
};

export function StreamStatusBadge({ status }: { status: StreamStatus }) {
  const style = STYLES[status];
  const descriptionId = useId();
  return (
    <>
      <span
        title={style.description}
        aria-describedby={descriptionId}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.className}`}
      >
        {status === "active" && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-primary" />}
        {style.label}
      </span>
      <span id={descriptionId} className="sr-only">
        {style.description}
      </span>
    </>
  );
}
