import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

export interface VaultItem {
  id: string;
  name: string;
  type: "folder" | "file";
  modifiedTime: string;
}

interface VaultResponse {
  items: VaultItem[];
  vaultRootId: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse<VaultResponse>> {
  const tokenRaw = process.env.GDRIVE_NOTES_TOKEN;
  if (!tokenRaw) {
    console.warn("[vault] GDRIVE_NOTES_TOKEN not set");
    return NextResponse.json({ items: [], vaultRootId: null });
  }

  let creds: Record<string, string>;
  try {
    creds = JSON.parse(tokenRaw);
  } catch {
    console.error("[vault] Failed to parse GDRIVE_NOTES_TOKEN JSON");
    return NextResponse.json({ items: [], vaultRootId: null });
  }

  const auth = new google.auth.OAuth2(creds.client_id, creds.client_secret);
  auth.setCredentials({
    access_token:  creds.token,
    refresh_token: creds.refresh_token,
    expiry_date:   creds.expiry ? new Date(creds.expiry).getTime() : undefined,
  });

  const drive = google.drive({ version: "v3", auth });
  const { searchParams } = new URL(request.url);
  let folderId = searchParams.get("folderId");
  let vaultRootId: string | null = folderId;

  // If no folderId given, resolve vault root (env var ID takes priority over name search)
  if (!folderId) {
    const envFolderId = process.env.GDRIVE_VAULT_FOLDER_ID ?? null;
    if (envFolderId) {
      folderId = envFolderId;
      vaultRootId = envFolderId;
    } else {
      const vaultName = process.env.GDRIVE_VAULT_NAME ?? "Q _obsidian";
      try {
        const res = await drive.files.list({
          q: `name='${vaultName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
          pageSize: 1,
        });
        folderId = res.data.files?.[0]?.id ?? null;
        vaultRootId = folderId;
      } catch (err) {
        console.error("[vault] Failed to find vault root folder:", err);
        return NextResponse.json({ items: [], vaultRootId: null });
      }
      if (!folderId) {
        console.warn(`[vault] Vault folder '${vaultName}' not found in Drive`);
        return NextResponse.json({ items: [], vaultRootId: null });
      }
    }
  }

  // List direct children of the folder
  let files: { id?: string | null; name?: string | null; mimeType?: string | null; modifiedTime?: string | null }[] = [];
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, modifiedTime)",
      orderBy: "folder,name",  // folders first, then alphabetical
      pageSize: 200,
    });
    files = res.data.files ?? [];
  } catch (err) {
    console.error("[vault] Drive files.list error:", err);
    return NextResponse.json({ items: [], vaultRootId });
  }

  const items: VaultItem[] = files
    .filter(f => f.id && f.name)
    .map(f => ({
      id: f.id!,
      name: f.name!,
      type: f.mimeType === "application/vnd.google-apps.folder" ? "folder" : "file",
      modifiedTime: f.modifiedTime ?? "",
    }));

  return NextResponse.json({ items, vaultRootId });
}
