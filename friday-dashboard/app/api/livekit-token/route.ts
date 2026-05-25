import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";

// One persistent room for the life of the session.
//
// BEFORE: every page load created a NEW unique room (friday-voice-<timestamp>).
// The agent had to cold-start in that room every time the user navigated back —
// which takes 15–25 s on an e2-micro, far past the 12 s timeout.
//
// NOW: a single fixed room is reused. The Python agent stays connected to it
// indefinitely (kept alive with asyncio.sleep(inf)). When the user navigates
// away and returns, they simply rejoin the existing room — the agent is already
// listening and responds immediately, with zero dispatch or startup wait.
const SESSION_ROOM = "friday-voice-session";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const httpUrl = wsUrl.replace(/^wss?:\/\//, "https://");
  const roomSvc = new RoomServiceClient(httpUrl, apiKey, apiSecret);

  // ── 1. Ensure the persistent room exists ────────────────────────────────────
  // createRoom is idempotent — if the room already exists it returns it silently.
  // emptyTimeout:0 means the room persists forever even with no participants,
  // so it survives brief gaps between user navigating away and agent still running.
  try {
    await roomSvc.createRoom({ name: SESSION_ROOM, emptyTimeout: 0 });
  } catch (err) {
    console.error("[livekit-token] createRoom error:", err);
    return NextResponse.json({ error: "Could not create session room." }, { status: 503 });
  }

  // ── 2. Check if the agent is already in the room ────────────────────────────
  // The user participant always has identity "user". Any other participant is the
  // Friday agent. If it's there, skip dispatch — the agent is already listening.
  let agentPresent = false;
  try {
    const participants = await roomSvc.listParticipants(SESSION_ROOM);
    agentPresent = participants.some((p) => p.identity !== "user");
  } catch {
    // Room may be brand-new and not yet indexed — fall through and dispatch.
  }

  // ── 3. Dispatch agent only when not already present or in-flight ─────────────
  //
  // Two-layer guard to prevent duplicate dispatches:
  //
  // Layer A (above): agent participant in room — agent is already live.
  // Layer B (below): active dispatch exists but agent hasn't joined yet.
  //
  // Without layer B, impatient retries before the agent finishes initialising
  // (8–15 s on the e2-micro) each create a new dispatch. Multiple parallel
  // dispatches make the worker spawn multiple processes simultaneously, which
  // saturates RAM/CPU, triggers initialization timeouts, spikes load to 1.7+,
  // and the worker marks itself unavailable — causing "agent offline" even
  // with 0 active sessions.
  if (!agentPresent) {
    const agentSvc = new AgentDispatchClient(httpUrl, apiKey, apiSecret);

    let hasActiveDispatch = false;
    try {
      const dispatches = await agentSvc.listDispatch(SESSION_ROOM);
      // deletedAt === 0n means the dispatch is still active (pending or running).
      // Any non-zero deletedAt means it has already been cleaned up.
      hasActiveDispatch = dispatches.some((d) => d.state && !d.state.deletedAt);
    } catch {
      // If listing fails, err on the side of dispatching rather than blocking.
    }

    if (!hasActiveDispatch) {
      try {
        await agentSvc.createDispatch(SESSION_ROOM, "friday");
      } catch (err) {
        console.error("[livekit-token] dispatch error:", err);
        return NextResponse.json(
          { error: "Agent dispatch failed. Is the Friday worker running?" },
          { status: 503 },
        );
      }
    }
  }

  // ── 4. Issue user token for the persistent room ──────────────────────────────
  const token = new AccessToken(apiKey, apiSecret, {
    identity: "user",
    name: "User",
  });
  token.addGrant({
    roomJoin: true,
    room: SESSION_ROOM,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({ token: await token.toJwt(), url: wsUrl });
}
