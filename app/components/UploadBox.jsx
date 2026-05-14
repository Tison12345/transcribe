"use client";

import { useState, useRef } from "react";

const STEPS = [
  "Preparing audio…",
  "Sending to transcription engine…",
  "Transcribing speech…",
  "Done!",
];

const ACCEPTED = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/m4a",
  "audio/flac", "audio/ogg", "audio/webm", "video/mp4", "video/webm",
];
const MAX_MB = 200;

export default function UploadBox({ onTranscript }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function validateFile(f) {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a|flac|ogg|webm|mp4)$/i)) {
      return "Unsupported file type. Use MP3, WAV, M4A, FLAC, OGG, or WebM.";
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return `File exceeds ${MAX_MB} MB limit.`;
    }
    return null;
  }

  function pickFile(f) {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError("");
    setFile(f);
    setUrl("");
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function handleSubmit() {
    if (!file && !url.trim()) {
      setError("Please upload a file or paste a YouTube URL.");
      return;
    }
    setError("");
    setLoading(true);
    setStep(0);

    const formData = new FormData();
    if (file) formData.append("file", file);
    else formData.append("url", url.trim());

    try {
      setStep(1);
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      setStep(2);
      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Transcription failed.");
        return;
      }

      setStep(3);
      onTranscript(data.transcript);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !loading && (!!file || !!url.trim());

  return (
    <div
      className="w-full rounded-2xl p-6 flex flex-col gap-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Drop zone */}
      <div
        onClick={() => !loading && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        className="rounded-xl flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors"
        style={{
          border: `2px dashed ${dragging ? "#5b5bf6" : file ? "var(--teal)" : "var(--border)"}`,
          background: dragging ? "var(--accent-bg)" : file ? "var(--teal-bg)" : "var(--bg)",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files[0] && pickFile(e.target.files[0])}
        />
        {file ? (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="font-medium text-sm" style={{ color: "var(--text)" }}>{file.name}</p>
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {(file.size / (1024 * 1024)).toFixed(1)} MB
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="text-xs mt-1 underline"
              style={{ color: "var(--text-muted)" }}
            >
              Remove
            </button>
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V8m0 0l-3 3m3-3l3 3M20 16.7A5 5 0 0017 7h-1.26A8 8 0 104 15.25"
                stroke="#5b5bf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
              {dragging ? "Drop it here!" : "Drag & drop audio, or click to browse"}
            </p>
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              MP3 · WAV · M4A · FLAC · up to {MAX_MB} MB
            </p>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>OR</span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* YouTube URL */}
      <div>
        <label className="text-xs font-medium uppercase tracking-wider mb-1 block"
          style={{ color: "var(--text-muted)" }}>
          YouTube URL
        </label>
        <input
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={url}
          disabled={loading}
          onChange={(e) => { setUrl(e.target.value); setFile(null); setError(""); }}
          className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none transition-colors"
          style={{
            background: "var(--bg)",
            border: `1px solid ${url ? "var(--accent)" : "var(--border)"}`,
            color: "var(--text)",
          }}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm rounded-lg px-3 py-2"
          style={{ background: "var(--rose-bg)", color: "var(--rose)" }}>
          {error}
        </p>
      )}

      {/* Progress */}
      {loading && (
        <div className="flex flex-col gap-2">
          <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%`, background: "var(--accent)" }}
            />
          </div>
          <p className="text-xs text-center font-mono" style={{ color: "var(--text-muted)" }}>
            {STEPS[step]}
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity"
        style={{
          background: canSubmit ? "var(--text)" : "var(--border)",
          color: canSubmit ? "white" : "var(--text-muted)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Transcribing…" : "Transcribe →"}
      </button>
    </div>
  );
}
