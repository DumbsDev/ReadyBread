// src/hooks/useChangelog.ts
import { useEffect, useState } from "react";

export interface ChangelogEntry {
  title: string;
  body: string;
}

export function useChangelog() {
  const [entry, setEntry] = useState<ChangelogEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Fetch raw .txt file directly from GitHub
        const fileUrl =
          "https://raw.githubusercontent.com/DumbsDev/ReadyBread-Changelog/main/current";

        const res = await fetch(fileUrl);
        const text = await res.text();

        // "current.txt" structure:
        // First line → title
        // Other lines → body
        const lines = text.split("\n");
        const title = lines[0]?.trim() || "Update";
        const body = lines.slice(1).join("\n").trim();

        setEntry({ title, body });
      } catch (err) {
        console.error("Changelog fetch failed:", err);
        setEntry(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { entry, loading };
}
