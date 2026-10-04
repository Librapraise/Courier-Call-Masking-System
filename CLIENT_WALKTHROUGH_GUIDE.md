# Persian Team Management — GhostCRM Client Walkthrough & Handover Guide

> **System**: Persian Team Management (GhostCRM)  
> **Core Architecture**: Multi-Brand Telegram Ingestion • Bilingual CRM • Automatic Inventory Depletion • Courier Cash Settlement • Twilio Call-Masking

---

## 🌟 1. Executive System Overview

**Persian Team Management** is a specialized, bilingual operations and dispatch management platform engineered specifically for multi-brand delivery operations in Israel.

### Key Capabilities:
- **Telegram Ingestion Webhook**: Forward raw customer dispatch messages directly from Telegram to automatically create orders, deduplicate clients, and deduct warehouse inventory.
- **Deterministic Customer Identity**: Customers are strictly deduplicated by their unique Israeli mobile number (`05X-XXXXXXX`). The customer display name is automatically kept as their latest delivery address (e.g. `מרקו לויז - הנשיאים 57 פתח תקווה`).
- **Slash Inventory Depletion**: In `Menu Name / [Qty] Warehouse Item`, whatever is written **after the slash** deducts from the live warehouse stock.
- **Fuzzy Strain Matcher**: Accommodates Hebrew spelling variants, missing vowels (`גלקסי` vs `גלאקסי`, `פופקרן` vs `פופקורן`), and decorative emojis (`👑 מלך הרפואי 👑`).
- **Courier Cash Settlement (`סגירת קופה`)**: Tracks live daily cash collected per courier, reconciles expected vs actual physical cash received, and archives auditable shift logs.
- **Bilingual Interface**: Full support for English (LTR) and Hebrew (RTL) with instantaneous one-tap switching and responsive mobile sidebar drawer navigation.

---

## 📱 2. Telegram Bot Ingestion Workflow

### How Dispatchers Forward Deliveries
1. Open your Telegram channel or chat with the bot (`@persianmgt_bot`).
2. Simply select and **Forward (Forward message)** any delivery confirmation message directly to the bot.
3. The bot automatically parses:
   - **Customer Name & Street Address** (Line 1)
   - **Israeli City** (geographically matched against all Israeli municipalities)
   - **Phone Number** (`05X-XXXXXXX` / `+972...`)
   - **Customer Tier** (`קבוע`, `חדש`, `VIP`)
   - **Telegram Handle** (`@username`)
   - **Menu Item vs Warehouse Strain** (via `/` slash rule or trailing lines)
   - **Price** (`₪1,200`, `3000₪ כולל משלוח`, `450 ש"ח`)
   - **Brand Persona** (matched to one of the 37 brand personas)

### Batch Forwarding Support
- Dispatchers can forward single messages or select **20–50 messages** in a single burst.
- The bot replies with an instant summary receipt:
  ```
  ✅ נקלטו בהצלחה 15 משלוחים חדשים!
  💵 סך קופת שליחים יומית מצטברת: ₪14,500
  📦 נוכו מהמלאי:
     • 60g רפואי האני
     • 40g רפואי מלון
     • 3 יח׳ גבוהה VIP
  ```

### OPSEC & Admin Whitelist Security
- Only Telegram user IDs listed in `ALLOWED_TELEGRAM_ADMIN_IDS` in `.env.local` can feed orders to the webhook.
- Unauthorized senders are silently ignored to prevent reconnaissance.

---

## 📦 3. Live Inventory & The Slash Rule

### The Slash Rule (`Menu Part / Warehouse Part`)
- **Example Message Line**: `2 גלאטו 33 / 20 רפואי האני`
  - **Menu Display**: `2 גלאטו 33` (What the customer ordered from the channel menu)
  - **Actual Warehouse Deduction**: `20g רפואי האני` (Deducted from warehouse stock on hand)
- **Automatic Unit Handling**:
  - Grams (`g`) for loose strains, medical flower, and boutique.
  - Pieces (`units`) for pens, disposables, or VIP packages.

### Warehouse Stock Management
- **Catalog Screen**: Navigate to **Live Inventory (29/9)** in the CRM sidebar.
- **Stock Threshold Alerts**: Visual indicators for `In Stock` (green), `Low Stock` (amber), and `Out of Stock` (rose).
- **Manual Adjustments**: Click the **Adjust Stock** button on any product row to add incoming shipments or deduct damaged goods with an audit note.
- **Quick Restock**: Click **+100 Quick Restock** to instantly replenish high-velocity strains.

