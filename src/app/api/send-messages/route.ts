import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { sendMessage, getState } from "@/lib/whatsapp";

export interface MessageRow {
  phone: string;
  message: string;
}

export interface SendResult {
  phone: string;
  message: string;
  success: boolean;
  error?: string;
}

function parseExcel(buffer: Buffer): MessageRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const results: MessageRow[] = [];

  for (const row of rows) {
    // Try to find phone and message columns (case-insensitive)
    const keys = Object.keys(row);
    const phoneKey = keys.find((k) =>
      k.toLowerCase().includes("phone")
    );
    const messageKey = keys.find(
      (k) =>
        k.toLowerCase().includes("message") ||
        k.toLowerCase().includes("msg") ||
        k.toLowerCase().includes("text")
    );

    if (!phoneKey || !messageKey) {
      // Try positional: first column = phone, second = message
      if (keys.length >= 2) {
        const phone = String(row[keys[0]]).trim();
        const message = String(row[keys[1]]).trim();
        if (phone && message) {
          results.push({ phone, message });
        }
      }
      continue;
    }

    const phone = String(row[phoneKey]).trim();
    const message = String(row[messageKey]).trim();

    if (phone && message) {
      results.push({ phone, message });
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  const state = getState();
  if (state.status !== "ready") {
    return NextResponse.json(
      { error: "WhatsApp is not connected. Please scan the QR code first." },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let rows: MessageRow[];
    try {
      rows = parseExcel(buffer);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Excel file. Please check the file format." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid rows found. Ensure the file has 'phone' and 'message' columns.",
        },
        { status: 400 }
      );
    }

    // Send messages with a small delay between each
    const results: SendResult[] = [];
    for (const row of rows) {
      const result = await sendMessage(row.phone, row.message);
      results.push({
        phone: row.phone,
        message: row.message,
        success: result.success,
        error: result.error,
      });
      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      total: rows.length,
      success: successCount,
      failed: failCount,
      results,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
