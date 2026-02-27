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

    // Await initialization so credentials are validated before responding
    await initializeClient(phoneNumberId, accessToken);

    const state = getState();
    return NextResponse.json({
      message:
        state.status === "ready"
          ? "WhatsApp connected successfully"
          : `WhatsApp status: ${state.status}`,
      status: state.status,
      error: state.error,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