---

## 💼 4. Courier Dispatch, Shift Lifecycle & Cash Settlement (`סגירת קופה`)

Every courier collects cash upon delivery. The system seamlessly connects order ingestion, courier dispatching, mobile call-masking, and financial reconciliation into an automated, auditable lifecycle.

```
[ Telegram Order Ingestion ]
           │
           ▼
[ Manager Assigns Courier in CRM ]
     ├── 1. Sends Instant Telegram Dispatch Alert to Courier 📲
     ├── 2. Syncs Customer Delivery to /courier Mobile Portal 📱
     └── 3. Courier Shift Flips to "OPEN SHIFT" (🟡 Amber)
           │
           ▼
[ Courier Field Delivery ]
     ├── Opens /courier on Smartphone
     ├── Calls Customer via Anonymous Twilio Call-Masking 📞
     └── Collects Physical Cash & Taps "Complete Delivery" ✅
           │
           ▼
[ End of Day Cash Handover ("סגירת קופה") ]
     ├── Manager clicks "Close Shift & Settle" on Courier Card
     ├── Reconciles Expected Cash vs Physical Cash Received
     └── Shift Flips to "RECONCILED" (🟢 Emerald)
```

---

### The 3 Courier Shift States:

| Shift State | Visual Badge | Condition & Meaning |
| :--- | :--- | :--- |
| **No Shift / Idle** (`ללא משמרת`) | ⚪ **Neutral Slate** | **0 Deliveries • ₪0 Cash**: Courier is active in the roster but has no orders assigned today. Button displays *"No Deliveries Today"* (`אין פעילות היום`). |
| **Open Shift** (`משמרת פעילה`) | 🟡 **Active Amber** | **Active Cash in Hand**: An order was assigned to the courier. Cash accumulates in real-time. Button illuminates green: *"סגירת קופה / Close Shift"*. |
| **Shift Reconciled** (`הקופה נסגרה`) | 🟢 **Emerald Green** | **Cash Envelope Verified**: Manager verified and closed the register. All today's orders marked settled and logged in `cash_settlements`. |

---

### How to Assign Orders to Couriers (1-Click Dispatch)
1. Open the **Dispatches & Orders Console** (`/crm`) in the sidebar.
2. In the orders table, locate the **Assigned Courier (`שליח משובץ`)** column.
3. For any incoming order, click the dropdown:
   - Select the desired courier driver (e.g., `🛵 דני שליחויות מרכז` or `🛵 יוסי אקספרס דרום`).
4. **Immediate System Reaction**:
   - The courier's shift immediately switches to **`Open Shift`**.
   - Their cash to collect tally increases by the order price.
   - An instant **Telegram Dispatch Alert** is sent to the courier's Telegram (if their Telegram ID is registered).
   - The order appears instantly on their mobile phone at `/courier`.

---

### Instant Courier Telegram Dispatch Notification
When a courier is assigned in the CRM, the Telegram bot automatically dispatches a private message to their personal Telegram:
```text
🛵 הזמנה חדשה שובצה עבורך!
━━━━━━━━━━━━━━━━━━━━━
📍 כתובת: מרקו לויז - הנשיאים 57 פתח תקווה
🏙️ עיר: פתח תקווה
💵 סכום לגבייה: ₪3,000 מזומן
```

---

### Shift Closeout Workflow (`סגירת קופה`):
1. Navigate to **Courier Settlements** (`קופת שליחים`) in the CRM sidebar.
2. At the top, view live summary metrics:
   - **Total Cash Today**: Total cash collected across all couriers.
   - **Reconciled Cash**: Physical cash already received and closed out in the safe.
   - **Outstanding Balance**: Cash currently in courier hands on the road.
   - **Active Couriers**: Couriers currently active on duty today (e.g. `2 of 4 on duty today`).
3. Click **"סגירת קופה / Close Shift"** on the courier handing in their envelope.
4. The reconciliation modal displays:
   - **Expected Cash**: Calculated automatically from all today's delivered orders.
   - **Physical Cash Received**: Manager enters counted cash.
   - **Difference Indicator**:
     - `Balanced (0₪)`: Perfect match.
     - `Shortage`: Highlighted in red with reason notes.
     - `Overage`: Highlighted in emerald.
