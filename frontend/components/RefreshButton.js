"use client";

import { useState, useRef } from "react";
import { api } from "../lib/api";

export default function RefreshButton({ onComplete }) {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const pollRef = useRef(null);

  async function handleClick() {
    setStatus("running");
    try {
      const { jobId } = await api.triggerIngest();
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.getIngestStatus(jobId);
          if (job.status === "done") {
            clearInterval(pollRef.current);
            setStatus("done");
            onComplete();
            setTimeout(() => setStatus("idle"), 2000);
          } else if (job.status === "error") {
            clearInterval(pollRef.current);
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
          }
        } catch {
          clearInterval(pollRef.current);
          setStatus("error");
        }
      }, 2500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const labels = {
    idle: "Refresh data",
    running: "Pulling…",
    done: "Updated",
    error: "Failed — retry",
  };

  const dotColor = {
    idle: "var(--text-mid)",
    running: "var(--accent)",
    done: "var(--wire-green)",
    error: "#e2433e",
  };

  return (
    <button
      onClick={handleClick}
      disabled={status === "running"}
      className="flex items-center gap-2 font-mono px-4 py-2 rounded border border-[var(--border-strong)] text-[11px] uppercase tracking-wide font-medium bg-[var(--surface)] hover:bg-[var(--surface-hover)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${status === "running" ? "pulse-dot" : ""}`}
        style={{ background: dotColor[status] }}
      />
      {labels[status]}
    </button>
  );
}
