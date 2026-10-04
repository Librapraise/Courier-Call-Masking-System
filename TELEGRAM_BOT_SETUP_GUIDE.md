# Telegram Bot Setup & Activation Guide
## GhostCRM Ingestion Engine

This guide walks you through setting up and activating the Telegram Ingestion Bot so operators can forward delivery messages directly into the CRM.

---

## 📋 Prerequisites
1. A Telegram account on your phone or desktop.
2. Access to your project's `.env.local` file.

---

## 🤖 Step 1: Create Your Bot via @BotFather (60 Seconds)

1. Open Telegram and search for **`@BotFather`** (the official bot with the verified blue checkmark).
2. Click **Start** (or send `/start`).
3. Send the command:
   ```text
   /newbot
   ```
4. **Choose a Display Name** (e.g., `GhostCRM Dispatch Bot` or `מוקד משלוחים`).
5. **Choose a Username** for the bot ending in `bot` (e.g., `ghost_dispatch_bot` or `mycrm_delivery_bot`).
6. BotFather will reply with your **HTTP API Token**. It looks like this:
   ```text
   7123456789:AAHq_xxxxxxxxx_xxxxxxxxxxxx
   ```
   > ⚠️ **Keep this token secret!** Anyone with this token can control the bot.

---

## 🔑 Step 2: Configure Environment Variables

Open your project's `.env.local` file and add the following two variables:

```env
# ----------------------------------------
# Telegram Bot Configuration
# ----------------------------------------
TELEGRAM_BOT_TOKEN=7123456789:AAHq_xxxxxxxxx_xxxxxxxxxxxx

# OPSEC Security Whitelist:
# Comma-separated list of authorized Telegram User IDs.
# Leave empty to allow any user to test initially, or lock it down:
ALLOWED_TELEGRAM_ADMIN_IDS=
```

### 💡 How to Find Your Telegram User ID:
1. In Telegram, search for **`@userinfobot`** or **`@raw_data_bot`**.
2. Click **Start**.
3. It will immediately show your numeric ID (e.g. `123456789`).
4. Add your ID (and the dispatcher's ID) to `ALLOWED_TELEGRAM_ADMIN_IDS`:
   ```env
   ALLOWED_TELEGRAM_ADMIN_IDS=123456789,987654321
   ```

---

## 🌐 Step 3: Register the Webhook with Telegram

To instruct Telegram to send all incoming messages to your Next.js application, register the webhook:

### Production (Once deployed to your domain):
Open your web browser and navigate to this URL (replace `<YOUR_BOT_TOKEN>` with your actual token):

```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://www.couriercall.site/api/telegram/webhook
```

### Expected Response:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

### Local Development (Using Ngrok / Localtunnel):
If you want to test the Telegram bot locally on your machine before deploying:
1. Start your local dev server:
   ```bash
   npm run dev
   ```
2. In another terminal, expose your local port (e.g. 3000) using ngrok:
   ```bash
   npx ngrok http 3000
   ```
3. Copy your HTTPS forwarding URL (e.g. `https://abcd-123.ngrok-free.app`).
4. Register the webhook:
   ```text
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://abcd-123.ngrok-free.app/api/telegram/webhook
   ```

---

## 🧪 Step 4: Verification & Live Testing

1. Open your new bot in Telegram.
2. Send the command:
   ```text
   /start
   ```
   * The bot will reply with a welcome message in Hebrew and a direct button/link to the CRM dashboard.
3. Forward or copy-paste a real delivery message into the bot:
   ```text
   מרקו לויז - הנשיאים 57 פתח תקווה
   0549777288
   לקוח קבוע
   2 גלאטו 33/ 20 רפואי האני 
   2 אלסקה/ 20 רפואי מלון 
   2 בראון / 20 רפואי גלקסי  
   3000₪ כולל משלוח 

   🤓 אמריקה ישראל  🤓
   ```
4. **Immediate Response**:
   The bot will process the message and reply within 1–2 seconds with an itemized receipt:
   ```text
   ✅ נקלטו 1 משלוחים בהצלחה בסיארם!
   ━━━━━━━━━━━━━━━━━━━━━
   💰 קופת שליחים שנצברה: ₪3,000
   📦 מלאי שירד מהמחסן:
     • 20g רפואי האני
     • 20g רפואי מלון
     • 20g רפואי גלאקסי
   📍 משלוחים אחרונים שנקלטו:
     • מרקו לויז - הנשיאים 57 פתח תקווה | ₪3000 (אמריקה ישראל)
   🔗 פתח את ה-CRM לצפייה ופילוח
   ```

---

## 🔍 Step 5: Check Webhook Status Anytime

If you ever need to inspect whether the webhook is running properly:
```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

To delete or disconnect the webhook:
```text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook
```
