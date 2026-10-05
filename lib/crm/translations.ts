export type Language = 'en' | 'he'

export const TRANSLATIONS = {
  en: {
    appTitle: 'Persian Team Management',
    subtitle: 'Multi-Brand Telegram Delivery & Inventory Engine',
    toggleLang: 'עברית',
    
    // Left Sidebar Navigation
    navDashboard: 'Dashboard',
    navDispatches: 'Dispatches & Orders',
    navInventory: 'Live Inventory (29/9)',
    navSettlements: 'Courier Settlements',
    navCustomers: 'Customer Directory',
    navTelegramBot: 'Telegram Ingestion',
    logout: 'Logout',
    activeStatus: 'Active',
    managerRole: 'CRM Manager',

    // Sidebar Structured Filters
    filtersHeader: 'Filters & Dimensions',
    filterBrandsTitle: 'Brand Personas (37)',
    searchBrands: 'Filter brands...',
    filterCitiesTitle: 'Cities & Regions',
    filterShiftTitle: 'Delivery Shift',
    todayShift: "Today's Shift",
    allOrders: 'All Orders',
    clearAllFilters: 'Reset Filters',

    // Top Metric Cards
    courierCashToday: 'Cash with Couriers Today',
    totalDeliveriesToday: 'Deliveries Today',
    activeCustomers: 'Total Customers',
    lowStockAlerts: 'Low Stock Products',

    // Search and Header
    searchPlaceholder: 'Search by address, phone, telegram, or items...',
    allBrands: 'All Brands (37)',
    allCities: 'All Cities',
    exportToExcel: 'Export to Excel / CSV',
    totalFiltered: 'Showing {count} records',

    // Table Headers
    colCustomerName: 'Customer Name / Delivery Address',
    colCity: 'City',
    colPhone: 'Phone Number',
    colTelegram: 'Telegram Handle',
    colLastBrand: 'Brand / Persona',
    colMenuItems: 'Menu Order',
    colActualItems: 'Warehouse Stock Deducted',
    colPrice: 'Amount',
    colCourier: 'Assigned Courier',
    colActions: 'Actions',
    unassignedCourier: 'Unassigned (No Courier)',
    assignCourierPrompt: 'Assign Courier...',

    // Badges & Statuses
    tierRegular: 'Regular',
    tierNew: 'New',
    tierVip: 'VIP',
    unmaskPhone: 'Show',
    maskPhone: 'Hide',
    copied: 'Copied!',

    // Actions & Tooltips
    callCustomer: 'Call Customer',
    whatsappCustomer: 'Open WhatsApp',
    telegramCustomer: 'Open Telegram',
    refreshData: 'Refresh',

    // Detail Drawer
    orderDetails: 'Dispatch Details',
    rawTelegramMessage: 'Raw Forwarded Telegram Audit',
    customerLifetime: 'Customer Profile & Lifetime History',
    closeDrawer: 'Close',

    // Tabs
    tabCustomersOrders: 'Orders & Customers',
    tabInventory: 'Live Inventory (29/9)',
    tabSettlements: 'Courier Cash Settlement',

    // Live Inventory Tab
    inventoryTitle: 'Warehouse Inventory Tracking',
    productName: 'Product / Strain',
    category: 'Category',
    stockOnHand: 'Stock on Hand',
    unit: 'Unit',
    minStock: 'Threshold',
    status: 'Status',
    stockHealthy: 'In Stock',
    stockLow: 'Low Stock',
    stockOut: 'Out of Stock',
    updateStock: 'Adjust Stock',
    manualRestock: 'Quick Restock (+100)',
    grams: 'g',
    units: 'pcs',

    // Stock Adjust Modal
    adjustStockModalTitle: 'Adjust Stock Level',
    adjustmentType: 'Adjustment Action',
    addStock: 'Add Stock (+)',
    deductStock: 'Deduct Stock (-)',
    adjustmentAmount: 'Quantity',
    reason: 'Audit Reason',
    reasonRestock: 'Restock / New Batch',
    reasonAudit: 'Physical Audit Correction',
    reasonDamaged: 'Damaged / Waste',
    saveAdjustment: 'Save Adjustment',
    cancel: 'Cancel',
    notes: 'Audit Notes',

    // Settlement Tab & Modal
    settlementTitle: 'Courier Daily Cash Closeout',
    courierName: 'Courier Name',
    totalCollected: 'Total Cash Collected',
    ordersDelivered: 'Orders Delivered',
    settlementStatus: 'Settlement Status',
    settled: 'Reconciled',
    pending: 'Open Shift',
    noShift: 'No Shift / Idle',
    noShiftBtn: 'No Deliveries Today',
    shiftReconciledBtn: '✓ Shift Reconciled',
    noCashInHand: 'No Cash In Hand',
    closeShift: 'Settle & Close Shift',
    shiftClosedAlert: 'Shift settled! Telegram receipts sent to courier & manager.',
    settleModalTitle: 'Courier Bill of Money',
    expectedCash: 'Expected Cash from Orders',
    actualCashReceived: 'Physical Cash Handed Over (₪)',
    difference: 'Difference',
    balanced: 'Balanced (0₪)',
    shortage: 'Shortage (Missing Cash)',
    overage: 'Overage',
    confirmSettlement: 'Confirm & Send Receipts',
    discrepancy: 'Discrepancy Flagged',
    // Settlement V2 — Bill of Money
    grossCollected: 'Gross Cash Collected (₪)',
    grossCollectedHint: 'Total cash the courier collected from all customers',
    deliveryFeesBreakdown: 'Delivery Fee Breakdown',
    stdDeliveryFee: 'Standard deliveries',
    batYamFee: 'Bat Yam deliveries',
    perDelivery: '/delivery',
    bonusAmount: 'Manual Bonus (₪)',
    bonusHint: 'Optional extra payment for this shift',
    courierEarns: 'Courier Earns (fees + bonus)',
    netToWarehouse: 'Net to Pay Warehouseman',
    netToWarehouseHint: 'Gross collected minus courier pay',
    ordersCount: 'Deliveries Today',
    courierPays: 'Courier pays warehouseman',
    warehousemanCollects: 'Warehouseman collects from courier',

    // Empty state
    noRecordsFound: 'No customer orders match your search filters.',
    clearFilters: 'Clear All Filters',
    loading: 'Loading Persian Team Management data...'
  },
  he: {
    appTitle: 'Persian Team Management',
    subtitle: 'מערכת ניהול משלוחים, מלאי וקופת שליחים מטלגרם',
    toggleLang: 'English',

    // Left Sidebar Navigation
    navDashboard: 'לוח בקרה ראשי',
    navDispatches: 'משלוחים והזמנות',
    navInventory: 'מלאי מחסן חי (29/9)',
    navSettlements: 'סגירת קופת שליחים',
    navCustomers: 'ספר לקוחות וכתובות',
    navTelegramBot: 'קליטת בוט טלגרם',
    logout: 'התנתק',
    activeStatus: 'פעיל',
    managerRole: 'מנהל מערכת',

    // Sidebar Structured Filters
    filtersHeader: 'סינונים ומאפיינים',
    filterBrandsTitle: 'מותגים וספקים (37)',
    searchBrands: 'סנן מותג...',
    filterCitiesTitle: 'ערים ואזורי חלוקה',
    filterShiftTitle: 'משמרת חלוקה',
    todayShift: 'משמרת היום',
    allOrders: 'כל ההזמנות',
    clearAllFilters: 'אפס סינונים',

    // Top Metric Cards
    courierCashToday: 'קופת שליחים יומית',
    totalDeliveriesToday: 'משלוחים היום',
    activeCustomers: 'סך כל הלקוחות',
    lowStockAlerts: 'התראות מלאי נמוך',

    // Search and Header
    searchPlaceholder: 'חיפוש חופשי לפי כתובת, טלפון, טלגרם או מוצר...',
    allBrands: 'כל המותגים (37)',
    allCities: 'כל הערים',
    exportToExcel: 'ייצוא לאקסל / CSV',
    totalFiltered: 'מציג {count} רשומות',

    // Table Headers
    colCustomerName: 'שם לקוח (כתובת משלוח)',
    colCity: 'עיר',
    colPhone: 'מספר טלפון',
    colTelegram: 'משתמש טלגרם',
    colLastBrand: 'ספק / מותג',
    colMenuItems: 'הזמנה בתפריט',
    colActualItems: 'מוצר שירד מהמלאי',
    colPrice: 'סכום',
    colCourier: 'שליח משובץ',
    colActions: 'פעולות',
    unassignedCourier: 'ללא שליח (טרם שובץ)',
    assignCourierPrompt: 'שבץ שליח למשלוח...',

    // Badges & Statuses
    tierRegular: 'קבוע',
    tierNew: 'חדש',
    tierVip: 'VIP',
    unmaskPhone: 'הצג',
    maskPhone: 'הסתר',
    copied: 'הועתק!',

    // Actions & Tooltips
    callCustomer: 'התקשר ללקוח',
    whatsappCustomer: 'שלח WhatsApp',
    telegramCustomer: 'פתח טלגרם',
    refreshData: 'רענן',

    // Detail Drawer
    orderDetails: 'פרטי משלוח מלאים',
    rawTelegramMessage: 'הודעת טלגרם מקורית (ביקורת OPSEC)',
    customerLifetime: 'פרופיל לקוח והיסטוריית רכישות',
    closeDrawer: 'סגור',

    // Tabs
    tabCustomersOrders: 'הזמנות ומאגר לקוחות',
    tabInventory: 'מלאי מחסן חי (29/9)',
    tabSettlements: 'סגירת קופת שליחים',

    // Live Inventory Tab
    inventoryTitle: 'מעקב מלאי מחסן חי',
    productName: 'שם המוצר / זן',
    category: 'קטגוריה',
    stockOnHand: 'מלאי נוכחי',
    unit: 'יחידה',
    minStock: 'סף התראה',
    status: 'סטטוס',
    stockHealthy: 'במלאי',
    stockLow: 'מלאי נמוך',
    stockOut: 'אזל מהמלאי',
    updateStock: 'עדכון מלאי',
    manualRestock: 'חידוש מלאי מהיר (+100)',
    grams: 'גרם',
    units: 'יח׳',

    // Stock Adjust Modal
    adjustStockModalTitle: 'עדכון מלאי ידני',
    adjustmentType: 'פעולת עדכון',
    addStock: 'הוספת מלאי (+)',
    deductStock: 'הפחתת מלאי (-)',
    adjustmentAmount: 'כמות',
    reason: 'סיבת העדכון',
    reasonRestock: 'חידוש מלאי / אספקה חדשה',
    reasonAudit: 'ספירת מלאי ותיקון פערים',
    reasonDamaged: 'פחת / פגום',
    saveAdjustment: 'שמור עדכון מלאי',
    cancel: 'ביטול',
    notes: 'הערות מנהל',

    // Settlement Tab & Modal
    settlementTitle: 'סגירת קופת שליחים יומית',
    courierName: 'שם השליח',
    totalCollected: 'סך הכל נאסף במזומן',
    ordersDelivered: 'משלוחים שבוצעו',
    settlementStatus: 'סטטוס קופה',
    settled: 'הקופה נסגרה',
    pending: 'משמרת פעילה',
    noShift: 'ללא משמרת',
    noShiftBtn: 'אין פעילות היום',
    shiftReconciledBtn: '✓ הקופה נסגרה',
    noCashInHand: 'אין מזומן בקופה',
    closeShift: 'סגירת קופה והתחשבנות',
    shiftClosedAlert: 'הקופה נסגרה! קבלות נשלחו לשליח ולמנהל בטלגרם.',
    settleModalTitle: 'חשבון כסף — סגירת קופת שליח',
    expectedCash: 'סכום צפוי מההזמנות שחולקו',
    actualCashReceived: 'מזומן פיזי שנמסר בפועל (₪)',
    difference: 'הפרש בקופה',
    balanced: 'מאוזן (0₪)',
    shortage: 'חסר בקופה',
    overage: 'עודף בקופה',
    confirmSettlement: 'אשר ושלח קבלות',
    discrepancy: 'אי התאמה בקופה',
    // Settlement V2 — Bill of Money
    grossCollected: 'סה"כ מזומן שנגבה מלקוחות (₪)',
    grossCollectedHint: 'הסכום שהשליח גבה מכל הלקוחות בסך הכל',
    deliveryFeesBreakdown: 'פירוט עמלות משלוח',
    stdDeliveryFee: 'משלוחים רגילים',
    batYamFee: 'משלוחי בת ים',
    perDelivery: 'למשלוח',
    bonusAmount: 'בונוס ידני (₪)',
    bonusHint: 'תשלום נוסף אופציונלי עבור משמרת זו',
    courierEarns: 'השליח מקבל (עמלות + בונוס)',
    netToWarehouse: 'נטו להעביר למחסנאי',
    netToWarehouseHint: 'מה שנגבה פחות חלקו של השליח',
    ordersCount: 'משלוחים היום',
    courierPays: 'השליח משלם למחסנאי',
    warehousemanCollects: 'המחסנאי גובה מהשליח',

    // Empty state
    noRecordsFound: 'לא נמצאו הזמנות התואמות לחיפוש הנוכחי.',
    clearFilters: 'אפס את כל הסינונים',
    loading: 'טוען נתוני מערכת...'
  }
}
