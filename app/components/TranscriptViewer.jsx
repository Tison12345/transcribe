"use client";

import { useState, useMemo } from "react";

const SPEAKER_COLORS = [
  { bg: "#eeeeff", text: "#5b5bf6" },
  { bg: "#fef6e7", text: "#b97a10" },
  { bg: "#e4f7f3", text: "#1a8a72" },
  { bg: "#feeaed", text: "#c0324b" },
  { bg: "#f3eaff", text: "#7c3aed" },
  { bg: "#fff3e0", text: "#b45309" },
];

function speakerIndex(label) {
  const m = label?.match(/\d+/);
  return m ? parseInt(m[0]) % SPEAKER_COLORS.length : 0;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function download(content, filename, mime) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TranscriptViewer({ transcript }) {
  const [search, setSearch] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState("all");
  const [jsonView, setJsonView] = useState(false);

  const speakers = useMemo(() => {
    const map = {};
    for (const seg of transcript) {
      const s = seg.speaker || "Speaker 1";
      map[s] = (map[s] || 0) + 1;
    }
    return map;
  }, [transcript]);

  const filtered = useMemo(() => {
    return transcript.filter((seg) => {
      const matchSpeaker = activeSpeaker === "all" || seg.speaker === activeSpeaker;
      const matchSearch = !search || seg.text.toLowerCase().includes(search.toLowerCase());
      return matchSpeaker && matchSearch;
    });
  }, [transcript, activeSpeaker, search]);

  function exportTXT() {
    const text = transcript.map((s) =>
      `[${formatTime(s.start)} – ${formatTime(s.end)}] ${s.speaker || "Speaker 1"}:\n${s.text.trim()}`
    ).join("\n\n");
    download(text, "transcript.txt", "text/plain");
  }

  function exportJSON() {
    download(JSON.stringify({ segments: transcript }, null, 2), "transcript.json", "application/json");
  }

  function exportSRT() {
    const srt = transcript.map((s, i) => {
      const fmt = (sec) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const sv = Math.floor(sec % 60);
        const ms = Math.round((sec % 1) * 1000);
        return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sv).padStart(2,"0")},${String(ms).padStart(3,"0")}`;
      };
      return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n[${s.speaker || "Speaker 1"}] ${s.text.trim()}`;
    }).join("\n\n");
    download(srt, "transcript.srt", "text/plain");
  }

  const totalWords = transcript.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0);
  const duration = transcript.length ? transcript[transcript.length - 1].end : 0;

  return (
    <div className="w-full flex flex-col gap-4">

      {/* Stats bar */}
      <div
        className="rounded-xl px-5 py-3 flex gap-6 flex-wrap"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {[
          ["Duration", formatTime(duration)],
          ["Segments", transcript.length],
          ["Words", totalWords],
          ["Speakers", Object.keys(speakers).length],
        ].map(([label, val]) => (
          <div key={label} className="flex flex-col">
            <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
            <span className="text-lg font-bold font-mono" style={{ color: "var(--text)" }}>{val}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4">

        {/* Sidebar */}
        <div
          className="w-48 shrink-0 rounded-xl flex flex-col gap-1 p-3"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs uppercase tracking-wider font-medium px-2 mb-1" style={{ color: "var(--text-muted)" }}>
            Filter
          </p>
          <button
            onClick={() => setActiveSpeaker("all")}
            className="text-left text-sm px-2 py-1.5 rounded-lg font-medium transition-colors"
            style={{
              background: activeSpeaker === "all" ? "var(--accent-bg)" : "transparent",
              color: activeSpeaker === "all" ? "var(--accent)" : "var(--text)",
            }}
          >
            All Speakers
          </button>
          {Object.entries(speakers).map(([sp, count]) => {
            const c = SPEAKER_COLORS[speakerIndex(sp)];
            const active = activeSpeaker === sp;
            return (
              <button
                key={sp}
                onClick={() => setActiveSpeaker(sp)}
                className="text-left text-sm px-2 py-1.5 rounded-lg flex justify-between items-center transition-colors"
                style={{
                  background: active ? c.bg : "transparent",
                  color: active ? c.text : "var(--text)",
                }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.text }} />
                  {sp}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{count}</span>
              </button>
            );
          })}

          <div className="mt-auto pt-3 flex flex-col gap-1" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs uppercase tracking-wider font-medium px-2 mb-1" style={{ color: "var(--text-muted)" }}>
              Export
            </p>
            {[["TXT", exportTXT], ["JSON", exportJSON], ["SRT", exportSRT]].map(([lbl, fn]) => (
              <button
                key={lbl}
                onClick={fn}
                className="text-left text-sm px-2 py-1.5 rounded-lg font-mono transition-colors"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                ↓ {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div
          className="flex-1 rounded-xl flex flex-col overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {/* Toolbar */}
          <div className="flex gap-2 p-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <input
              type="text"
              placeholder="Search transcript…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <button
              onClick={() => setJsonView((v) => !v)}
              className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: jsonView ? "var(--text)" : "var(--bg)",
                color: jsonView ? "white" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {"{ }"}
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[520px] p-3 flex flex-col gap-2">
            {jsonView ? (
              <pre
                className="text-xs font-mono p-4 rounded-lg overflow-x-auto"
                style={{ background: "var(--text)", color: "#86efac" }}
              >
                {JSON.stringify({ segments: filtered }, null, 2)}
              </pre>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                No segments match your search.
              </p>
            ) : (
              filtered.map((seg, i) => {
                const sp = seg.speaker || "Speaker 1";
                const c = SPEAKER_COLORS[speakerIndex(sp)];
                return (
                  <div
                    key={i}
                    className="flex gap-3 rounded-lg px-3 py-2.5 transition-colors"
                    style={{ border: "1px solid transparent" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div className="flex flex-col items-end gap-1 shrink-0 w-16 pt-0.5">
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                        {formatTime(seg.start)}
                      </span>
                      <div className="w-px flex-1 mx-auto" style={{ background: "var(--border)" }} />
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
                        {formatTime(seg.end)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mb-1"
                        style={{ background: c.bg, color: c.text }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.text }} />
                        {sp}
                      </span>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                        {seg.text.trim()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
