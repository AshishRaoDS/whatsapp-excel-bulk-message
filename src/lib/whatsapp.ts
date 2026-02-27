import makeWASocket, {
  useMultiFileAuthState as getMultiFileAuthState,
  DisconnectReason,
  type WASocket,
  type ConnectionState,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";

export type WhatsAppStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "error";

interface WhatsAppState {
  socket: WASocket | null;
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  pairingCode: string | null;
  error: string | null;
  saveCreds: (() => Promise<void>) | null;
}

const state: WhatsAppState = {
  socket: null,
  status: "disconnected",
  qrDataUrl: null,
  pairingCode: null,
  error: null,
  saveCreds: null,
};

const AUTH_FOLDER = "/tmp/whatsapp-auth";

export function getState() {
  return {
    status: state.status,
    qrDataUrl: state.qrDataUrl,
    pairingCode: state.pairingCode,
    error: state.error,
  };
}

export async function initializeClient(
  phoneNumber?: string
): Promise<void> {
  // If already connected or connecting, don't re-initialize
  if (state.socket && state.status !== "disconnected" && state.status !== "error") {
    return;
  }

  // Clean up any existing socket
  if (state.socket) {
    try {
      state.socket.end(undefined);
    } catch {
      // ignore cleanup errors
    }
    state.socket = null;
  }

  state.status = "connecting";
  state.qrDataUrl = null;
  state.pairingCode = null;
  state.error = null;

  try {
    const { state: authState, saveCreds } =
      await getMultiFileAuthState(AUTH_FOLDER);
    state.saveCreds = saveCreds;

    const usePairingCode = !!phoneNumber;

    const socket = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      // If using pairing code, we don't need QR
      browser: usePairingCode
        ? ["WhatsApp Bulk Sender", "Chrome", "1.0.0"]
        : undefined,
    });

    state.socket = socket;

    // If using pairing code method, request it
    if (usePairingCode && !authState.creds.registered) {
      try {
        // Clean the phone number: remove spaces, dashes, +, etc.
        const cleaned = phoneNumber.replace(/[\s\-\(\)\+]/g, "");
        const code = await socket.requestPairingCode(cleaned);
        state.pairingCode = code;
        state.status = "qr_ready"; // reuse this status to show pairing code
        console.log("[WhatsApp] Pairing code:", code);
      } catch (err) {
        const error = err instanceof Error ? err.message : "Unknown error";
        console.error("[WhatsApp] Failed to get pairing code:", error);
        state.status = "error";
        state.error = `Failed to get pairing code: ${error}`;
        return;
      }
    }

    // Handle connection updates
    socket.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      // QR code received (only when not using pairing code)
      if (qr && !usePairingCode) {
        try {
          state.qrDataUrl = await qrcode.toDataURL(qr);
          state.status = "qr_ready";
          console.log("[WhatsApp] QR code generated");
        } catch {
          state.error = "Failed to generate QR code";
          state.status = "error";
        }
      }

      if (connection === "open") {
        state.status = "ready";
        state.qrDataUrl = null;
        state.pairingCode = null;
        console.log("[WhatsApp] Connected successfully!");
      }

      if (connection === "close") {
        const statusCode =
          (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(
          "[WhatsApp] Connection closed. Status code:",
          statusCode,
          "Reconnecting:",
          shouldReconnect
        );

        state.socket = null;
        state.qrDataUrl = null;
        state.pairingCode = null;

        if (shouldReconnect) {
          // Auto-reconnect after a short delay
          state.status = "connecting";
          setTimeout(() => {
            initializeClient(phoneNumber).catch(console.error);
          }, 3000);
        } else {
          state.status = "disconnected";
          state.error = "Logged out from WhatsApp. Please reconnect.";
          // Clear auth state on logout
          try {
            const { rmSync } = await import("fs");
            rmSync(AUTH_FOLDER, { recursive: true, force: true });
          } catch {
            // ignore
          }
        }
      }
    });

    // Save credentials whenever they update
    socket.ev.on("creds.update", async () => {
      if (state.saveCreds) {
        await state.saveCreds();
      }
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Failed to initialize:", error);
    state.status = "error";
    state.error = `Failed to start WhatsApp: ${error}`;
    state.socket = null;
  }
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!state.socket || state.status !== "ready") {
    return { success: false, error: "WhatsApp is not connected" };
  }

  try {
    // Format phone number: remove spaces, dashes, parentheses
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    // Remove leading + if present, then add @s.whatsapp.net
    const jid = cleaned.startsWith("+")
      ? cleaned.slice(1) + "@s.whatsapp.net"
      : cleaned + "@s.whatsapp.net";

    await state.socket.sendMessage(jid, { text: message });
    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

export async function disconnectClient(): Promise<void> {
  if (state.socket) {
    try {
      await state.socket.logout();
    } catch {
      // If logout fails, just end the connection
      try {
        state.socket.end(undefined);
      } catch {
        // ignore
      }
    }
    state.socket = null;
  }
  state.status = "disconnected";
  state.qrDataUrl = null;
  state.pairingCode = null;
  state.error = null;

  // Clear auth state
  try {
    const { rmSync } = await import("fs");
    rmSync(AUTH_FOLDER, { recursive: true, force: true });
  } catch {
    // ignore
  }
}
