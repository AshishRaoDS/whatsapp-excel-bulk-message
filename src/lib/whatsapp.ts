/**
 * WhatsApp Business Cloud API integration
 *
 * Uses Meta's official WhatsApp Business Cloud API.
 * No browser or WebSocket connection needed — works from any server.
 *
 * Setup:
 * 1. Go to https://developers.facebook.com/
 * 2. Create an App → Business → WhatsApp
 * 3. Get your Phone Number ID and Access Token from the API Setup page
 * 4. Enter them in the app settings
 */

const API_VERSION = "v22.0";

export type WhatsAppStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "error";

interface WhatsAppState {
  status: WhatsAppStatus;
  error: string | null;
  phoneNumberId: string | null;
  accessToken: string | null;
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
}

export interface TemplateMessage {
  name: string;
  language: string;
  components?: TemplateComponent[];
}

const state: WhatsAppState = {
  status: "disconnected",
  error: null,
  phoneNumberId: null,
  accessToken: null,
};

export function getState() {
  return {
    status: state.status,
    qrDataUrl: null,
    pairingCode: null,
    error: state.error,
    isConfigured: !!(state.phoneNumberId && state.accessToken),
  };
}

/**
 * Configure the WhatsApp Cloud API credentials.
 * Validates them by calling the API.
 */
export async function initializeClient(
  phoneNumberId?: string,
  accessToken?: string
): Promise<void> {
  if (!phoneNumberId || !accessToken) {
    state.status = "error";
    state.error = "Phone Number ID and Access Token are required";
    return;
  }

  state.status = "connecting";
  state.error = null;
  state.phoneNumberId = phoneNumberId;
  state.accessToken = accessToken;

  try {
    // Validate credentials by fetching the phone number info
    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const data = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: { message: string; code: number };
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      state.status = "error";
      state.error = `Invalid credentials: ${errMsg}`;
      state.phoneNumberId = null;
      state.accessToken = null;
      return;
    }

    console.log(
      `[WhatsApp] Connected as: ${data.verified_name} (${data.display_phone_number})`
    );
    state.status = "ready";
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    console.error("[WhatsApp] Failed to validate credentials:", error);
    state.status = "error";
    state.error = `Connection failed: ${error}`;
    state.phoneNumberId = null;
    state.accessToken = null;
  }
}

/**
 * Send a plain text WhatsApp message via the Cloud API.
 */
export async function sendMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (state.status !== "ready" || !state.phoneNumberId || !state.accessToken) {
    return { success: false, error: "WhatsApp is not connected" };
  }

  try {
    // Clean phone number: remove spaces, dashes, parentheses, leading +
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${state.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleaned,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string; code: number; error_subcode?: number };
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

/**
 * Send a template WhatsApp message via the Cloud API.
 * Templates work in test mode (unlike plain text messages).
 */
export async function sendTemplateMessage(
  phone: string,
  template: TemplateMessage
): Promise<{ success: boolean; error?: string }> {
  if (state.status !== "ready" || !state.phoneNumberId || !state.accessToken) {
    return { success: false, error: "WhatsApp is not connected" };
  }

  try {
    // Clean phone number: remove spaces, dashes, parentheses, leading +
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");

    const templatePayload: Record<string, unknown> = {
      name: template.name,
      language: { code: template.language },
    };

    if (template.components && template.components.length > 0) {
      templatePayload.components = template.components;
    }

    const res = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${state.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: cleaned,
          type: "template",
          template: templatePayload,
        }),
      }
    );

    const data = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string; code: number; error_subcode?: number };
    };

    if (!res.ok || data.error) {
      const errMsg = data.error?.message ?? `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error };
  }
}

/**
 * Disconnect / clear credentials.
 */
export async function disconnectClient(): Promise<void> {
  state.status = "disconnected";
  state.error = null;
  state.phoneNumberId = null;
  state.accessToken = null;
}
