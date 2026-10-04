# Master Product Requirements Document (PRD v1 & v2 Consolidated)
## Project: Multi-Brand Telegram-Ingested Delivery, Inventory & CRM Engine ("GhostCRM")
**System Location**: Integrated into `Courier-Call-Masking-System` with dedicated route `/crm`

---

## 1. Executive Summary & Operational Context

### 1.1 Business Model & Problem Statement
The client operates an extensive delivery network in Israel consisting of **37 distinct brand personas** ("פרצופים" / supplier aliases, e.g., *אמריקה ישראל*, *המחתרת בני אור*, *כיכר המדינה*) and a live warehouse catalog spanning medical, boutique, imported strains, popcorn, hashish, extracts, oils, vapes, and edibles.
Currently, daily operations generate 20–100+ delivery dispatches managed directly inside private Telegram groups. Processing orders, tracking repeat purchases, monitoring warehouse inventory, and reconciling cash collected by couriers is done manually, leading to lost time, data leakage, and uncollected revenue.

### 1.2 Core Business Realities & Operational Ground Rules
1. **Customer Identity = Address**: Customers do NOT provide real legal names. **The customer's street address is their official display name in the CRM** (e.g., `מרקו לויז - הנשיאים 57 פתח תקווה` or `רמבם 56 ראשון לציון`).
2. **Unique Deterministic Key**: Israeli Mobile Phone Number (`05X-XXXXXXX`) and/or Telegram Username (`@handle`).
3. **The "Slash" / "Substituted Inventory" Rule (Crucial Operational Logic)**:
   - What the customer sees on the public menu is often substituted by actual warehouse stock.
   - Example 1: `2 גלאטו 33/ 20 רפואי האני`
     - Before the slash (`2 גלאטו 33`): Customer-facing menu name.
     - **After the slash (`20 רפואי האני`): The actual warehouse product to deduct from inventory!**
   - Example 2: In some messages, the menu name is on top, and the actual product is written at the very bottom beneath the brand:
     ```text
     סמטת העליה 6 בני עייש
     053-4545760
     לקוח קבוע
     10 גרם גנטיקה קאלי 🇮🇱🇺🇸   <-- Customer-facing menu name
     750₪ כולל משלוח
     מלך הרפואי                <-- Brand / Supplier
     10 טריפ ציפ גדול          <-- ACTUAL warehouse item to deduct!
     ```
   - **Engine Rule**: The parser must always identify the **actual warehouse strain/quantity** (after the slash, or from the bottom deduction line) to update inventory, while storing the customer-facing line in the order history.
4. **Fuzzy Spelling & Hebrew Variant Tolerance**:
   - Couriers frequently have typos or alternate spellings (e.g. `רפואי גלאקסי` in catalog vs. `רפואי גלקסי` in message; `פופקרן` vs `פופקורן`).
   - The system **MUST NOT fail on missing vowels/letters**. It uses fuzzy string matching (Levenshtein distance / Soundex / synonym dictionary) to accurately match the warehouse SKU.
5. **Couriers & Daily Cash Settlement ("סגירת קופה")**:
   - Couriers accumulate cash from deliveries. The system must calculate the daily cash collected per courier shift and allow one-click settlement.
6. **Bilingual UI Architecture**:
   - Default language: **English (LTR)**.
   - One-tap toggle button (`🌐 EN | עב`) in header to switch to **Hebrew (RTL)**.

---

## 2. Master System Catalogs (Pre-Seeded)

### 2.1 The 37 Pre-Seeded Brands / Supplier Personas
```
1.  מנהל גיבוי הזמנות
2.  כיכר המדינה
3.  מעבר כיכר המדינה
4.  המחתרת בני אור
5.  נחמן הגדול
6.  גורילה הזמנות
7.  צמפיון הזמנות
8.  מלך התפזורות
9.  קוקיס
10. המשגיחים
11. הגנן
12. המשפוחס
13. דוקטור וויד
14. אמריקה ישראל
15. דוקטור באקס
16. רפואי לחיים
17. תמרה
18. המתכון הסודי
19. מלך הרפואי
20. הפרח היומי
21. זיג זג
22. הקוסם
23. בוב מארלי
24. בית מרקחת כללית
25. המחסנאי
26. המותג
27. יאלו
28. הרפואי של המדינה
29. מיץ גת הזמנות
30. המומחים לרפואי
31. אסף משלוחים
32. גאנגו שופ
33. גורילה שופ
34. קאנה פיקס
35. תן לי גראס
36. דוקטור באץ
37. טלא פפ
```

