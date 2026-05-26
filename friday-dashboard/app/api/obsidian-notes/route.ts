import { google } from "googleapis";
import { NextResponse } from "next/server";

/**
 * Returns today's notes from the Friday folder in Google Drive.
 *
 * Required Vercel env vars:
 *   GDRIVE_NOTES_TOKEN      — contents of gdrive_notes_token.json from the VM
 *                             (cat $GDRIVE_NOTES_TOKEN_FILE on the VM)
 *   GDRIVE_NOTES_FOLDER_ID  — Drive folder ID for the Friday notes folder
 *                             (grep GDRIVE_NOTES_FOLDER_ID ~/friday/Project\ Friday/friday-core/.env)
 *
 * "Today" is evaluated in Asia/Singapore time (UTC+8).
 */

interface NoteEntry {
  title: string;
  snippet: string;
  modified: number;
  modifiedStr: string;
  isFriday: boolean;
}

export async function GET() {
  const tokenRaw = process.env.GDRIVE_NOTES_TOKEN;
  const folderId = process.env.GDRIVE_NOTES_FOLDER_ID;

  if (!tokenRaw || !folderId) {
    console.warn("[obsidian-notes] GDRIVE_NOTES_TOKEN or GDRIVE_NOTES_FOLDER_ID not set");
    return NextResponse.json([]);
  }

  let creds: Record<string, string>;
  try {
    creds = JSON.parse(tokenRaw);
  } catch {
    console.error("[obsidian-notes] Failed to parse GDRIVE_NOTES_TOKEN JSON");
    return NextResponse.json([]);
  }

  // Build OAuth2 client from the token file written by Python's google-auth library.
  // Python serialises the access token as "token"; Node googleapis uses "access_token".
  const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  auth.setCredentials({
    access_token:  creds.token,
    refresh_token: creds.refresh_token,
    expiry_date:   creds.expiry ? new Date(creds.expiry).getTime() : undefined,
  });

  const drive = google.drive({ version: "v3", auth });

  // Midnight today in Asia/Singapore (UTC+8).
  // e.g. if it's 2026-05-26T09:00 SGT, start = 2026-05-26T00:00:00+08:00 = 2026-05-25T16:00:00Z
  const sgDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" })
  ).toLocaleDateString("en-CA"); // YYYY-MM-DD
  const todayStartUtc = new Date(`${sgDate}T00:00:00+08:00`).toISOString();

  let files: { id?: string | null; name?: string | null; modifiedTime?: string | null }[] = [];
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and modifiedTime > '${todayStartUtc}' and trashed=false`,
      fields: "files(id, name, modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 20,
    });
    files = res.data.files ?? [];
  } catch (err) {
    console.error("[obsidian-notes] Drive files.list error:", err);
    return NextResponse.json([]);
  }

  // Fetch file content in parallel for snippets (capped at 10 files).
  const notes = await Promise.all(
    files.slice(0, 10).map(async (file): Promise<NoteEntry | null> => {
      if (!file.id || !file.name) return null;
      try {
        const contentRes = await drive.files.get(
          { fileId: file.id, alt: "media" },
          { responseType: "text" }
        );
        const body = typeof contentRes.data === "string" ? contentRes.data : "";

        // Strip heading lines, frontmatter delimiters, and footer lines for snippet
        const lines = body
          .split("\n")
          .filter(
            (l) =>
              l.trim() &&
              !l.startsWith("#") &&
              !l.startsWith("---") &&
              !l.startsWith("*Captured") &&
              !l.startsWith("*Last edited")
          );
        const snippet = lines.slice(0, 2).join(" ").slice(0, 150);

        // Strip timestamp prefix from filename: "2026-05-26 0900 My Note" → "My Note"
        let title = file.name.replace(/\.md$/, "");
        title = title.replace(/^\d{4}-\d{2}-\d{2} \d{4} /, "");

        const mtime = new Date(file.modifiedTime!);
        return {
          title,
          snippet,
          modified: mtime.getTime(),
          modifiedStr: mtime.toLocaleTimeString("en-US", {
            hour:     "2-digit",
            minute:   "2-digit",
            timeZone: "Asia/Singapore",
          }),
          isFriday: true,
        };
      } catch {
        return null;
      }
    })
  );

  return NextResponse.json(notes.filter((n): n is NoteEntry => n !== null));
}
