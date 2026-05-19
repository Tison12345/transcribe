"use client";

import { useState, useRef, useEffect } from "react";

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

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getSupportedMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
}

export default function RecordBox({ onTranscript }) {
  const [recState, setRecState] = useState("idle"); // idle | recording | paused | stopped
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [language, setLanguage] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const canvasRef = useRef(null);

  // Duration timer
  useEffect(() => {
    if (recState === "recording") {
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recState]);

  // Waveform animation
  useEffect(() => {
    if (recState === "recording" && analyserRef.current && canvasRef.current) {
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const data = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        animFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(data);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "var(--rose)";
        ctx.beginPath();
        const sliceWidth = canvas.width / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const y = (data[i] / 128.0) * (canvas.height / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
      draw();
    } else {
      cancelAnimationFrame(animFrameRef.current);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // Draw flat line when idle/paused
        ctx.lineWidth = 1;
        ctx.strokeStyle = "var(--border)";
        ctx.beginPath();
        ctx.moveTo(0, canvasRef.current.height / 2);
        ctx.lineTo(canvasRef.current.width, canvasRef.current.height / 2);
        ctx.stroke();
      }
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [recState]);

  async function startRecording() {
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      chunksRef.current = [];
      setDuration(0);
      setAudioBlob(null);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close();
      };

      mr.start(500);
      setRecState("recording");
    } catch (e) {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }

  function pauseRecording() {
    mediaRecorderRef.current?.pause();
    setRecState("paused");
  }

  function resumeRecording() {
    mediaRecorderRef.current?.resume();
    setRecState("recording");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecState("stopped");
  }

  function resetRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioBlob(null);
    setDuration(0);
    setProgress(0);
    setProgressMsg("");
    setError("");
    setLoading(false);
    setRecState("idle");
  }

  function downloadRecording() {
    if (!audioUrl) return;
    const mime = getSupportedMimeType();
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm";
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `recording-${Date.now()}.${ext}`;
    a.click();
  }

  async function transcribeRecording() {
    if (!audioBlob) return;
    setLoading(true);
    setProgress(0);
    setProgressMsg("Starting...");
    setError("");

    const mime = getSupportedMimeType();
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mp4") ? "mp4" : "webm";
    const file = new File([audioBlob], `recording.${ext}`, { type: audioBlob.type });
    const formData = new FormData();
    formData.append("file", file);
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
          const eventType = lines.find((l) => l.startsWith("event:"))?.slice(7).trim() ?? "message";
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          let data;
          try { data = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

          if (eventType === "progress") {
            setProgress(data.pct);
            setProgressMsg(data.msg);
          } else if (eventType === "result") {
            setProgress(100);
            setProgressMsg("Done!");
            onTranscript(data.segments, "Recording");
            setTimeout(() => {
              setLoading(false);
              setProgress(0);
              setProgressMsg("");
            }, 800);
          } else if (eventType === "error") {
            setError(data.message);
            setLoading(false);
          }
        }
      }
    } catch (e) {
      setError("Network error: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div
      className="w-full rounded-2xl p-6 flex flex-col gap-5"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {/* Waveform */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", height: "72px" }}
      >
        {recState === "idle" ? (
          <div className="h-full flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                stroke="var(--text-muted)" strokeWidth="2" strokeLinejoin="round" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"
                stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Tap Start to begin recording
            </span>
          </div>
        ) : (
          <canvas ref={canvasRef} width={600} height={72} style={{ width: "100%", height: "72px" }} />
        )}
      </div>

      {/* Timer */}
      <div className="flex items-center justify-center gap-3">
        <span
          className="text-4xl font-mono font-bold tabular-nums"
          style={{ color: recState === "recording" ? "var(--rose)" : "var(--text)" }}
        >
          {fmtTime(duration)}
        </span>
        {recState === "recording" && (
          <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: "var(--rose)" }} />
        )}
        {recState === "paused" && (
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--bg)", color: "var(--text-muted)" }}>
            PAUSED
          </span>
        )}
        {recState === "stopped" && (
          <span className="text-xs font-mono px-2 py-0.5 rounded"
            style={{ background: "var(--teal-bg)", color: "var(--teal)" }}>
            RECORDED
          </span>
        )}
      </div>

      {/* Controls */}
      {recState === "idle" && (
        <button
          onClick={startRecording}
          className="w-full py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "var(--rose)", color: "white" }}
        >
          ● Start Recording
        </button>
      )}

      {(recState === "recording" || recState === "paused") && (
        <div className="flex gap-2">
          {recState === "recording" ? (
            <button
              onClick={pauseRecording}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              ⏸ Pause
            </button>
          ) : (
            <button
              onClick={resumeRecording}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: "var(--rose)", color: "white" }}
            >
              ▶ Resume
            </button>
          )}
          <button
            onClick={stopRecording}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{ background: "var(--text)", color: "white" }}
          >
            ■ Stop
          </button>
        </div>
      )}

      {/* Post-recording: playback + actions */}
      {recState === "stopped" && audioUrl && (
        <>
          <audio controls src={audioUrl} className="w-full" style={{ borderRadius: "8px" }} />

          {/* Language */}
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
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Progress */}
          {loading && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {progressMsg}
                </span>
                <span className="text-sm font-bold font-mono"
                  style={{ color: progress === 100 ? "var(--teal)" : "var(--accent)" }}>
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

          <div className="flex gap-2">
            <button
              onClick={downloadRecording}
              disabled={loading}
              className="py-2.5 px-4 rounded-lg text-sm font-semibold"
              style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            >
              ↓ Download
            </button>
            <button
              onClick={transcribeRecording}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
              style={{
                background: loading ? "var(--border)" : "var(--text)",
                color: loading ? "var(--text-muted)" : "white",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? `Transcribing… ${progress}%` : "Transcribe →"}
            </button>
          </div>

          {!loading && (
            <button
              onClick={resetRecording}
              className="text-xs text-center underline"
              style={{ color: "var(--text-muted)" }}
            >
              Record again
            </button>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm rounded-lg px-3 py-2"
          style={{ background: "var(--rose-bg)", color: "var(--rose)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
