  # GEMINI.md — GhostCRM Engineering Blueprint & Development Roadmap

> **Role & Persona**: Senior Software Engineer, Lead Design Architect & Security Specialist.
> **Project**: GhostCRM (Telegram Ingestion • Bilingual CRM • Inventory Depletion • Courier Cash Settlement).
> **Workspace**: `Courier-Call-Masking-System`
> **Dedicated Route**: `/crm` (Owner/Manager CRM) & `/api/telegram/webhook` (Telegram Ingestion)

---

## 🛡️ Non-Negotiable Operational & Architecture Rules

1. **Identity Rule**: Customer Display Name = Delivery Address (e.g. `מרקו לויז - הנשיאים 57 פתח תקווה`).
2. **Deterministic Uniqueness**: Customers are matched and deduplicated by **Phone Number** (`05X-XXXXXXX`).
3. **The Slash Inventory Rule**: In `Menu Name / [Qty] Warehouse Item`, what is **after the slash** deducts from the live product stock!
4. **Fuzzy Spelling Tolerance**: Missing vowels or typos (e.g. `רפואי גלקסי` vs `רפואי גלאקסי`, `פופקרן` vs `פופקורן`) must resolve to the identical product without failure.
5. **Bilingual UI**: Default language is **English (LTR)** with instant one-tap toggle (`🌐 EN | עב`) to **Hebrew (RTL)**.
6. **Security & OPSEC**:
   - Only Telegram user IDs matching `ALLOWED_TELEGRAM_ADMIN_IDS` can feed orders to the bot.
   - `/crm` is strictly restricted to authenticated managers.
   - Couriers only access `/courier` with Twilio-masked customer phone numbers.

---

## 🗺️ Master Development Phase Checklist

### Phase 1: Database Architecture & Seeding (Supabase)
- [x] Update `supabase/schema.sql` with new tables:
  - [x] `brands` (with 37 pre-seeded brands)
  - [x] `products` (with 29/9 inventory quantities, units, and alias arrays)
  - [x] `customers` (`crm_customers` optimized for address as name, city indexing, unique phone)
  - [x] `couriers` (`crm_couriers` name, telegram_id, phone, status)
  - [x] `orders` (`crm_orders` customer_id, brand_id, courier_id, address, city, menu_items, actual_items, total_price, is_settled)
  - [x] `inventory_transactions` (order_id, product_id, quantity, reason)
  - [x] `cash_settlements` (courier_id, date, total_collected, amount_received, status)
- [x] Create seed SQL script with all 37 brands and initial product catalog stock (`supabase/crm_schema_and_seed.sql`).
- [x] Verify Supabase client connection and table permissions (RLS policies).

### Phase 2: Hybrid Ingestion Parser & Fuzzy Matcher Engine
- [x] Create `lib/crm/parser.ts`:
  - [x] Phone regex extraction (`05\d-?\d{7}`)
  - [x] Address & City extraction using comprehensive Israeli city list (`lib/crm/israeli-cities.ts`)
  - [x] Telegram handle extraction (`@username`)
  - [x] Brand extraction matching the 37 brand names (`lib/crm/catalog-data.ts`)
  - [x] Price extraction (`\d+₪`, `₪\d+`, `כולל משלוח`)
  - [x] "Slash" inventory parser (`Before Slash / After Slash`)
  - [x] Trailing-line inventory parser (for format where warehouse item is written under the brand)
  - [x] Levenshtein / fuzzy string matcher for strain spelling variants (`גלאקסי` / `גלקסי` in `lib/crm/fuzzy-matcher.ts`)
- [x] Unit tests for all sample messages provided by the client (`scripts/test-parser.ts` - 5/5 PASSED).

### Phase 3: Telegram Ingestion Webhook & Bot Integration
- [x] Create `app/api/telegram/webhook/route.ts`:
  - [x] Whitelist verification (`ALLOWED_TELEGRAM_ADMIN_IDS`)
  - [x] Batch message processing (supporting 20–50 forwarded messages in a single burst)
  - [x] Database transaction:
    - [x] Upsert customer by phone (`crm_customers` + sync to legacy `customers`)
    - [x] Create order record (`crm_orders`)
    - [x] Deduct inventory & record `inventory_transactions`
    - [x] Associate with courier/brand
  - [x] Reply format with receipt summary:
    - [x] Orders processed count
    - [x] Daily courier cash accumulated
    - [x] Inventory grams/units deducted
    - [x] Quick link button to open the CRM (`lib/crm/telegram-bot.ts`)

### Phase 4: Bilingual CRM Dashboard UI (`/crm`)
- [x] Modern dark-mode layout (`#0b0f17`, glassmorphism, glowing accents, Inter + Heebo typography).
- [x] Bilingual State Management (`en` default LTR, `he` RTL toggle with full key dictionary).
- [x] Top Metric Summary Cards:
  - [x] Total Cash with Couriers Today (`קופת שליחים יומית`)
  - [x] Total Deliveries Today
  - [x] Active Low Stock Product Alerts
- [x] Filter & Search Strip:
  - [x] Search input (live debounced search across address, phone, telegram, and items)
  - [x] Brand Selector (Pill buttons for the 37 brands with order counts)
  - [x] City Selector (Dropdown with city name and active customer counts)
- [x] Customer & Orders Table:
  - [x] Display Name (Address)
  - [x] City
  - [x] Phone (with masked/unmasked toggle & quick WhatsApp/Call actions)
  - [x] Last Brand Persona
  - [x] Items Purchased (Menu vs Actual Warehouse deduction)
  - [x] Price
- [x] One-Click Excel / CSV Export button (with UTF-8 BOM for Hebrew Excel).

### Phase 5: Live Inventory & Courier Cash Settlement Tabs
- [x] Inventory Management Tab (`/crm` sub-tab):
  - [x] Live stock on hand table (Grams/Units per product)
  - [x] Low stock threshold indicators
  - [x] Manual stock adjustment / quick restock action
- [x] Courier Cash Settlement Tab (`/crm` sub-tab):
  - [x] Daily cash accumulated per courier
  - [x] Shift closeout button (`סגירת קופה`) to reconcile expected vs received cash
  - [x] Status tracking (Open Shift vs Reconciled)

### Phase 6: End-to-End Verification & Client Handover
- [x] Verify forwarded Telegram messages create correct DB records and deduct stock.
- [x] Test language switch across all screens.
- [x] Test edge cases (typos, unusual prices, unknown cities).
- [x] Prepare client walkthrough guide.
