"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type WhatsAppStatus =
  | "disconnected"
  | "qr_ready"
  | "authenticated"
  | "ready"
  | "error";

interface StatusResponse {
  status: WhatsAppStatus;
  qrDataUrl: string | null;
  error: string | null;
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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
      setQrDataUrl(data.qrDataUrl);
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
    setConnecting(true);
    setWaError(null);
    setSendResponse(null);

    await fetch("/api/whatsapp/status", { method: "POST" });

    // Poll for status updates
    pollingRef.current = setInterval(fetchStatus, 2000);
  };

  const handleDisconnect = async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    await fetch("/api/whatsapp/disconnect", { method: "POST" });
    setWaStatus("disconnected");
    setQrDataUrl(null);
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
    qr_ready: {
      label: "Scan QR Code",
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

          {waStatus === "qr_ready" && qrDataUrl && (
            <div className="flex flex-col items-center gap-3 mb-4">
              <p className="text-sm text-neutral-400">
                Scan this QR code with your WhatsApp mobile app
              </p>
              <div className="bg-white p-3 rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="WhatsApp QR Code" className="w-52 h-52" />
              </div>
              <p className="text-xs text-neutral-500">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </div>
          )}

          {waStatus === "authenticated" && (
            <div className="mb-4 p-3 bg-blue-900/40 border border-blue-700 rounded-lg text-blue-300 text-sm text-center">
              Authenticating, please wait…
            </div>
          )}

          <div className="flex gap-3">
            {waStatus === "disconnected" || waStatus === "error" ? (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed rounded-xl font-medium transition-colors text-sm"
              >
                {connecting ? "Connecting…" : "Connect WhatsApp"}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="flex-1 py-2.5 px-4 bg-neutral-700 hover:bg-neutral-600 rounded-xl font-medium transition-colors text-sm"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {/* File Upload Card */}
        <div className="bg-neutral-800 rounded-2xl p-6 border border-neutral-700">
          <h2 className="text-lg font-semibold mb-4">Upload Excel File</h2>

          <div className="mb-4 p-3 bg-neutral-700/50 rounded-lg text-xs text-neutral-400 space-y-1">
            <p className="font-medium text-neutral-300">
              📋 Excel file format:
            </p>
            <p>
              • Column headers:{" "}
              <code className="bg-neutral-600 px-1 rounded">phone</code> and{" "}
              <code className="bg-neutral-600 px-1 rounded">message</code>
            </p>
            <p>
              • Or first column = phone number, second column = message
            </p>
            <p>• Phone numbers should include country code (e.g. +1234567890)</p>
          </div>

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
