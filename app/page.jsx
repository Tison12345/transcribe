"use client";

import { useState } from "react";
import UploadBox from "./components/UploadBox";
import TranscriptViewer from "./components/TranscriptViewer";

export default function Home() {
  const [transcript, setTranscript] = useState(null);

  return (
    <main className="min-h-screen px-4 py-10" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto flex flex-col items-center gap-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Speaker-Aware Transcription
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            Upload an audio file or paste a YouTube URL — get a timestamped, speaker-labeled transcript.
          </p>
        </div>

        <UploadBox onTranscript={setTranscript} />

        {transcript && <TranscriptViewer transcript={transcript} />}

      </div>
    </main>
  );
}
