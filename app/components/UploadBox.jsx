"use client";

import { useState, useRef } from "react";

const ACCEPTED = [
  "audio/mpeg", "audio/wav", "audio/mp4", "audio/m4a",
  "audio/flac", "audio/ogg", "audio/webm", "video/mp4", "video/webm",
];
const MAX_MB = 200;

const LANGUAGES = [
  { value: "auto", label: "Auto Detect" },
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
  { value: "hi", label: "Hindi" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ar", label: "Arabic" },
];

export default function UploadBox({ onTranscript }) {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("auto");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function validateFile(f) {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(mp3|wav|m4a|flac|ogg|webm|mp4)$/i))
      return "Unsupported file type. Use MP3, WAV, M4A, FLAC, OGG, or WebM.";
    if (f.size > MAX_MB * 1024 * 1024)
      return `File exceeds ${MAX_MB} MB limit.`;
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
    if (!file && !url.trim()) { setError("Please upload a file or paste a YouTube URL."); return; }
    setError("");
    setLoading(true);
    setProgress(0);
    setProgressMsg("Starting…");

    const sourceName = file ? file.name : url.trim();
    const formData = new FormData();
    if (file) formData.append("file", file);
    else formData.append("url", url.trim());
    formData.append("language", language);

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          const eventType = lines.find(l => l.startsWith("event:"))?.slice(7).trim() ?? "message";
          const dataLine = lines.find(l => l.startsWith("data:"));
          if (!dataLine) continue;

          let data;
          try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

          if (eventType === "progress") {
            setProgress(data.pct);
            setProgressMsg(data.msg);
          } else if (eventType === "result") {
            setProgress(100);
            setProgressMsg("Done!");
            onTranscript(data.segments, sourceName);
            setTimeout(() => {
              setLoading(false);
              setProgress(0);
              setProgressMsg("");
              setFile(null);
              setUrl("");
            }, 800);
          } else if (eventType === "error") {
            setError(data.message);
            setLoading(false);
          }
        }
      }
    } catch (err) {
      setError("Network error: " + err.message);
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
          className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none"
          style={{
            background: "var(--bg)",
            border: `1px solid ${url ? "var(--accent)" : "var(--border)"}`,
            color: "var(--text)",
          }}
        />
      </div>

      {/* Language selector */}
      <div>
        <label className="text-xs font-medium uppercase tracking-wider mb-1 block"
          style={{ color: "var(--text-muted)" }}>
          Language
        </label>
        <select
          value={language}
          disabled={loading}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none appearance-none"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        {language === "auto" && (
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Auto detect works well for most files. For YouTube in regional languages, pick the language manually.
          </p>
        )}
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
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              {progressMsg}
            </span>
            <span className="text-sm font-bold font-mono" style={{ color: progress === 100 ? "var(--teal)" : "var(--accent)" }}>
              {progress}%
            </span>
          </div>
          <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: progress === 100 ? "var(--teal)" : "var(--accent)",
              }}
            />
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full py-2.5 rounded-lg text-sm font-semibold"
        style={{
          background: canSubmit ? "var(--text)" : "var(--border)",
          color: canSubmit ? "white" : "var(--text-muted)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? `Transcribing… ${progress}%` : "Transcribe →"}
      </button>
    </div>
  );
}
