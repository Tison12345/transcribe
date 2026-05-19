"use client";

import { useState } from "react";
import UploadBox from "./components/UploadBox";
import RecordBox from "./components/RecordBox";
import TranscriptViewer from "./components/TranscriptViewer";
import HistorySidebar from "./components/HistorySidebar";
import { useHistory } from "./hooks/useHistory";

const TABS = [
  {
    id: "upload",
    label: "Upload / YouTube",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 16V8m0 0l-3 3m3-3l3 3M20 16.7A5 5 0 0017 7h-1.26A8 8 0 104 15.25"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "record",
    label: "Record",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
          stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Home() {
  const [transcript, setTranscript] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("upload");
  const { history, addEntry, removeEntry } = useHistory();

  function onTranscript(segments, sourceName) {
    const id = addEntry(sourceName, segments);
    setTranscript(segments);
    setActiveId(id);
  }

  function loadFromHistory(entry) {
    setTranscript(entry.segments);
    setActiveId(entry.id);
  }

  return (
    <div className="flex" style={{ minHeight: "calc(100vh - 52px)" }}>
      <HistorySidebar
        history={history}
        onSelect={loadFromHistory}
        onDelete={removeEntry}
        activeId={activeId}
      />

      <main className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">

          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Speaker-Aware Transcription
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Upload a file, paste a YouTube URL, or record live — get a timestamped, speaker-labeled transcript.
            </p>
          </div>

          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 gap-1"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: active ? "var(--bg)" : "transparent",
                    color: active ? "var(--text)" : "var(--text-muted)",
                    border: active ? "1px solid var(--border)" : "1px solid transparent",
                    boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  }}
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "upload" && <UploadBox onTranscript={onTranscript} />}
          {tab === "record" && <RecordBox onTranscript={onTranscript} />}

          {transcript && <TranscriptViewer transcript={transcript} />}

        </div>
      </main>
    </div>
  );
}
