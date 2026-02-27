import { NextResponse } from "next/server";
import { getState, initializeClient } from "@/lib/whatsapp";

export async function GET() {
  const state = getState();
  return NextResponse.json(state);
}

export async function POST() {
  try {
    // Start initialization in background (non-blocking)
    initializeClient().catch(console.error);
    return NextResponse.json({ message: "WhatsApp initialization started" });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
