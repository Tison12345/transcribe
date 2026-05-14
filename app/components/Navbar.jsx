export default function Navbar() {
  return (
    <nav
      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      className="sticky top-0 z-10 px-6 py-3"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="7" fill="#5b5bf6" />
            <path d="M7 14 Q9 9 11 14 Q13 19 15 14 Q17 9 19 14 Q21 19 21 14"
              stroke="white" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
          <span className="font-bold text-lg tracking-tight" style={{ color: "var(--text)" }}>
            VoiceScript
          </span>
        </div>
        <span
          className="text-xs font-mono px-3 py-1 rounded-full"
          style={{ background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          Powered by WhisperX
        </span>
      </div>
    </nav>
  );
}
