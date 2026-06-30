"use client";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceColor(source) {
  const colors = {
    BBC: "#ff4d2e",
    NPR: "#2bd97c",
    Reuters: "#4d9fff",
  };
  return colors[source] || "var(--text-mid)";
}

export default function ClusterDetail({ cluster, articles, loading, onClose }) {
  if (loading) {
    return (
      <div className="border border-[var(--border)] rounded-lg p-12 bg-[var(--surface)] flex items-center justify-center">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-mid)]">
          Loading…
        </span>
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="border border-[var(--border)] rounded-lg p-12 bg-[var(--surface)] flex flex-col items-center justify-center gap-2 text-center">
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-mid)]">
          Standby
        </span>
        <p className="text-sm text-[var(--text-dim)] max-w-xs">
          Click a cluster on the timeline to see its articles.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--text-mid)]">
          Dispatch
        </span>
        <button
          onClick={onClose}
          className="text-[var(--text-dim)] hover:text-[var(--text)] text-sm leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <h3 className="font-semibold text-base leading-snug">{cluster.label}</h3>
        <p className="font-mono text-[11px] text-[var(--text-mid)] mt-1">
          {articles.length} {articles.length === 1 ? "article" : "articles"}
        </p>
      </div>

      <div className="max-h-[420px] overflow-y-auto divide-y divide-[var(--border)]">
        {articles.map((a) => (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 hover:bg-[var(--surface-hover)] transition-colors border-l-2"
            style={{ borderLeftColor: sourceColor(a.source) }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="font-mono text-[10px] uppercase tracking-wide font-semibold"
                style={{ color: sourceColor(a.source) }}
              >
                {a.source}
              </span>
              <span className="font-mono text-[10px] text-[var(--text-mid)]">
                {formatDate(a.published_at)}
              </span>
            </div>
            <p className="text-sm leading-snug">{a.title}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
