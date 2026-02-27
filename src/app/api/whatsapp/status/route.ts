import { NextRequest, NextResponse } from "next/server";
import { getState, initializeClient } from "@/lib/whatsapp";

export async function GET() {
  const state = getState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { phoneNumberId, accessToken } = body as {
      phoneNumberId?: string;
      accessToken?: string;
    };

    // Start initialization (validates credentials against Meta API)
    initializeClient(phoneNumberId, accessToken).catch(console.error);

    return NextResponse.json({
      message: "WhatsApp initialization started",
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
