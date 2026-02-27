"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type WhatsAppStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "error";

type MessageType = "template" | "text";

interface StatusResponse {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  pairingCode: string | null;
  error: string | null;
  isConfigured: boolean;
}

interface SendResult {
  phone: string;
  message: string;
  success: boolean;
  error?: string;
}

interface SendResponse {
  total: number;
  success: number;
  failed: number;
  results: SendResult[];
  error?: string;
}

export default function Home() {
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>("disconnected");
  const [waError, setWaError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Cloud API credentials
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Message type
  const [messageType, setMessageType] = useState<MessageType>("template");

  // Template fields
  const [templateName, setTemplateName] = useState("hello_world");
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [templateParams, setTemplateParams] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResponse, setSendResponse] = useState<SendResponse | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data: StatusResponse = await res.json();
      setWaStatus(data.status);
      setWaError(data.error);

      if (data.status === "ready" || data.status === "error") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setConnecting(false);
      }
    } catch {
      // ignore fetch errors during polling
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!phoneNumberId.trim()) {
      setWaError("Please enter your Phone Number ID");
      return;
    }
    if (!accessToken.trim()) {
      setWaError("Please enter your Access Token");
      return;
    }

    setConnecting(true);
    setWaError(null);
    setSendResponse(null);

    await fetch("/api/whatsapp/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
      }),
    });

    // Poll for status updates
    pollingRef.current = setInterval(fetchStatus, 1500);
  };

  const handleDisconnect = async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    await fetch("/api/whatsapp/disconnect", { method: "POST" });
    setWaStatus("disconnected");
    setWaError(null);
    setConnecting(false);
    setSendResponse(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setSendResponse(null);
    setSendError(null);
  };

  const handleSend = async () => {
    if (!file) return;
    setSending(true);
    setSendError(null);
    setSendResponse(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("messageType", messageType);

    if (messageType === "template") {
      if (!templateName.trim()) {
        setSendError("Template name is required");
        setSending(false);
        return;
      }
      formData.append("templateName", templateName.trim());
      formData.append("templateLanguage", templateLanguage.trim() || "en_US");
      if (templateParams.trim()) {
        // Parse comma-separated params into JSON array
        const params = templateParams
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        formData.append("templateParams", JSON.stringify(params));
      }
    }

    try {
      const res = await fetch("/api/send-messages", {
        method: "POST",
        body: formData,
      });
      const data: SendResponse = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to send messages");
      } else {
        setSendResponse(data);
      }
    } catch {
      setSendError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const statusConfig: Record<
    WhatsAppStatus,
    { label: string; color: string; dot: string }
  > = {
    disconnected: {
      label: "Disconnected",
      color: "text-gray-400",
      dot: "bg-gray-400",
    },
    connecting: {
      label: "Validating…",
      color: "text-yellow-400",
      dot: "bg-yellow-400 animate-pulse",
    },
    qr_ready: {
      label: "Waiting",
      color: "text-yellow-400",
      dot: "bg-yellow-400 animate-pulse",
    },
    authenticated: {
      label: "Authenticating…",
      color: "text-blue-400",
      dot: "bg-blue-400 animate-pulse",
    },
    ready: {
      label: "Connected",
      color: "text-green-400",
      dot: "bg-green-400",
    },
    error: { label: "Error", color: "text-red-400", dot: "bg-red-400" },
  };

  const sc = statusConfig[waStatus];
  const showConnectionForm =
    waStatus === "disconnected" || waStatus === "error";

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center py-12 px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <svg
            className="w-10 h-10 text-green-400"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          <h1 className="text-3xl font-bold">WhatsApp Bulk Sender</h1>
        </div>
        <p className="text-neutral-400 text-sm">
          Upload an Excel file with phone numbers and messages to send in bulk
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* WhatsApp Connection Card */}
        <div className="bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">WhatsApp Connection</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${sc.dot}`} />
              <span className={`text-sm font-medium ${sc.color}`}>
                {sc.label}
              </span>
            </div>
          </div>

          {waError && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {waError}
            </div>
          )}

          {/* Setup Guide */}
          {showConnectionForm && (
            <div className="mb-5">
              <details className="group">
                <summary className="cursor-pointer text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-3">
                  <span className="group-open:rotate-90 transition-transform inline-block">
                    ▶
                  </span>
                  How to get your WhatsApp Business API credentials
                </summary>
                <div className="mt-2 p-4 bg-neutral-700/50 rounded-xl text-xs text-neutral-300 space-y-2">
                  <p className="font-semibold text-neutral-200">
                    📋 Quick Setup (5 minutes):
                  </p>
                  <ol className="space-y-1.5 list-decimal list-inside">
                    <li>
                      Go to{" "}
                      <a
                        href="https://developers.facebook.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 underline"
                      >
                        developers.facebook.com
                      </a>{" "}
                      and log in
                    </li>
                    <li>
                      Click <strong>My Apps</strong> →{" "}
                      <strong>Create App</strong>
                    </li>
                    <li>
                      Choose <strong>Business</strong> type → name your app
                    </li>
                    <li>
                      In the app dashboard, find <strong>WhatsApp</strong> and
                      click <strong>Set up</strong>
                    </li>
                    <li>
                      Go to <strong>API Setup</strong> — you&apos;ll see your{" "}
                      <strong>Phone Number ID</strong> and a temporary{" "}
                      <strong>Access Token</strong>
                    </li>
                    <li>Copy both values and paste them below</li>
                  </ol>
                  <p className="text-yellow-400 mt-2">
                    ⚠️ The free test token expires in 24 hours. For production,
                    generate a permanent token from System Users.
                  </p>
                </div>
              </details>

              {/* Credentials Form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="e.g. 123456789012345"
                    className="w-full px-4 py-3 bg-neutral-700 border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">
                    Access Token
                  </label>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAxxxxxxxxxxxxxxx..."
                      className="w-full px-4 py-3 pr-12 bg-neutral-700 border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs"
                    >
                      {showToken ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connected info */}
          {waStatus === "ready" && (
            <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded-lg text-green-300 text-sm text-center">
              ✅ WhatsApp Business API connected and ready to send messages
            </div>
          )}

          {/* Connecting spinner */}
          {waStatus === "connecting" && (
            <div className="mb-4 p-4 flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-neutral-400">
                Validating credentials…
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {showConnectionForm ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm"
              >
                {connecting ? "Connecting…" : "Connect WhatsApp"}
              </button>
            ) : waStatus === "ready" ? (
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 px-4 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-medium transition-colors text-sm"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 px-4 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-medium transition-colors text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Message Type & Upload Card */}
        <div className="bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
          <h2 className="text-lg font-semibold mb-4">Send Messages</h2>

          {/* Message Type Toggle */}
          <div className="mb-5">
            <label className="block text-sm text-neutral-400 mb-2">
              Message Type
            </label>
            <div className="flex rounded-xl overflow-hidden border border-neutral-600">
              <button
                onClick={() => setMessageType("template")}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                  messageType === "template"
                    ? "bg-green-600 text-white"
                    : "bg-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                📋 Template Message
              </button>
              <button
                onClick={() => setMessageType("text")}
                className={`flex-1 py-2.5 px-4 text-sm font-medium transition-colors ${
                  messageType === "text"
                    ? "bg-green-600 text-white"
                    : "bg-neutral-700 text-neutral-400 hover:text-white"
                }`}
              >
                💬 Custom Text
              </button>
            </div>
          </div>

          {/* Template Configuration */}
          {messageType === "template" && (
            <div className="mb-5 space-y-3">
              <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-blue-300 text-xs">
                💡 <strong>Template messages</strong> work in test mode and are
                required for first-contact messages. Use the{" "}
                <code className="bg-blue-900/50 px-1 rounded">hello_world</code>{" "}
                template to test, or use your own approved templates.
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g. hello_world"
                  className="w-full px-4 py-3 bg-neutral-700 border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">
                  Language Code
                </label>
                <input
                  type="text"
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                  placeholder="e.g. en_US"
                  className="w-full px-4 py-3 bg-neutral-700 border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-sm text-neutral-400 mb-1.5">
                  Template Parameters{" "}
                  <span className="text-neutral-500">(optional, comma-separated)</span>
                </label>
                <input
                  type="text"
                  value={templateParams}
                  onChange={(e) => setTemplateParams(e.target.value)}
                  placeholder="e.g. John Doe, 123456, Feb 27 2026"
                  className="w-full px-4 py-3 bg-neutral-700 border border-neutral-600 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm font-mono"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  These fill in the {`{{1}}`}, {`{{2}}`}, {`{{3}}`}… placeholders
                  in your template
                </p>
              </div>
            </div>
          )}

          {/* File Format Info */}
          <div className="mb-4 p-3 bg-neutral-700/50 rounded-lg text-xs text-neutral-400 space-y-1">
            <p className="font-medium text-neutral-300">
              📋 Excel file format:
            </p>
            {messageType === "template" ? (
              <>
                <p>
                  • Column header:{" "}
                  <code className="bg-neutral-600 px-1 rounded">phone</code>{" "}
                  (or first column = phone numbers)
                </p>
                <p>
                  • The same template message will be sent to all numbers
                </p>
              </>
            ) : (
              <>
                <p>
                  • Column headers:{" "}
                  <code className="bg-neutral-600 px-1 rounded">phone</code> and{" "}
                  <code className="bg-neutral-600 px-1 rounded">message</code>
                </p>
                <p>
                  • Or first column = phone number, second column = message
                </p>
              </>
            )}
            <p>
              • Phone numbers should include country code (e.g. 919353125324)
            </p>
          </div>

          {/* File Upload */}
          <div
            className="border-2 border-dashed border-neutral-600 rounded-xl p-8 text-center cursor-pointer hover:border-green-500 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="space-y-1">
                <div className="text-green-400 text-2xl">📄</div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-neutral-400">
                  {(file.size / 1024).toFixed(1)} KB — Click to change
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-neutral-500 text-3xl">📂</div>
                <p className="text-sm text-neutral-400">
                  Click to upload Excel file (.xlsx, .xls, .csv)
                </p>
              </div>
            )}
          </div>

          {sendError && (
            <div className="mt-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
              {sendError}
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={!file || sending || waStatus !== "ready"}
            className="mt-4 w-full py-3 px-4 bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed rounded-xl font-semibold transition-colors text-sm"
          >
            {sending
              ? "Sending messages…"
              : waStatus !== "ready"
              ? "Connect WhatsApp first"
              : !file
              ? "Upload a file first"
              : messageType === "template"
              ? `Send Template "${templateName}"`
              : "Send Messages"}
          </button>
        </div>

        {/* Results Card */}
        {sendResponse && (
          <div className="bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
            <h2 className="text-lg font-semibold mb-4">Results</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-neutral-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold">{sendResponse.total}</p>
                <p className="text-xs text-neutral-400 mt-1">Total</p>
              </div>
              <div className="bg-green-900/40 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">
                  {sendResponse.success}
                </p>
                <p className="text-xs text-neutral-400 mt-1">Sent</p>
              </div>
              <div className="bg-red-900/40 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-400">
                  {sendResponse.failed}
                </p>
                <p className="text-xs text-neutral-400 mt-1">Failed</p>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sendResponse.results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                    r.success
                      ? "bg-green-900/20 border border-green-800"
                      : "bg-red-900/20 border border-red-800"
                  }`}
                >
                  <span className="mt-0.5 flex-shrink-0">
                    {r.success ? "✅" : "❌"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.phone}</p>
                    <p className="text-neutral-400 truncate text-xs">
                      {r.message}
                    </p>
                    {r.error && (
                      <p className="text-red-400 text-xs mt-0.5">{r.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
