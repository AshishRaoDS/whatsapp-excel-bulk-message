import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import {
  sendMessage,
  sendTemplateMessage,
  getState,
  TemplateComponent,
  TemplateParameter,
} from "@/lib/whatsapp";

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
    const phoneKey = keys.find((k) => k.toLowerCase().includes("phone"));
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

function parseExcelPhoneOnly(buffer: Buffer): string[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  const phones: string[] = [];

  for (const row of rows) {
    const keys = Object.keys(row);
    const phoneKey = keys.find((k) => k.toLowerCase().includes("phone"));

    if (phoneKey) {
      const phone = String(row[phoneKey]).trim();
      if (phone) phones.push(phone);
    } else if (keys.length >= 1) {
      const phone = String(row[keys[0]]).trim();
      if (phone) phones.push(phone);
    }
  }

  return phones;
}

export async function POST(request: NextRequest) {
  const state = getState();
  if (state.status !== "ready") {
    return NextResponse.json(
      {
        error:
          "WhatsApp is not connected. Please enter your credentials first.",
      },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const messageType = (formData.get("messageType") as string) || "text";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (messageType === "template") {
      // Template message mode
      const templateName = formData.get("templateName") as string;
      const templateLanguage =
        (formData.get("templateLanguage") as string) || "en_US";
      const templateParamsJson = formData.get("templateParams") as string;

      if (!templateName) {
        return NextResponse.json(
          { error: "Template name is required for template messages" },
          { status: 400 }
        );
      }

      let phones: string[];
      try {
        phones = parseExcelPhoneOnly(buffer);
      } catch {
        return NextResponse.json(
          {
            error:
              "Failed to parse Excel file. Please check the file format.",
          },
          { status: 400 }
        );
      }

      if (phones.length === 0) {
        return NextResponse.json(
          {
            error:
              "No valid phone numbers found. Ensure the file has a 'phone' column.",
          },
          { status: 400 }
        );
      }

      // Parse template parameters if provided
      let components: TemplateComponent[] | undefined;
      if (templateParamsJson) {
        try {
          const params = JSON.parse(templateParamsJson) as string[];
          if (params.length > 0) {
            const parameters: TemplateParameter[] = params.map((p) => ({
              type: "text" as const,
              text: p,
            }));
            components = [{ type: "body", parameters }];
          }
        } catch {
          return NextResponse.json(
            { error: "Invalid template parameters format" },
            { status: 400 }
          );
        }
      }

      const results: SendResult[] = [];
      for (const phone of phones) {
        const result = await sendTemplateMessage(phone, {
          name: templateName,
          language: templateLanguage,
          components,
        });
        results.push({
          phone,
          message: `Template: ${templateName}`,
          success: result.success,
          error: result.error,
        });
        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      return NextResponse.json({
        total: phones.length,
        success: successCount,
        failed: failCount,
        results,
      });
    } else {
      // Plain text message mode
      let rows: MessageRow[];
      try {
        rows = parseExcel(buffer);
      } catch {
        return NextResponse.json(
          {
            error:
              "Failed to parse Excel file. Please check the file format.",
          },
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
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error }, { status: 500 });
  }
}
