'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  BoxIcon,
  UsersIcon,
  TagIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  RefreshIcon,
  XIcon
} from '@/components/crm/CrmIcons'
import { Product, Brand, Courier, Order } from '@/components/crm/CrmRouteViews'

// ========================================================
// 1. PRODUCT CREATE / EDIT MODAL
// ========================================================
export function ProductModal({
  isOpen,
  onClose,
  initialProduct,
  onSuccess,
  isRtl
}: {
  isOpen: boolean
  onClose: () => void
  initialProduct?: Product | null
  onSuccess: (msg: string) => void
  isRtl: boolean
}) {
  const isEditing = !!initialProduct

  const [name, setName] = useState('')
  const [category, setCategory] = useState('תפרחת')
  const [unit, setUnit] = useState<'g' | 'units'>('g')
  const [stockOnHand, setStockOnHand] = useState('50')
  const [minStockAlert, setMinStockAlert] = useState('10')
  const [aliases, setAliases] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name || '')
      setCategory(initialProduct.category || 'תפרחת')
      setUnit(initialProduct.unit === 'units' ? 'units' : 'g')
      setStockOnHand(initialProduct.stock_on_hand.toString())
      setMinStockAlert((initialProduct.min_stock_alert || 10).toString())
      setAliases((initialProduct.aliases || []).join(', '))
    } else {
      setName('')
      setCategory('תפרחת')
      setUnit('g')
      setStockOnHand('50')
      setMinStockAlert('10')
      setAliases('')
    }
    setError(null)
  }, [initialProduct, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Please provide a valid product name.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const aliasArray = aliases
        .split(',')
        .map(a => a.trim())
        .filter(Boolean)

      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
          productId: initialProduct?.id,
          name: name.trim(),
          category: category.trim(),
          unit,
          stock_on_hand: parseFloat(stockOnHand) || 0,
          min_stock_alert: parseFloat(minStockAlert) || 10,
          aliases: aliasArray
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save product.')

      onSuccess(
        isEditing
          ? `Product "${name}" updated successfully.`
          : `Product "${name}" added to catalog with ${stockOnHand}${unit === 'g' ? 'g' : ' units'} initial stock.`
      )
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-[#4352E8] dark:text-indigo-400">
              <BoxIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Warehouse Product' : 'Add New Warehouse Product'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isEditing ? 'Modify catalog SKU details & alias keywords' : 'Create new catalog SKU for 29/9 live depletion'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Product Name */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Product Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. גלקסי, סאוור דיזל, שמן RSO"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
              >
                <option value="תפרחת">תפרחת (Flower)</option>
                <option value="שמן">שמן (Oil)</option>
                <option value="מיצוי">מיצוי (Extract)</option>
                <option value="אכיל">אכיל (Edible)</option>
                <option value="וופורייזר">וופורייזר (Vaporizer)</option>
                <option value="אביזרים">אביזרים (Accessories)</option>
              </select>
            </div>

            {/* Measurement Unit */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Unit of Measure</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-transparent dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setUnit('g')}
                  className={`py-1 rounded-lg font-bold transition cursor-pointer ${
                    unit === 'g'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Grams (g)
                </button>
                <button
                  type="button"
                  onClick={() => setUnit('units')}
                  className={`py-1 rounded-lg font-bold transition cursor-pointer ${
                    unit === 'units'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Pieces (יח׳)
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Stock On Hand */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {isEditing ? 'Live Stock (Audit Protected)' : 'Initial Warehouse Stock'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                disabled={isEditing}
                value={stockOnHand}
                onChange={e => setStockOnHand(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold disabled:opacity-60"
              />
              {isEditing && (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Use &quot;Update Stock&quot; to restock/deduct with audit log.</p>
              )}
            </div>

            {/* Min Stock Alert Threshold */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Min Stock Alert</label>
              <input
                type="number"
                step="any"
                min="0"
                value={minStockAlert}
                onChange={e => setMinStockAlert(e.target.value)}
                placeholder="10"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
              />
            </div>
          </div>

          {/* Fuzzy Matching Aliases */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Fuzzy Matching Aliases (Comma Separated)
            </label>
            <input
              type="text"
              value={aliases}
              onChange={e => setAliases(e.target.value)}
              placeholder="e.g. גלאקסי, galaxy, גלקס"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Typo tolerance: Forwarded Telegram messages with these names automatically map to this warehouse product.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#4352E8] hover:bg-[#3442cb] text-white font-bold transition shadow-md shadow-indigo-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ========================================================
// 2. PRODUCT DELETE CONFIRMATION MODAL
// ========================================================
export function ProductDeleteModal({
  product,
  onClose,
  onSuccess,
  isRtl
}: {
  product: Product | null
  onClose: () => void
  onSuccess: (msg: string) => void
  isRtl: boolean
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!product) return null

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      setError(null)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_PRODUCT',
          productId: product.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete product.')

      onSuccess(`Product "${product.name}" deleted from warehouse catalog.`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error deleting product.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B0F17] border border-rose-100 dark:border-rose-950/40 shadow-2xl p-6 space-y-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrashIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Warehouse SKU</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Confirm permanent deletion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            Are you sure you want to delete <strong className="text-slate-900 dark:text-white">{product.name}</strong> from the catalog?
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Current stock on hand: <strong className="text-slate-800 dark:text-slate-200">{product.stock_on_hand} {product.unit === 'g' ? 'g' : 'units'}</strong>.
            This action will remove the product and its audit transaction logs.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete SKU</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ========================================================
// 3. BRAND MANAGER MODAL (37+ BRAND PERSONAS)
// ========================================================
export function BrandManagerModal({
  isOpen,
  onClose,
  brands,
  orders,
  onRefresh,
  isRtl
}: {
  isOpen: boolean
  onClose: () => void
  brands: Brand[]
  orders: Order[]
  onRefresh: () => void
  isRtl: boolean
}) {
  const [search, setSearch] = useState('')
  const [newBrandName, setNewBrandName] = useState('')
  const [isSubmittingNew, setIsSubmittingNew] = useState(false)
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null)
  const [editingBrandName, setEditingBrandName] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Order counts per brand
  const brandOrderCounts = useMemo(() => {
    const map: Record<string, number> = {}
    orders.forEach(o => {
      const bName = o.brands?.name
      if (bName) {
        map[bName] = (map[bName] || 0) + 1
      }
    })
    return map
  }, [orders])

  const filteredBrands = useMemo(() => {
    const term = search.toLowerCase().trim()
    if (!term) return brands
    return brands.filter(b => b.name.toLowerCase().includes(term))
  }, [brands, search])

  if (!isOpen) return null

  // Add Brand
  const handleAddBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBrandName.trim()) return

    try {
      setIsSubmittingNew(true)
      setError(null)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BRAND',
          name: newBrandName.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create brand.')

      setSuccessMsg(`Brand "${newBrandName.trim()}" created successfully.`)
      setNewBrandName('')
      onRefresh()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmittingNew(false)
    }
  }

  // Update Brand
  const handleUpdateBrand = async (brandId: string) => {
    if (!editingBrandName.trim()) return

    try {
      setIsSubmittingEdit(true)
      setError(null)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_BRAND',
          brandId,
          name: editingBrandName.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update brand.')

      setSuccessMsg(`Brand renamed to "${editingBrandName.trim()}".`)
      setEditingBrandId(null)
      onRefresh()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Delete Brand
  const handleDeleteBrand = async (brandId: string, brandName: string) => {
    const count = brandOrderCounts[brandName] || 0
    if (count > 0) {
      setError(`Cannot delete "${brandName}": ${count} delivery orders are currently associated with it.`)
      return
    }

    try {
      setIsDeleting(true)
      setError(null)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_BRAND',
          brandId
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete brand.')

      setSuccessMsg(`Brand "${brandName}" deleted successfully.`)
      setDeletingBrandId(null)
      onRefresh()
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 flex flex-col max-h-[90vh]"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-[#4352E8] dark:text-indigo-400">
              <TagIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Brand Personas Manager</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Manage all {brands.length} multi-persona storefront names & order tags
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-400 text-xs font-semibold">
            {successMsg}
          </div>
        )}

        {/* Add Brand Inline Form */}
        <form onSubmit={handleAddBrand} className="flex items-center gap-2">
          <input
            type="text"
            required
            value={newBrandName}
            onChange={e => setNewBrandName(e.target.value)}
            placeholder="New brand name (e.g. טופ קאלי, גולד סטריין)..."
            className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
          />
          <button
            type="submit"
            disabled={isSubmittingNew || !newBrandName.trim()}
            className="px-4 py-2 rounded-xl bg-[#4352E8] hover:bg-[#3442cb] text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isSubmittingNew ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : <PlusIcon className="w-3.5 h-3.5" />}
            <span>Add Brand</span>
          </button>
        </form>

        {/* Search Existing Brands */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search brand name..."
            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-[#4352E8]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute top-1.5 right-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Scrollable Brands List */}
        <div
          data-scrollbar="hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1 no-scrollbar space-y-1"
        >
          {filteredBrands.map(b => {
            const count = brandOrderCounts[b.name] || 0
            const isEditingThis = editingBrandId === b.id

            return (
              <div key={b.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                {isEditingThis ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingBrandName}
                      onChange={e => setEditingBrandName(e.target.value)}
                      className="flex-1 px-2.5 py-1 rounded-lg border border-indigo-400 dark:border-indigo-500 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateBrand(b.id)}
                      disabled={isSubmittingEdit}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingBrandId(null)}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{b.name}</span>
                      {count > 0 ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-100 dark:border-indigo-500/30">
                          {count} orders
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                          0 orders
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBrandId(b.id)
                          setEditingBrandName(b.name)
                        }}
                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                        title="Rename Brand"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBrand(b.id, b.name)}
                        disabled={isDeleting}
                        className="p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer disabled:opacity-40"
                        title={count > 0 ? 'Cannot delete brand with existing orders' : 'Delete Brand'}
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
          <span>{brands.length} Total Personas Registered</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ========================================================
// 4. COURIER CREATE / EDIT MODAL
// ========================================================
export function CourierModal({
  isOpen,
  onClose,
  initialCourier,
  onSuccess,
  isRtl
}: {
  isOpen: boolean
  onClose: () => void
  initialCourier?: Courier | null
  onSuccess: (msg: string) => void
  isRtl: boolean
}) {
  const isEditing = !!initialCourier
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [telegramId, setTelegramId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialCourier) {
      setName(initialCourier.name || '')
      setPhoneNumber(initialCourier.phone_number || '')
      setTelegramId(initialCourier.telegram_id ? String(initialCourier.telegram_id) : '')
    } else {
      setName('')
      setPhoneNumber('')
      setTelegramId('')
    }
    setError(null)
  }, [initialCourier, isOpen])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Courier name is required.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)

      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isEditing ? 'UPDATE_COURIER' : 'CREATE_COURIER',
          courierId: initialCourier?.id,
          name: name.trim(),
          phone_number: phoneNumber.trim() || null,
          telegram_id: telegramId.trim() || null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save courier.')

      onSuccess(
        isEditing
          ? `Courier "${name}" updated successfully.`
          : `Courier "${name}" registered into active roster.`
      )
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-[#4352E8] dark:text-indigo-400">
              <UsersIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Courier Driver' : 'Register New Courier'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Shift tracking and cash settlement roster</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Courier Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. יצחק הגנן, זיג זג, דניאל"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Phone Number</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              placeholder="05X-XXXXXXX"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Telegram ID / User ID (Optional)</label>
            <input
              type="text"
              value={telegramId}
              onChange={e => setTelegramId(e.target.value)}
              placeholder="e.g. 123456789"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-[#4352E8]/40"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#4352E8] hover:bg-[#3442cb] text-white font-bold transition shadow-md shadow-indigo-200 dark:shadow-indigo-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditing ? 'Save Changes' : 'Register Courier'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ========================================================
// 5. COURIER DELETE CONFIRMATION MODAL
// ========================================================
export function CourierDeleteModal({
  courier,
  onClose,
  onSuccess,
  isRtl
}: {
  courier: Courier | null
  onClose: () => void
  onSuccess: (msg: string) => void
  isRtl: boolean
}) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!courier) return null

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      setError(null)
      const res = await fetch('/api/crm/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_COURIER',
          courierId: courier.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove courier.')

      onSuccess(`Courier "${courier.name}" removed from roster.`)
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0B0F17] border border-rose-100 dark:border-rose-950/40 shadow-2xl p-6 space-y-4"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <TrashIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove Courier</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Confirm removal from roster</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
          <p>
            Are you sure you want to remove <strong className="text-slate-900 dark:text-white">{courier.name}</strong> from the courier roster?
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Any unclosed shift balance will be preserved in historical reports, and order records will remain safe.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-md shadow-rose-200 dark:shadow-rose-950 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshIcon className="w-3.5 h-3.5 animate-spin" />
                <span>Removing...</span>
              </>
            ) : (
              <span>Remove Courier</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
