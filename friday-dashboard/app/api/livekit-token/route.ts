import { NextResponse } from "next/server";
import { AccessToken, RoomServiceClient, AgentDispatchClient } from "livekit-server-sdk";

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const httpUrl = wsUrl.replace(/^wss?:\/\//, "https://");
  const room = `friday-voice-${Date.now()}`;

  // Create the room then explicitly dispatch the friday agent.
  // If either step fails the agent will never join, so we abort here.
  try {
    const roomSvc = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await roomSvc.createRoom({ name: room });
  } catch (err) {
    console.error("[livekit-token] createRoom error:", err);
    return NextResponse.json({ error: "Could not create session room." }, { status: 503 });
  }

  try {
    const agentSvc = new AgentDispatchClient(httpUrl, apiKey, apiSecret);
    await agentSvc.createDispatch(room, "friday");
  } catch (err) {
    console.error("[livekit-token] dispatch error:", err);
    return NextResponse.json(
      { error: "Agent dispatch failed. Is the Friday worker running?" },
      { status: 503 }
    );
  }

  const token = new AccessToken(apiKey, apiSecret, {
    identity: "user",
    name: "User",
  });

  token.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
  });

  return NextResponse.json({
    token: await token.toJwt(),
    url: wsUrl,
  });
}
