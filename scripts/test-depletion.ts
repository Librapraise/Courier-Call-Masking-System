import { parseBatchDepletionMessage, formatDepletionTelegramReport } from '../lib/crm/depletion-parser'
import { CATALOG_PRODUCTS } from '../lib/crm/catalog-data'

const testMessage = `להוריד מהמלאי

זלושי יבוא - 10
פופ כתום - 10
פופ סגול - 25
פופ בוטיק - 10
רפואי האני - 20
רפואי דראג - 43
רפואי תפוז - 13
רפואי פינאפל - 14
ביטים בננה - 5
גבוה - 2
ריינבו גדול- 5`

// Mock catalog with cost per unit
const mockCatalog = CATALOG_PRODUCTS.map((p, idx) => ({
  id: `prod-${idx}`,
  name: p.name,
  category: p.category,
  unit: p.unit,
  stock_on_hand: 100,
  cost_per_unit: 21, // e.g. 21 NIS
  aliases: p.aliases
}))

// Mock today sales map
const mockSalesMap = new Map<string, number>([
  ['זלושי יבוא', 500],
  ['פופקורן כתום', 400],
  ['פופקורן סגול', 1000],
  ['פופקורן בוטיק', 450],
  ['רפואי האני', 800],
  ['רפואי דראג', 1700],
  ['רפואי תפוז', 550],
  ['רפואי פינאפל', 600],
  ['ביטים בננה', 250],
  ['גבוהה VIP', 200],
  ['ריינבו גדול', 300]
])

const report = parseBatchDepletionMessage(testMessage, mockCatalog, mockSalesMap)

console.log('--- TEST BATCH DEPLETION PARSER RESULTS ---')
console.log(`Total lines matched: ${report.items.length}/${report.items.length + report.unmatchedItems.length}`)
report.items.forEach(item => {
  console.log(`✅ [${item.productName}] -> Matched: "${item.matchedProductName}" | Qty: ${item.quantity}${item.unit} | Cost: ₪${item.totalCost} | Sales: ₪${item.todayRevenue} | Profit: ₪${item.grossProfit}`)
})

if (report.unmatchedItems.length > 0) {
  console.log('❌ Unmatched items:', report.unmatchedItems)
}

console.log('\n--- FORMATTED TELEGRAM REPORT ---\n')
console.log(formatDepletionTelegramReport(report))
