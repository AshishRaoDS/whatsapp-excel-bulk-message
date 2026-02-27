import { NextResponse } from "next/server";
import { disconnectClient } from "@/lib/whatsapp";

export async function POST() {
  try {
    await disconnectClient();
    return NextResponse.json({ message: "WhatsApp disconnected" });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