5. Click **"Confirm Closeout"** (`אשר סגירת קופה`):
   - Orders are marked `is_settled: true`.
   - A permanent transaction log is archived in `cash_settlements`.
   - The courier's card badge turns **`✓ Shift Reconciled` (🟢)**.
   - At midnight, the next calendar day starts and couriers return to `No Shift / Idle`.

---

## 👥 5. Courier Mobile Portal (`/courier`) & Twilio Call Masking

The mobile portal is built specifically for drivers on the road, with an emphasis on **OPSEC and Customer Privacy**:

1. **Secure Login**: Drivers log in at `/login` and are automatically directed to `/courier`.
2. **Customer Privacy Protection**: The customer's real Israeli phone number is **never exposed** in the browser or code.
3. **Active Route**: Couriers only see deliveries assigned specifically to them for today.
4. **Twilio Anonymous Call-Masking**:
   - The driver taps **"Call Customer"** (`חייג ללקוח`).
   - The system rings the driver's phone through a virtual Twilio proxy number, which bridges directly to the customer.
   - The customer sees only the proxy business number, protecting the driver's private SIM.
   - The driver never learns the customer's personal number.
5. **Mark Completed**: Once the package is delivered and cash is collected, the driver taps **"Complete Delivery"** to advance their route.

---

## 🌐 6. Bilingual Interface & Mobile Drawer

- **One-Tap Language Toggle**: Click `🌐 עברית (RTL)` or `🌐 English (LTR)` in the top header. The entire layout, text orientation, tables, and alignment switch immediately.
- **Mobile Responsive Drawer**:
  - On phones and tablets (`< lg`), tap the **Hamburger Menu** icon in the header to reveal the full navigation drawer.
  - Tap the **'X' Close Icon** or anywhere on the backdrop to dismiss the drawer.
  - Selecting any page automatically navigates and smoothly closes the drawer.

---

## ⚙️ 7. Environment Configuration Reference

The following environment variables in `.env.local` govern the live operations:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client API key | `eyJhbGci...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Administrative service key | `eyJhbGci...` |
| `ALLOWED_TELEGRAM_ADMIN_IDS` | Comma-separated Telegram user IDs allowed to forward orders | `123456789,987654321` |
| `TELEGRAM_BOT_TOKEN` | Bot API token from @BotFather | `7123456789:AAH...` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID for call masking | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `...` |
| `TWILIO_PHONE_NUMBER` | Masking proxy phone number | `+972...` |

---

## 🆔 8. Managing Telegram IDs Directly in the CRM

Managers and dispatchers do not need to edit `.env` files or restart servers to authorize Telegram access or connect couriers:

### A. Authorizing Managers to Forward Orders to the Bot
1. Open the CRM and click **Settings & Profile** (`הגדרות ופרופיל`) in the navigation bar.
2. Under the **Personal Profile** (`פרופיל אישי`) tab, scroll to **Telegram Whitelist ID Binding [OPSEC Guard]**.
3. Enter your:
   - **Telegram ID**: Numeric ID (e.g. `5338301589`).
   - **Telegram Handle**: Username (e.g. `@frdi45`).
   - **Display Name**: Name (e.g. `✌️ מנהל חשבונות 🤚`).
4. Click **Save Profile Changes** (`שמור שינויים בפרופיל`).
5. *Result*: The Telegram bot webhook dynamically queries active manager profiles and authorizes order forwarding in real time.

### B. Binding Couriers for Automated Telegram Dispatch Alerts
1. Open **Courier Settlements** (`קופת שליחים`) or click **Manage Couriers** (`ניהול שליחים`).
2. Click **Edit (✏️)** on the courier driver (or **Add New Courier**).
3. In the **Telegram ID** field, enter the driver's numeric ID (e.g. `5338301589`).
4. Click **Save Courier** (`שמור שליח`).
5. *Result*: Whenever an order is assigned to this courier, the bot automatically sends them a private dispatch alert on Telegram with a 1-tap link to `/courier`.

---

## 🧹 9. Switching from Demo Mode to Live Operations

The CRM includes a built-in safety action for transitioning from demo/testing to production:
1. In the sidebar, click **Purge Demo Orders** (`Live Clean`).
2. This safely removes all simulated test dispatches and resets the courier daily cash to ₪0, while preserving your full product catalog, brand personas, and active couriers.
3. You are now 100% ready to receive live forwarded dispatches from Telegram!
