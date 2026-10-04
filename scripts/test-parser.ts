import { parseDeliveryMessage } from '../lib/crm/parser'

const testMessages = [
  {
    name: 'Sample 1: Slash Substituted Inventory (3 Strains + Missing Vowel גלקסי)',
    text: `מרקו לויז - הנשיאים 57 פתח תקווה
0549777288
לקוח קבוע
2 גלאטו 33/ 20 רפואי האני 
2 אלסקה/ 20 רפואי מלון 
2 בראון / 20 רפואי גלקסי  
3000₪ כולל משלוח 

🤓 אמריקה ישראל  🤓`
  },
  {
    name: 'Sample 2: Trailing Line Warehouse Deduction',
    text: `סמטת העליה 6 בני עייש
053-4545760
@elanovitch
לקוח קבוע✔️
10 גרם גנטיקה קאלי 🇮🇱🇺🇸
חשיש בלונדי מתנה 🎁
750₪ כולל משלוח

מלך הרפואי
10 טריפ ציפ גדול`
  },
  {
    name: 'Sample 3: Modiin Address + Phone + Telegram Handle',
    text: `אבני החושן 7 מודיעין
@AAA1967AAA
0507777118
לקוח קבוע לפנק
3 גבוהה חדש vip
₪1100 כולל משלוח

המחתרת בני אור`
  },
  {
    name: 'Sample 4: Rishon LeZion + Boutique',
    text: `רמבם 56 ראשון לציון
0504020514
@Lil555
לקוח קבוע
30 גרם בוטיק
חשיש מתנה
₪ 1,200 כולל משלוח

אמריקה ישראל`
  },
  {
    name: 'Sample 5: Netanya + GORILLA',
    text: `חתם סופר 9 נתניה
0545749721
400₪
לקוח חדש לפנק
20 גרם תפזורת נדירה
גורילה הזמנות`
  }
]

console.log('===============================================================')
console.log('🧪 RUNNING GHOSTCRM PARSER UNIT TESTS ACROSS GROUND TRUTH SAMPLES')
console.log('===============================================================\n')

let passed = 0

for (let i = 0; i < testMessages.length; i++) {
  const t = testMessages[i]
  console.log(`--- [TEST ${i + 1}] ${t.name} ---`)
  const result = parseDeliveryMessage(t.text)

  console.log(`📍 Customer Name: "${result.customerName}"`)
  console.log(`🏙️  City: "${result.city}"`)
  console.log(`📞 Phone: "${result.phoneNumber}"`)
  console.log(`✈️  Telegram: "${result.telegramHandle || 'None'}"`)
  console.log(`⭐ Tier: "${result.customerType}"`)
  console.log(`🏷️  Brand: "${result.brand}"`)
  console.log(`💰 Price: ₪${result.totalPrice}`)
  console.log(`📋 Menu Items: "${result.menuItems}"`)
  console.log(`📦 Warehouse Deductions: "${result.actualItems}"`)
  console.log(`🔍 Itemized Deductions count:`, result.deductions.length)

  // Verify critical checks
  let isOk = true
  if (!result.customerName) { console.error('❌ Failed: missing customer name'); isOk = false }
  if (!result.phoneNumber) { console.error('❌ Failed: missing phone number'); isOk = false }
  if (result.totalPrice <= 0) { console.error('❌ Failed: price not extracted'); isOk = false }
  if (result.brand === 'כללי') { console.error('❌ Failed: brand not matched'); isOk = false }
  if (result.deductions.length === 0) { console.error('❌ Failed: no product deductions generated'); isOk = false }

  if (isOk) {
    console.log('✅ TEST PASSED\n')
    passed++
  } else {
    console.log('❌ TEST FAILED\n')
  }
}

console.log('===============================================================')
console.log(`🎉 TEST SUMMARY: ${passed}/${testMessages.length} PASSED`)
console.log('===============================================================')

if (passed !== testMessages.length) {
  process.exit(1)
}
