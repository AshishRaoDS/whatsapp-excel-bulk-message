import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode";
import puppeteer from "puppeteer";

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

  // Find the Chromium/Chrome executable
  // puppeteer.executablePath() may return a path for the wrong user when running as root.
  // We search multiple candidate paths including all home directories.
  const { existsSync, readdirSync } = await import("fs");
  const { homedir } = await import("os");
  const home = homedir();

  // Collect all home directories to search for puppeteer cache
  let homeDirs: string[] = [home, "/root"];
  try {
    const entries = readdirSync("/home");
    homeDirs = [...new Set([...homeDirs, ...entries.map((e) => `/home/${e}`)])];
  } catch {
    // ignore
  }

  // Dynamically find all chrome binaries in puppeteer cache across all home dirs
  const candidatesFromHomes: string[] = [];
  for (const h of homeDirs) {
    const cacheDir = `${h}/.cache/puppeteer/chrome`;
    try {
      const versions = readdirSync(cacheDir);
      for (const version of versions) {
        const chromePath = `${cacheDir}/${version}/chrome-linux64/chrome`;
        candidatesFromHomes.push(chromePath);
      }
    } catch {
      // ignore if directory doesn't exist
    }
  }

  const chromiumPaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH ?? "",
    puppeteer.executablePath(), // Puppeteer's bundled Chrome (resolves for current process user)
    ...candidatesFromHomes,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ].filter(Boolean);

  const executablePath = chromiumPaths.find((p) => {
    try {
      return existsSync(p);
    } catch {
      return false;
    }
  });

  console.log("[WhatsApp] Using Chrome executable:", executablePath ?? "puppeteer default");

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "/tmp/whatsapp-session" }),
    puppeteer: {
      headless: true,
      ...(executablePath ? { executablePath } : {}),
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
  try {
    await client.initialize();
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Failed to initialize client:", error);
    state.status = "error";
    state.error = `Failed to start WhatsApp: ${error}`;
    state.client = null;
  }
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
