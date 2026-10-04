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
  'שוהם',
  'גבעתיים',
  'אזור',
  'גן יבנה',
  'גדרה',
  'מזכרת בתיה',
  'קדימה צורן',
  'תל מונד',
  'אבן יהודה',
  'כוכב יאיר',
  'צור יגאל',
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

/**
 * Extracts and normalizes city from a Hebrew delivery address string.
 * Example: 'מרקו לויז - הנשיאים 57 פתח תקווה' -> 'פתח תקווה'
 * Example: 'רמבם 56 ראשון לציון' -> 'ראשון לציון'
 * Example: 'סמטת העליה 6 בני עייש' -> 'בני עייש'
 * Example: 'לשפר 18 תל אביב' -> 'תל אביב'
 */
export function extractCityFromAddress(address: string): { city: string; cleanAddress: string } {
  if (!address) return { city: 'אחר', cleanAddress: '' }

  const normalized = address
    .replace(/[,\-–—\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const city of ISRAELI_CITIES) {
    // Check if the address contains or ends with the city
    const regex = new RegExp(`(^|\\s)${city}(\\s|$)`, 'i')
    if (regex.test(normalized)) {
      return {
        city,
        cleanAddress: address.trim()
      }
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
