/**
 * Comprehensive list of Israeli cities, towns, and regional settlements in Hebrew.
 * Sorted by length descending to match multi-word cities before single words (e.g., 'ראשון לציון' before 'ציון').
 */
export const ISRAELI_CITIES: string[] = [
  // Multi-word cities
  'ראשון לציון',
  'פתח תקווה',
  'תל אביב',
  'תל אביב יפו',
  'רמת גן',
  'בני עייש',
  'כפר סבא',
  'הוד השרון',
  'רמת השרון',
  'קריית אונו',
  'קריית גת',
  'קריית מוצקין',
  'קריית ביאליק',
  'קריית ים',
  'קריית אתא',
  'קריית שמונה',
  'קריית מלאכי',
  'באר שבע',
  'באר יעקב',
  'נוף הגליל',
  'בית שמש',
  'מודיעין עילית',
  'מודיעין מכבים רעות',
  'גבעת שמואל',
  'אור יהודה',
  'יהוד מונסון',
  'מעלה אדומים',
  'גבעת זאב',
  'ראש העין',
  'נס ציונה',
  'פרדס חנה כרכור',
  'בני ברק',
  'בת ים',

  // Major single-word cities
  'ירושלים',
  'חיפה',
  'אשדוד',
  'נתניה',
  'חולון',
  'אשקלון',
  'רחובות',
  'הרצליה',
  'חדרה',
  'כפר יונה',
  'רעננה',
  'מודיעין',
  'לוד',
  'רמלה',
  'עכו',
  'טבריה',
  'עפולה',
  'נהריה',
  'אילת',
  'יבנה',
  'דימונה',
  'ערד',
  'שדרות',
  'נתיבות',
  'אופקים',
  'טירת כרמל',
  'מגדל העמק',
  'יקנעם',
  'נשר',
  'כרמיאל',
  'צפת',
  'סחנין',
  'אום אל פחם',
  'רהט',
  'טייבה',
  'שפרעם',
  'טירה',
  'קלנסווה',
  'אריאל',

  // Prominent Sharon / Central / Southern Towns & Moshavim
  'גינתון',
  'בן שמן',
  'שוהם',
  'כפר חב"ד',
  'כפר חבד',
  'סביון',
  'גני תקווה',
  'בני עטרות',
  'רינתיה',
  'מזור',
  'נופך',
  'נחלים',
  'ברקת',
  'טירת יהודה',
  'חדיד',
  'בית נחמיה',
  'כפר סירקין',
  'גת רימון',
  'מעש',
  'מגשימים',
  'ניר צבי',
  'זיתן',
  'אחיעזר',
  'יגל',
  'צפריה',
  'משמר השבעה',
  'ישרש',
  'מצליח',
  'סתריה',
  'נצר סרני',
  'גבעתיים',
  'אזור',
  'גן יבנה',
  'גדרה',
  'מזכרת בתיה',
  'קדימה צורן',
  'קדימה',
  'צורן',
  'תל מונד',
  'אבן יהודה',
  'כוכב יאיר',
  'צור יגאל',
  'צור יצחק',
  'צור משה',
  'פרדסיה',
  'אלפי מנשה',
  'קרני שומרון',
  'חריש',
  'עתלית',
  'זכרון יעקב',
  'בנימינה',
  'גבעת עדה',
  'קיסריה',
  'מכמורת',
  'כפר ויתקין',
  'גנות הדר',
  'בת חפר',
  'עין שריד',
  'עין ורד',
  'משמר השרון',
  'מעלות תרשיחא',
  'שלומי',
  'כפר תבור',
  'יבנאל',
  'מצפה רמון',
  'ירוחם'
].sort((a, b) => b.length - a.length)

// Common neighborhood or industrial zone mappings to primary cities
const CITY_ALIASES: Record<string, string> = {
  'סגולה': 'פתח תקווה',
  'קריית אריה': 'פתח תקווה',
  'רמת החייל': 'תל אביב',
  'פלורנטין': 'תל אביב',
  'יפו': 'תל אביב',
  'נווה צדק': 'תל אביב',
  'קדימה צורן': 'קדימה'
}

/**
 * Extracts and normalizes city from a Hebrew delivery address string.
 * Example: 'מרקו לויז - הנשיאים 57 פתח תקווה' -> 'פתח תקווה'
 * Example: 'שדרות האיכרים 10 סגולה' -> 'פתח תקווה'
 * Example: 'היסמין 6 קדימה' -> 'קדימה'
 */
export function extractCityFromAddress(address: string): { city: string; cleanAddress: string } {
  if (!address) return { city: 'אחר', cleanAddress: '' }

  const normalized = address
    .replace(/[,\-–—\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 1. Check for prominent neighborhood/zone aliases first
  for (const [alias, primaryCity] of Object.entries(CITY_ALIASES)) {
    const aliasRegex = new RegExp(`(^|\\s)${alias}(\\s|$)`, 'i')
    if (aliasRegex.test(normalized)) {
      return {
        city: primaryCity,
        cleanAddress: address.trim()
      }
    }
  }

  // 2. Scan for city matches with street prefix protection
  // Note: If address starts with "שדרות [שם רחוב] [מספר]", "שדרות" is the boulevard street prefix, not the city!
  const isSderotStreetPrefix = /^שדרות\s+[\u0590-\u05FF]+.*?\d+/i.test(normalized)

  for (const city of ISRAELI_CITIES) {
    if (city === 'שדרות' && isSderotStreetPrefix) {
      continue // Skip treating the leading boulevard street prefix as the southern city of Sderot
    }

    const regex = new RegExp(`(^|\\s)${city}(\\s|$)`, 'i')
    if (regex.test(normalized)) {
      return {
        city,
        cleanAddress: address.trim()
      }
    }
  }

  // If address started with boulevard prefix and no other city matched, check if "שדרות" was at the end
  if (isSderotStreetPrefix) {
    const endsWithSderot = /(?:^|\s)שדרות$/i.test(normalized)
    if (endsWithSderot) {
      return { city: 'שדרות', cleanAddress: address.trim() }
    }
  }

  // Fallback: If no known city detected, try extracting the last word/token
  const words = normalized.split(' ')
  const fallbackCity = words.length > 2 ? words[words.length - 1] : 'אחר'

  return {
    city: fallbackCity,
    cleanAddress: address.trim()
  }
}
