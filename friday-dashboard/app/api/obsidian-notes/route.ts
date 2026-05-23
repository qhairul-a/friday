import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "fs/promises";
import { join, extname } from "path";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH ?? "G:\\My Drive\\Q _obsidian";
const SKIP_DIRS = new Set([".obsidian", ".trash", ".git"]);

interface NoteEntry {
  title: string;
  snippet: string;
  modified: number;
  modifiedStr: string;
  isFriday: boolean;
}

async function walkVault(dir: string, today: string, results: NoteEntry[]) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await walkVault(fullPath, today, results);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      try {
        const s = await stat(fullPath);
        const mdate = s.mtime.toISOString().slice(0, 10);
        if (mdate !== today) continue;

        const raw = await readFile(fullPath, "utf-8");

        // Strip YAML frontmatter
        let body = raw;
        if (body.startsWith("---")) {
          const end = body.indexOf("---", 3);
          if (end !== -1) body = body.slice(end + 3).trim();
        }

        // Get snippet: skip heading lines, take first meaningful lines
        const lines = body.split("\n").filter(l => l.trim() && !l.startsWith("#"));
        const snippet = lines.slice(0, 3).join(" ").slice(0, 150);

        // Clean title: strip timestamp prefix YYYY-MM-DD HHMM
        let title = entry.name.replace(/\.md$/, "");
        title = title.replace(/^\d{4}-\d{2}-\d{2} \d{4} /, "");

        const mtime = s.mtime.getTime();
        const modifiedStr = s.mtime.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const isFriday = dir.includes("Friday");

        results.push({ title, snippet, modified: mtime, modifiedStr, isFriday });
      } catch {
        continue;
      }
    }
  }
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  const results: NoteEntry[] = [];

  await walkVault(VAULT_PATH, today, results);

  results.sort((a, b) => b.modified - a.modified);

  return NextResponse.json(results.slice(0, 20));
}
