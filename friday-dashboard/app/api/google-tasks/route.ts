import { NextRequest, NextResponse } from "next/server";

const NO_CACHE = { "Cache-Control": "no-store, no-cache" };
const TASKS_BASE = "https://www.googleapis.com/tasks/v1";

export interface GoogleTask {
  id: string;
  title: string;
  notes: string;
  due: string | null;
  completed: boolean;
  completedAt: string | null;
  updated: string;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_TASKS_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { access_token } = await res.json();
  return access_token ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGoogleTask(raw: any): GoogleTask {
  return {
    id:          raw.id,
    title:       raw.title ?? "",
    notes:       raw.notes ?? "",
    due:         raw.due ? raw.due.slice(0, 10) : null,
    completed:   raw.status === "completed",
    completedAt: raw.completed ?? null,
    updated:     raw.updated ?? "",
  };
}

// ── GET — list tasks ──────────────────────────────────────────────────────────

export async function GET() {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: "GOOGLE_TASKS_REFRESH_TOKEN not configured" },
      { status: 503, headers: NO_CACHE }
    );
  }

  const auth = { Authorization: `Bearer ${token}` };

  // Fetch uncompleted + recently completed tasks
  const url =
    `${TASKS_BASE}/lists/@default/tasks` +
    `?showCompleted=true&showHidden=true&maxResults=100`;

  const res = await fetch(url, { headers: auth, cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: res.status, headers: NO_CACHE });
  }

  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tasks: GoogleTask[] = (data.items ?? []).map(toGoogleTask);
  return NextResponse.json(tasks, { headers: NO_CACHE });
}

// ── POST — create task ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const body = await request.json();
  const payload: Record<string, string> = { title: body.title ?? "New task" };
  if (body.notes) payload.notes = body.notes;
  if (body.due)   payload.due   = `${body.due}T00:00:00.000Z`;

  const res = await fetch(`${TASKS_BASE}/lists/@default/tasks`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to create task" }, { status: res.status });
  return NextResponse.json(toGoogleTask(await res.json()));
}

// ── PATCH — update task ───────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const body = await request.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const payload: Record<string, string> = {};
  if (fields.title !== undefined)     payload.title  = fields.title;
  if (fields.notes !== undefined)     payload.notes  = fields.notes;
  if (fields.due   !== undefined)     payload.due    = fields.due ? `${fields.due}T00:00:00.000Z` : "";
  if (fields.completed !== undefined) payload.status = fields.completed ? "completed" : "needsAction";

  const res = await fetch(`${TASKS_BASE}/lists/@default/tasks/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to update task" }, { status: res.status });
  return NextResponse.json(toGoogleTask(await res.json()));
}

// ── DELETE — delete task ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const res = await fetch(`${TASKS_BASE}/lists/@default/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: res.status });
  }
  return NextResponse.json({ ok: true });
}
