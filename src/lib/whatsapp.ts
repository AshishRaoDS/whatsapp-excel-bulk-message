import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";

export type WhatsAppStatus =
  | "disconnected"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "error";

interface WhatsAppState {
  client: Client | null;
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  error: string | null;
}

const state: WhatsAppState = {
  client: null,
  status: "disconnected",
  qrDataUrl: null,
  error: null,
};

export function getState() {
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    error: state.error,
  };
}

export async function initializeClient(): Promise<void> {
  if (state.client) {
    return;
  }

  state.status = "disconnected";
  state.qrDataUrl = null;
  state.error = null;

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "/tmp/whatsapp-session" }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    try {
      state.qrDataUrl = await qrcode.toDataURL(qr);
      state.status = "qr_ready";
    } catch {
      state.error = "Failed to generate QR code";
      state.status = "error";
    }
  });

  client.on("authenticated", () => {
    state.status = "authenticated";
    state.qrDataUrl = null;
  });

  client.on("ready", () => {
    state.status = "ready";
  });

  client.on("disconnected", () => {
    state.status = "disconnected";
    state.client = null;
    state.qrDataUrl = null;
  });

  client.on("auth_failure", (msg) => {
    state.status = "error";
    state.error = `Authentication failed: ${msg}`;
    state.client = null;
  });

  state.client = client;
  await client.initialize();
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!state.client || state.status !== "ready") {
    return { success: false, error: "WhatsApp client is not ready" };
  }

  try {
    // Format phone number: remove spaces, dashes, and ensure it has country code
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    const formatted = cleaned.startsWith("+")
      ? cleaned.slice(1) + "@c.us"
      : cleaned + "@c.us";

    await state.client.sendMessage(formatted, message);
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

export async function disconnectClient(): Promise<void> {
  if (state.client) {
    await state.client.destroy();
    state.client = null;
    state.status = "disconnected";
    state.qrDataUrl = null;
    state.error = null;
  }
}
