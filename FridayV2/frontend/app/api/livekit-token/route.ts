import { NextResponse } from "next/server";
import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";

const apiKey     = process.env.LIVEKIT_API_KEY!;
const apiSecret  = process.env.LIVEKIT_API_SECRET!;
const livekitUrl = process.env.LIVEKIT_URL!;

// One persistent room. The agent joins once and stays — reconnections are
// instant and there is never more than one agent running at a time.
const SESSION_ROOM = "friday-voice-session";

export async function GET() {
  if (!apiKey || !apiSecret || !livekitUrl) {
    return NextResponse.json({ error: "LiveKit credentials not configured" }, { status: 500 });
  }

  const httpUrl    = livekitUrl.replace(/^wss?:\/\//, "https://");
  const roomSvc    = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  const dispatchSvc = new AgentDispatchClient(httpUrl, apiKey, apiSecret);

  // 1. Ensure the room exists (idempotent). emptyTimeout:0 keeps it alive
  //    even when no participants are present so the agent can stay connected.
  try {
    await roomSvc.createRoom({ name: SESSION_ROOM, emptyTimeout: 0 });
  } catch (err) {
    console.error("[livekit-token] createRoom error:", err);
    return NextResponse.json({ error: "Could not create session room." }, { status: 503 });
  }

  // 2. Skip dispatch entirely if the agent is already in the room.
  let agentPresent = false;
  try {
    const participants = await roomSvc.listParticipants(SESSION_ROOM);
    agentPresent = participants.some((p) => p.identity !== "user");
  } catch {}

  if (!agentPresent) {
    // Always dispatch when no agent is in the room. Old "active" dispatches can
    // go stale after a worker restart (LiveKit won't re-deliver them), so checking
    // for existing dispatches causes indefinite hangs. The duplicate-agent guard
    // inside the Python entrypoint handles any race where two processes start.
    try {
      await dispatchSvc.createDispatch(SESSION_ROOM, "friday-2.0", { metadata: "web-session" });
    } catch (err) {
      console.error("[livekit-token] dispatch error:", err);
      return NextResponse.json({ error: "Agent dispatch failed." }, { status: 503 });
    }
  }

  // 3. Mint the participant token.
  const token = new AccessToken(apiKey, apiSecret, { identity: "user", ttl: "1h" });
  token.addGrant({ roomJoin: true, room: SESSION_ROOM, canPublish: true, canSubscribe: true });

  return NextResponse.json({ token: await token.toJwt() });
}
