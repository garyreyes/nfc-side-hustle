# Project Facts

Durable, project-specific decisions that should survive across sessions.

- Database is **Neon**, not Supabase — free-tier Supabase capacity is
  already used by the owner's other projects.
- Query layer is **Drizzle**, chosen over Prisma specifically so SQL
  stays visible/learnable rather than hidden behind codegen (the owner
  is deliberately building SQL fluency alongside the app).
- No admin UI in V1–V3 — data entry is via a one-time seed script. Revisit
  once V2 needs more than one business.
- `Card.type` (`"qr"` | `"nfc"`) exists from V1 even though only QR is in
  use today — owner doesn't have an NFC card in hand yet, but wants
  scan-source analytics to already be possible once NFC cards arrive.
