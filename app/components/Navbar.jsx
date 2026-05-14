export default function Navbar() {
  return (
    <nav
      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}
      className="sticky top-0 z-10 px-6 py-3"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <img
          src="/UraiAI_Logo.png"
          alt="UraiAI"
          style={{ height: "55px", width: "auto", borderRadius: "6px" }}
        />
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
