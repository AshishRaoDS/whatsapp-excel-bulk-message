# Active Context: Next.js Starter Template

## Current State

**Template Status**: ✅ Ready for development

The template is a clean Next.js 16 starter with TypeScript and Tailwind CSS 4. It's ready for AI-assisted expansion to build any type of application.

## Recently Completed

- [x] Base Next.js 16 setup with App Router
- [x] TypeScript configuration with strict mode
- [x] Tailwind CSS 4 integration
- [x] ESLint configuration
- [x] Memory bank documentation
- [x] Recipe system for common features

## Current Structure

| File/Directory | Purpose | Status |
|----------------|---------|--------|
| `src/app/page.tsx` | Home page | ✅ Ready |
| `src/app/layout.tsx` | Root layout | ✅ Ready |
| `src/app/globals.css` | Global styles | ✅ Ready |
| `.kilocode/` | AI context & recipes | ✅ Ready |

## Current Focus

The template is ready. Next steps depend on user requirements:

1. What type of application to build
2. What features are needed
3. Design/branding preferences

## Quick Start Guide

### To add a new page:

Create a file at `src/app/[route]/page.tsx`:
```tsx
export default function NewPage() {
  return <div>New page content</div>;
}
```

### To add components:

Create `src/components/` directory and add components:
```tsx
// src/components/ui/Button.tsx
export function Button({ children }: { children: React.ReactNode }) {
  return <button className="px-4 py-2 bg-blue-600 text-white rounded">{children}</button>;
}
```

### To add a database:

Follow `.kilocode/recipes/add-database.md`

### To add API routes:

Create `src/app/api/[route]/route.ts`:
```tsx
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello" });
}
```

## Available Recipes

| Recipe | File | Use Case |
|--------|------|----------|
| Add Database | `.kilocode/recipes/add-database.md` | Data persistence with Drizzle + SQLite |

## Pending Improvements

- [ ] Add more recipes (auth, email, etc.)
- [ ] Add example components
- [ ] Add testing setup recipe

## Session History

| Date | Changes |
|------|---------|
| Initial | Template created with base setup |
| 2026-02-27 | Built WhatsApp Bulk Sender app: Excel file upload, QR code auth, bulk message sending |
| 2026-02-27 | Fixed QR code not appearing: installed system Chrome libs, configured Puppeteer executablePath using puppeteer.executablePath() to resolve correct Chrome binary for current user |
| 2026-02-27 | Fixed Chrome "libglib-2.0.so.0 not found" error: updated Chrome path resolution to dynamically scan all home directories' puppeteer cache, fixing root vs agent user mismatch |
| 2026-02-27 | Replaced whatsapp-web.js + Puppeteer with @whiskeysockets/baileys (pure JS, no Chrome needed). Added dual connection methods: QR code scan OR phone number pairing code. Pairing code is default for easier UX. Auto-reconnect on drops. |
| 2026-02-27 | Diagnosed root cause: WhatsApp blocks WebSocket connections from cloud/datacenter IPs (405 error). Replaced Baileys with WhatsApp Business Cloud API (Meta's official REST API). App now uses Phone Number ID + Access Token credentials. No browser or WebSocket needed. Added setup guide in UI. |
| 2026-02-27 | Fixed messages not sending: upgraded API from v18.0 to v22.0 (matching Meta's current version). Added template message support — test mode only allows template messages, not plain text. Added message type toggle (Template vs Custom Text), template name/language/params config in UI. Default template: hello_world. |
| 2026-02-27 | Fixed #132000 "Number of parameters does not match" error: hello_world template takes zero params but code was sending empty components array. Added defensive filtering — empty/whitespace params are stripped, components only sent when there are real values. Updated UI info text to clarify hello_world needs no parameters. |
| 2026-02-27 | Fixed "WhatsApp is not connected" error after connecting: status POST route was fire-and-forget (not awaiting initializeClient). Now awaits credential validation and returns status directly. Frontend handleConnect reads response status instead of relying solely on polling, eliminating race condition. |
