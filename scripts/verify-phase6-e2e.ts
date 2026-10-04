import './load-env'
import { supabaseAdmin } from '../lib/supabase/server'
import { parseDeliveryMessage } from '../lib/crm/parser'
import { ingestParsedDelivery } from '../lib/crm/ingestion-service'
import { matchBrand, matchWarehouseProduct } from '../lib/crm/fuzzy-matcher'
import { TRANSLATIONS } from '../lib/crm/translations'
import { extractCityFromAddress } from '../lib/crm/israeli-cities'

async function runPhase6Verification() {
  console.log('========================================================================')
  console.log('🚀 GHOSTCRM PHASE 6: END-TO-END VERIFICATION & ACCEPTANCE SUITE')
  console.log('========================================================================\n')

  let allPassed = true

  // -------------------------------------------------------------------------
  // SUITE 1: BILINGUAL TRANSLATION DICTIONARY SYMMETRY
  // -------------------------------------------------------------------------
  console.log('📋 [SUITE 1] Testing Bilingual Translations Completeness (EN <-> HE)...')
  const enKeys = Object.keys(TRANSLATIONS.en).sort()
  const heKeys = Object.keys(TRANSLATIONS.he).sort()

  const missingInHe = enKeys.filter(k => !(k in TRANSLATIONS.he))
  const missingInEn = heKeys.filter(k => !(k in TRANSLATIONS.en))

  if (missingInHe.length === 0 && missingInEn.length === 0) {
    console.log(`✅ Translations perfectly symmetric: ${enKeys.length} matching keys in both EN and HE.`)
  } else {
    console.error(`❌ Translation keys mismatch! Missing in HE:`, missingInHe, `Missing in EN:`, missingInEn)
    allPassed = false
  }

  // -------------------------------------------------------------------------
  // SUITE 2: FUZZY MATCHER & SPELLING TYPO TOLERANCE
  // -------------------------------------------------------------------------
  console.log('\n🔤 [SUITE 2] Testing Fuzzy Spelling Variants & Missing Vowels...')
  const fuzzyCases = [
    { input: '20 רפואי גלקסי', expectedProd: 'רפואי גלאקסי', expectedQty: 20 },
    { input: '10 פופקרן', expectedProd: 'פופקורן כתום', expectedQty: 10 },
    { input: '15 ציפ טריפ גדול', expectedProd: "צ'יפ טריפ גדול", expectedQty: 15 },
    { input: 'חשיש בלונדי מתנה', expectedProd: 'חשיש בלונדי', expectedQty: 1 },
    { input: '3 גבוהה vip', expectedProd: 'גבוהה VIP', expectedQty: 3 }
  ]

  let fuzzySuccess = 0
  for (const tc of fuzzyCases) {
    const matched = matchWarehouseProduct(tc.input)
    if (matched && matched.product.name === tc.expectedProd && matched.quantity === tc.expectedQty) {
      console.log(`  ✅ "${tc.input}" -> Matched "${matched.product.name}" (${matched.quantity}${matched.unit})`)
      fuzzySuccess++
    } else {
      console.error(`  ❌ Failed match for "${tc.input}": got`, matched?.product.name, 'qty:', matched?.quantity)
      allPassed = false
    }
  }
  console.log(`  Result: ${fuzzySuccess}/${fuzzyCases.length} fuzzy strain tests passed.`)

  // Brand matching with emojis & slight typos
  const brandCases = [
    { input: '👑 מלך הרפואי 👑', expected: 'מלך הרפואי' },
    { input: '✨ אמריקה ישראל ✨', expected: 'אמריקה ישראל' },
    { input: 'גורילה הזמנות', expected: 'גורילה הזמנות' },
    { input: 'המחתרת בני אור', expected: 'המחתרת בני אור' }
  ]
  for (const bc of brandCases) {
    const matched = matchBrand(bc.input)
    if (matched === bc.expected) {
      console.log(`  ✅ Brand "${bc.input}" -> Matched "${matched}"`)
    } else {
      console.error(`  ❌ Brand mismatch for "${bc.input}": got "${matched}"`)
      allPassed = false
    }
  }

  // -------------------------------------------------------------------------
  // SUITE 3: EDGE CASE PARSING (PRICES, CITIES, FORMATS)
  // -------------------------------------------------------------------------
  console.log('\n🔍 [SUITE 3] Testing Edge Case Message Parsing (Prices, Unknown Cities)...')
  const edgeMessages = [
    {
      label: 'Formatted price with comma & ILS symbol (₪ 1,450)',
      text: `הרצל 12 חולון\n052-1112233\nלקוח קבוע\n20 רפואי האני\n₪ 1,450 כולל משלוח\nאמריקה ישראל`,
      expectedPrice: 1450,
      expectedCity: 'חולון'
    },
    {
      label: 'Hebrew ש"ח suffix (450 ש"ח)',
      text: `רוטשילד 45 פתח תקווה\n050-9988776\n2 אלסקה / 10 רפואי מלון\n450 ש"ח\nמלך הרפואי`,
      expectedPrice: 450,
      expectedCity: 'פתח תקווה'
    },
    {
      label: 'Compound Israeli City (ראשון לציון)',
      text: `ז'בוטינסקי 88 ראשון לציון\n054-3322110\n10g רפואי ענבים\n350₪\nאמריקה ישראל`,
      expectedPrice: 350,
      expectedCity: 'ראשון לציון'
    },
    {
      label: 'Address without known city fallback',
      text: `משק 82 מושב סתריה\n053-7766554\n15 פופקורן\n500₪\nגורילה הזמנות`,
      expectedPrice: 500
    }
  ]

  for (const em of edgeMessages) {
    const parsed = parseDeliveryMessage(em.text)
    let ok = true
    if (parsed.totalPrice !== em.expectedPrice) {
      console.error(`  ❌ Price mismatch for [${em.label}]: expected ${em.expectedPrice}, got ${parsed.totalPrice}`)
      ok = false
    }
    if (em.expectedCity && parsed.city !== em.expectedCity) {
      console.error(`  ❌ City mismatch for [${em.label}]: expected ${em.expectedCity}, got ${parsed.city}`)
      ok = false
    }
    if (ok) {
      console.log(`  ✅ [${em.label}]: Price=₪${parsed.totalPrice}, City="${parsed.city}", Brand="${parsed.brand}"`)
    } else {
      allPassed = false
    }
  }

  // -------------------------------------------------------------------------
  // SUITE 4: END-TO-END DATABASE INGESTION & INVENTORY DEPLETION
  // -------------------------------------------------------------------------
  console.log('\n💾 [SUITE 4] Testing Live Telegram Forward Ingestion & Stock Deduction...')

  const testPhone = '059-9990001'
  const normalizedTestPhone = '0599990001'
  const targetStrain = 'רפואי האני'
  const deductQty = 20

  // Pre-clean test records if any exist from prior runs
  await supabaseAdmin.from('crm_customers').delete().eq('phone_number', normalizedTestPhone)
  await supabaseAdmin.from('customers').delete().eq('phone_number', normalizedTestPhone)

  // 1. Get initial stock of target strain
  const { data: initialProd, error: prodErr } = await supabaseAdmin
    .from('products')
    .select('id, name, stock_on_hand, unit')
    .eq('name', targetStrain)
    .single()

  if (prodErr || !initialProd) {
    console.error(`❌ Could not fetch initial product "${targetStrain}":`, prodErr?.message)
    return
  }

  const initialStock = Number(initialProd.stock_on_hand)
  console.log(`  📦 Initial stock for "${targetStrain}": ${initialStock} ${initialProd.unit}`)

  // 2. Prepare test delivery message (forwarded format)
  const testForwardedMessage = `ישראל טסטר - דיזנגוף 100 תל אביב
${testPhone}
@test_tester
לקוח חדש
2 אלסקה / ${deductQty} ${targetStrain}
600₪ כולל משלוח

אמריקה ישראל`

  const parsedDelivery = parseDeliveryMessage(testForwardedMessage)
  console.log(`  📝 Parsed delivery: Address="${parsedDelivery.customerName}", Deduct="${parsedDelivery.actualItems}", Price=₪${parsedDelivery.totalPrice}`)

  // 3. Ingest into database
  const ingestResult = await ingestParsedDelivery(parsedDelivery)

  if (!ingestResult.success || !ingestResult.orderId) {
    console.error('❌ Ingestion failed:', ingestResult.error)
    allPassed = false
    return
  }
  console.log(`  ✅ Order created successfully: ID=${ingestResult.orderId}, CustomerID=${ingestResult.customerId}`)

  // 4. Verify Stock Deduction in `products`
  const { data: updatedProd } = await supabaseAdmin
    .from('products')
    .select('stock_on_hand')
    .eq('id', initialProd.id)
    .single()

  const updatedStock = Number(updatedProd?.stock_on_hand)
  const expectedStock = Math.max(0, initialStock - deductQty)

  if (updatedStock === expectedStock) {
    console.log(`  ✅ Product stock properly deducted: ${initialStock} -> ${updatedStock} (-${deductQty})`)
  } else {
    console.error(`  ❌ Stock mismatch! Expected ${expectedStock}, got ${updatedStock}`)
    allPassed = false
  }

  // 5. Verify `inventory_transactions` record
  const { data: invTx } = await supabaseAdmin
    .from('inventory_transactions')
    .select('*')
    .eq('order_id', ingestResult.orderId)
    .single()

  if (invTx && Number(invTx.quantity) === -deductQty) {
    console.log(`  ✅ Inventory transaction logged: qty=${invTx.quantity}, reason=${invTx.reason}`)
  } else {
    console.error(`  ❌ Inventory transaction missing or incorrect:`, invTx)
    allPassed = false
  }

  // 6. Test Deterministic Customer Deduplication (2nd order for same customer phone)
  console.log('\n  Testing Deterministic Customer Deduplication (Same Phone, 2nd Order)...')
  const secondOrderMessage = `ישראל טסטר - אבן גבירול 45 תל אביב
${testPhone}
@test_tester
לקוח קבוע
300₪ כולל משלוח
אמריקה ישראל`

  const parsedSecond = parseDeliveryMessage(secondOrderMessage)
  const secondResult = await ingestParsedDelivery(parsedSecond)

  const normalizedPhone = parsedDelivery.phoneNumber
  const { data: customerRecord } = await supabaseAdmin
    .from('crm_customers')
    .select('*')
    .eq('phone_number', normalizedPhone)
    .single()

  if (customerRecord && customerRecord.total_orders === 2 && Number(customerRecord.total_spent) === 900) {
    console.log(`  ✅ Deterministic deduplication verified! Total orders: 2, Total spent: ₪900, Updated Address: "${customerRecord.address_name}"`)
  } else {
    console.error(`  ❌ Customer deduplication check failed:`, customerRecord)
    allPassed = false
  }

  // -------------------------------------------------------------------------
  // CLEANUP TEST DATA (Restoring stock and deleting test orders)
  // -------------------------------------------------------------------------
  console.log('\n🧹 Cleaning up test records and restoring stock levels...')
  // Restore stock
  await supabaseAdmin
    .from('products')
    .update({ stock_on_hand: initialStock })
    .eq('id', initialProd.id)

  // Delete test transactions
  if (ingestResult.orderId) {
    await supabaseAdmin.from('inventory_transactions').delete().eq('order_id', ingestResult.orderId)
  }
  if (secondResult.orderId) {
    await supabaseAdmin.from('inventory_transactions').delete().eq('order_id', secondResult.orderId)
  }

  // Delete test orders
  await supabaseAdmin.from('crm_orders').delete().eq('customer_id', ingestResult.customerId)

  // Delete test customer
  await supabaseAdmin.from('crm_customers').delete().eq('phone_number', normalizedPhone)
  await supabaseAdmin.from('customers').delete().eq('phone_number', normalizedPhone)

  console.log('✅ Cleanup complete. Stock restored to original value.\n')

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log('========================================================================')
  if (allPassed) {
    console.log('🎉 ALL PHASE 6 END-TO-END VERIFICATION CHECKS PASSED!')
    console.log('  • Telegram Ingestion: Verified')
    console.log('  • Inventory Depletion: Verified')
    console.log('  • Customer Deduplication: Verified')
    console.log('  • Fuzzy Strain & Brand Matching: Verified')
    console.log('  • Edge Case Prices & Israeli Cities: Verified')
    console.log('  • Bilingual Symmetry (EN / HE): Verified')
  } else {
    console.error('⚠️ SOME CHECKS FAILED - REVIEW LOGS ABOVE')
  }
  console.log('========================================================================')
}

runPhase6Verification().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
