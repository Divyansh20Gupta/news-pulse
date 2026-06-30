"use client";

export default function SourceFilter({ allSources, activeSources, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {allSources.map((source) => {
        const active = activeSources.includes(source);
        return (
          <button
            key={source}
            onClick={() => onToggle(source)}
            className={`font-mono px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide border rounded transition-all ${
              active
                ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent-text)]"
                : "bg-transparent border-[var(--border)] text-[var(--text-mid)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
            }`}
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              style={{ background: active ? "var(--accent)" : "var(--border-strong)" }}
            />
            {source}
          </button>
        );
      })}
    </div>
  );
}
