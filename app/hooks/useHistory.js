"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "voicescript-history";
const MAX_ENTRIES = 15;

export function useHistory() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setHistory(JSON.parse(stored));
    } catch {}
  }, []);

  function save(entries) {
    setHistory(entries);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch {}
  }

  function addEntry(name, segments) {
    const duration = segments.length ? segments[segments.length - 1].end : 0;
    const speakerCount = new Set(segments.map((s) => s.speaker)).size;
    const wordCount = segments.reduce((n, s) => n + s.text.trim().split(/\s+/).length, 0);
    const entry = {
      id: Date.now(),
      name: name || "Untitled",
      date: new Date().toISOString(),
      segments,
      duration,
      speakerCount,
      wordCount,
    };
    const next = [entry, ...history].slice(0, MAX_ENTRIES);
    save(next);
    return entry.id;
  }

  function removeEntry(id) {
    save(history.filter((e) => e.id !== id));
  }

  function clearAll() {
    save([]);
  }

  return { history, addEntry, removeEntry, clearAll };
}
