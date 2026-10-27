import { parseDeliveryMessage, extractPrice } from '../lib/crm/parser'

console.log('=== TEST 1: Message 1 from user screenshot (price AFTER 2 קוק) ===')
const msg1 = `קלאוזנר 4 רמלה
0533538452
@Elieli066
2 קוק
1,100₪
משלוח חיצוני !`
const res1 = parseDeliveryMessage(msg1)
console.log('Result 1:', {
  customerName: res1.customerName,
  city: res1.city,
  phone: res1.phoneNumber,
  price: res1.totalPrice,
  paymentMethod: res1.paymentMethod,
  isPrepaid: res1.isPrepaid,
  cashToCollect: res1.cashToCollect,
  paymentLabel: res1.paymentLabel,
  menuItems: res1.menuItems
})

console.log('\n=== TEST 2: Message 2 from user screenshot (price BEFORE 2 קוק) ===')
const msg2 = `קלאוזנר 4 רמלה
0533538452
@Elieli066
1,100₪
2 קוק
משלוח חיצוני !`
const res2 = parseDeliveryMessage(msg2)
console.log('Result 2:', {
  customerName: res2.customerName,
  city: res2.city,
  phone: res2.phoneNumber,
  price: res2.totalPrice,
  paymentMethod: res2.paymentMethod,
  isPrepaid: res2.isPrepaid,
  cashToCollect: res2.cashToCollect,
  paymentLabel: res2.paymentLabel,
  menuItems: res2.menuItems
})

console.log('\n=== TEST 3: Price in different positions & formats ===')
const testCases = [
  { name: '500₪ at top', text: `500₪\nהרצל 12 תל אביב\n0521234567\n10 רפואי מלון`, expected: 500 },
  { name: '500₪ at bottom', text: `הרצל 12 תל אביב\n0521234567\n10 רפואי מלון\n500₪`, expected: 500 },
  { name: '500 ₪ with space', text: `הרצל 12 תל אביב\n0521234567\n500 ₪\n10 רפואי מלון`, expected: 500 },
  { name: '₪500 prefix', text: `הרצל 12 תל אביב\n0521234567\n₪500\n10 רפואי מלון`, expected: 500 },
  { name: '₪ 500 prefix with space', text: `הרצל 12 תל אביב\n0521234567\n₪ 500\n10 רפואי מלון`, expected: 500 },
  { name: '500 ש"ח', text: `הרצל 12 תל אביב\n0521234567\n500 ש"ח\n10 רפואי מלון`, expected: 500 },
  { name: '500 שח', text: `הרצל 12 תל אביב\n0521234567\n500 שח\n10 רפואי מלון`, expected: 500 },
  { name: '500 NIS', text: `הרצל 12 תל אביב\n0521234567\n500 NIS\n10 רפואי מלון`, expected: 500 },
  { name: '500 nis lowercase', text: `הרצל 12 תל אביב\n0521234567\n500 nis\n10 רפואי מלון`, expected: 500 },
  { name: 'NIS 500 prefix', text: `הרצל 12 תל אביב\n0521234567\nNIS 500\n10 רפואי מלון`, expected: 500 },
  { name: '1.100₪ dot thousand separator', text: `הרצל 12 תל אביב\n0521234567\n1.100₪\n10 רפואי מלון`, expected: 1100 },
  { name: '1,100₪ comma thousand separator', text: `הרצל 12 תל אביב\n0521234567\n1,100₪\n10 רפואי מלון`, expected: 1100 },
  { name: 'Price inline with item', text: `הרצל 12 תל אביב\n0521234567\n10 רפואי מלון 500₪`, expected: 500 },
  { name: 'Price inline with address', text: `הרצל 12 תל אביב 500₪\n0521234567\n10 רפואי מלון`, expected: 500 },
  { name: 'Price with סכום לגבייה: 1100', text: `הרצל 12 תל אביב\n0521234567\nסכום לגבייה: 1100\n10 רפואי מלון`, expected: 1100 }
]

let allPassed = true
for (const tc of testCases) {
  const p = parseDeliveryMessage(tc.text).totalPrice
  const ok = p === tc.expected
  if (!ok) allPassed = false
  console.log(`${ok ? '✅' : '❌'} [${tc.name}]: got ${p}, expected ${tc.expected}`)
}

if (!allPassed || res1.totalPrice !== 1100 || res1.cashToCollect !== 1100 || res1.isPrepaid !== false) {
  console.error('\n❌ FAILURES DETECTED!')
  process.exit(1)
} else {
  console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!')
}