### 2.2 Product Inventory Catalog & Initial Stock (Dated 29/9)
| Category | SKU / Product Name | Aliases & Typo Variants | Unit | Initial Stock |
| :--- | :--- | :--- | :--- | :--- |
| **רפואי פרימיום** | רפואי מוזל | מוזל | grams | 35 |
| | רפואי מלון | מלון | grams | 20 |
| | רפואי דקסטר | דקסטר | grams | 527 |
| | רפואי גלאקסי | רפואי גלקסי, גלאקסי, גלקסי | grams | 68 |
| | רפואי האני | האני | grams | 1,453 |
| **פופקורן** | פופקורן כתום | פופקרן כתום | grams | 490 |
| | פופקורן סגול | פופקרן סגול | grams | 450 |
| **ביטים גנטיקה** | ביטים בירדיי קייק | בירדיי קייק, בירטדיי | grams | 205 |
| | ביטים סן דייגו | סן דייגו | grams | 113 |
| **באצונים גנטיקה** | סודה טרייפ באצונים | סודה טריפ | grams | 6.5 |
| | פרפל באצונים | פרפל | grams | 4.5 |
| | סופר באצונים | סופר | grams | 5.5 |
| | מאי טאי באצונים | מאי טאי | grams | 7.0 |
| | אלקטרה באצונים | אלקטרה | grams | 5.0 |
| | קיפר באצונים | קיפר | grams | 56.0 |
| | צ'יפס טריפ באצונים | ציפס טריפ | grams | 80.0 |
| | בארי קרים באצונים | בארי קרים | grams | 76.0 |
| | בלו זושי באצונים | בלו זושי | grams | 80.0 |
| **גדול גנטיקה** | ליברדי גדול | ליברטי | grams | 24 |
| | צ׳יפ טריפ גדול | טריפ ציפ גדול, צ'יפ טריפ | grams | 0 |
| | בארי קרים גדול | בארי קרים | grams | 62 |
| | ריינבו גדול | ריינבאו גדול | grams | 95 |
| | קיפר גדול | קיפר | grams | 115 |
| | זושי גדול | זושי | grams | 80 |
| **קאלי יבוא** | למנייד יבוא | למונייד | grams | 23 |
| | סקאנק יבוא | סקאנק | grams | 53 |
| | ספלינט יבוא | ספלינט | grams | 30 |
| | ריין יבוא | ריין | grams | 40 |
| | אליזבת יבוא | אליזבת | grams | 22 |
| | באבל גם יבוא | באבלגאם | grams | 34 |
| | זלושי יבוא | זלושי | grams | 19 |
| | ריינבאו יבוא | ריינבו | grams | 43 |
| **תפזורות** | תפזורת בוטיק | תפזורת בוטיק | grams | 6,248 |
| | תפזורת חממה | תפזורת חממה | grams | 55 |
| | תפזורת יקרה | תפזורת יקרה | grams | 4,900 |
| **חשיש** | חשיש יבוא | יבוא חשיש | grams | 202 |
| | חשיש רגיל | חשיש רגיל | grams | 0 |
| | פיתות חשיש רגיל | פיתה חשיש | units | 7 |
| | קוביות חשיש בלונדי | קוביה בלונדי | units | 11 |
| | חשיש בלונדי | בלונדי | grams | 34 |
| **מיוחדים - מיצוי גת**| מיצוי גת אדום | גת אדום | units | 29 |
| | מיצוי גת ירוק | גת ירוק | units | 8 |
| | בקבוק מיץ גת | בקבוק גת | units | 8 |
| **שמן קנאביס** | שמן קנאביס סאטיבה | שמן סאטיבה | units | 3 |
| | שמן קנאביס היברידי | שמן היברידי | units | 2 |
| | שמן קנאביס אינדיקה | שמן אינדיקה | units | 1 |
| **עטי אידוי** | עט אידוי | וייפ | units | 20 |
| **אכילים** | אוראו כחול | עוגיות אוראו כחול | units | 22 |
| | אוראו חום | עוגיות אוראו חום | units | 8 |
| | חמצוצים | חמצוצים | units | 11 |

---

## 3. Dedicated Routing & Access Separation

| Route | Target Audience | Functionality |
| :--- | :--- | :--- |
| `/crm` | **Manager / Owner Only** | Password-protected bilingual CRM, Brand/City filters, Live Inventory, Courier Cash Settlement, CSV Export |
| `/courier` | **Couriers Only** | Existing Twilio-masked call interface; sees delivery address without customer phone numbers |
| `/admin` | **System Admin** | Global system configuration and logs |
| `/api/telegram/webhook` | **Telegram Ingestion** | Secure endpoint receiving forwarded dispatch batches |

---

## 4. Technical Architecture & Database Models (Supabase / PostgreSQL)

### 4.1 Required Tables in Supabase:
1. `brands` (id, name, created_at)
2. `customers` (id, name [address], city, phone [unique], telegram_handle, customer_type, notes, total_orders, total_spent, created_at, updated_at)
3. `couriers` (id, name, telegram_id, phone, is_active, created_at)
4. `products` (id, name, category, aliases, unit, stock_on_hand, created_at, updated_at)
5. `orders` (id, customer_id, brand_id, courier_id, address, city, menu_items, actual_items, total_price, is_settled, raw_text, order_date, created_at)
6. `inventory_transactions` (id, product_id, order_id, quantity, reason, created_at)
7. `cash_settlements` (id, courier_id, date, total_collected, amount_received, difference, status, notes, created_at)

---

## 5. Security & OPSEC Guidelines
1. **Telegram Whitelist Verification**: Reject any webhook call where `from.id` is not in `ALLOWED_TELEGRAM_ADMIN_IDS`.
2. **Customer Phone Obfuscation for Couriers**: Retain the existing Twilio masking so couriers never see real phone numbers.
3. **RBAC & CSRF Protection**: CRM dashboard protected by Supabase session auth with auto-logout.
4. **Data Sanitization**: Sanitize incoming Hebrew text to prevent XSS and SQL injection.
