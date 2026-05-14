"use client";

import { useState } from "react";
import UploadBox from "./components/UploadBox";
import TranscriptViewer from "./components/TranscriptViewer";
import HistorySidebar from "./components/HistorySidebar";
import { useHistory } from "./hooks/useHistory";

export default function Home() {
  const [transcript, setTranscript] = useState(null);
  const [activeId, setActiveId] = useState(null);
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
              Upload an audio file or paste a YouTube URL — get a timestamped, speaker-labeled transcript.
            </p>
          </div>

          <UploadBox onTranscript={onTranscript} />

          {transcript && <TranscriptViewer transcript={transcript} />}

        </div>
      </main>
    </div>
  );
}
