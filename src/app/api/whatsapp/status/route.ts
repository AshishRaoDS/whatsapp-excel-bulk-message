import { NextRequest, NextResponse } from "next/server";
import { getState, initializeClient } from "@/lib/whatsapp";

export async function GET() {
  const state = getState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phoneNumber = (body as { phoneNumber?: string }).phoneNumber;

    // Start initialization in background (non-blocking)
    initializeClient(phoneNumber).catch(console.error);
    return NextResponse.json({
      message: "WhatsApp initialization started",
      method: phoneNumber ? "pairing_code" : "qr_code",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
