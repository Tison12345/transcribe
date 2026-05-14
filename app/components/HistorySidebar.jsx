"use client";

function relativeTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmt(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function HistorySidebar({ history, onSelect, onDelete, activeId }) {
  return (
    <aside
      className="shrink-0 flex flex-col overflow-hidden"
      style={{
        width: "220px",
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: "52px",
        height: "calc(100vh - 52px)",
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <p className="text-xs uppercase tracking-wider font-semibold"
          style={{ color: "var(--text-muted)" }}>
          History
        </p>
        {history.length > 0 && (
          <span className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
            {history.length}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 px-4 text-center">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="var(--bg)" />
              <path d="M10 16 Q12 11 14 16 Q16 21 18 16 Q20 11 22 16"
                stroke="var(--border)" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Transcripts will appear here after processing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {history.map((entry) => {
              const isActive = activeId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="group relative rounded-lg px-3 py-2.5 cursor-pointer"
                  style={{
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    transition: "background 150ms",
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--bg)"; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
                  onClick={() => onSelect(entry)}
                >
                  {/* Filename */}
                  <p
                    className="text-sm font-medium truncate pr-5 leading-tight"
                    style={{ color: isActive ? "var(--accent)" : "var(--text)" }}
                    title={entry.name}
                  >
                    {entry.name}
                  </p>

                  {/* Meta row */}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {relativeTime(entry.date)}
                    </span>
                    <span style={{ color: "var(--border)" }}>·</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {fmt(entry.duration)}
                    </span>
                    <span style={{ color: "var(--border)" }}>·</span>
                    <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                      {entry.speakerCount} spk
                    </span>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                    style={{ color: "var(--text-muted)", background: "var(--bg)" }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
