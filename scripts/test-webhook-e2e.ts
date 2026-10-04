import { parseDeliveryMessage } from '../lib/crm/parser'
import { formatBatchReceipt } from '../lib/crm/telegram-bot'

const testRawMessage = `מרקו לויז - הנשיאים 57 פתח תקווה
0549777288
לקוח קבוע
2 גלאטו 33/ 20 רפואי האני 
2 אלסקה/ 20 רפואי מלון 
2 בראון / 20 רפואי גלקסי  
3000₪ כולל משלוח 

🤓 אמריקה ישראל  🤓`

console.log('===============================================================')
console.log('🧪 VERIFYING TELEGRAM INGESTION & RECEIPT GENERATOR')
console.log('===============================================================\n')

const parsed = parseDeliveryMessage(testRawMessage)

console.log('Parsed Delivery Order:')
console.log(' - Customer Name:', parsed.customerName)
console.log(' - City:', parsed.city)
console.log(' - Phone:', parsed.phoneNumber)
console.log(' - Brand:', parsed.brand)
console.log(' - Price:', parsed.totalPrice)
console.log(' - Deductions Count:', parsed.deductions.length)

// Simulate receipt formatting
const receipt = formatBatchReceipt({
  totalProcessed: 1,
  totalCashToday: 3000,
  totalDeductions: parsed.deductions.map(d => ({
    productName: d.warehouseProductName,
    quantity: d.quantity,
    unit: d.unit
  })),
  recentDeliveries: [
    {
      address: parsed.customerName,
      brand: parsed.brand,
      price: parsed.totalPrice
    }
  ],
  crmUrl: 'https://www.couriercall.site/crm'
})

console.log('\n--- TELEGRAM RECEIPT PREVIEW ---')
console.log(receipt)
console.log('--------------------------------\n')

if (receipt.includes('3,000') && receipt.includes('רפואי האני') && receipt.includes('/crm')) {
  console.log('✅ RECEIPT FORMATTING VERIFIED')
} else {
  console.error('❌ RECEIPT VERIFICATION FAILED')
  process.exit(1)
}
