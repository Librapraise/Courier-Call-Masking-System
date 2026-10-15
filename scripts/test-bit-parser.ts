import { parseDeliveryMessage, getOrderPaymentInfo } from '../lib/crm/parser'

const testMessage = `שי עגנון 2 קרית אונו
0584871984
@Sirsmokalot
לקוח קבוע ✔
10 גרם פופקרן סגול 
500₪ שולם בביט ❗️❗️

גורילה שופ
תיבה מספר 7 ❗`

const parsed = parseDeliveryMessage(testMessage)
console.log('--- TEST PARSED DELIVERY ---')
console.log('Customer/Address:', parsed.customerName)
console.log('City:', parsed.city)
console.log('Total Price (Revenue):', parsed.totalPrice)
console.log('Payment Method:', parsed.paymentMethod)
console.log('Is Prepaid:', parsed.isPrepaid)
console.log('Cash To Collect (Courier):', parsed.cashToCollect)

const paymentInfo = getOrderPaymentInfo({
  total_price: parsed.totalPrice,
  raw_message: testMessage
})
console.log('\n--- GET ORDER PAYMENT INFO ---')
console.log('Label He:', paymentInfo.labelHe)
console.log('Badge Text:', paymentInfo.badgeText)
console.log('Cash To Collect:', paymentInfo.cashToCollect)
console.log('Is Prepaid:', paymentInfo.isPrepaid)

if (parsed.totalPrice === 500 && parsed.isPrepaid && parsed.cashToCollect === 0 && parsed.paymentMethod === 'BIT') {
  console.log('\n✅ TEST PASSED PERFECTLY!')
} else {
  console.error('\n❌ TEST FAILED!')
  process.exit(1)
}
