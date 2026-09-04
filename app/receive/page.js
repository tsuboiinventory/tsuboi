'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function ReceivePage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [suppliers, setSuppliers] = useState([])

  const [isNewProduct, setIsNewProduct] = useState(false)
  const [productId, setProductId] = useState('')
  const [newSku, setNewSku] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newUnit, setNewUnit] = useState('ชิ้น')
  const [newReorderPoint, setNewReorderPoint] = useState('')

  const [locationId, setLocationId] = useState('')
  const [lotNo, setLotNo] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [qty, setQty] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [refNo, setRefNo] = useState('')

  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadOptions() }, [])

  async function loadOptions() {
    const [prodRes, catRes, locRes, supRes] = await Promise.all([
      supabase.from('inventory_items').select('id, sku, name').eq('item_type', 'product').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.from('locations').select('id, code, departments ( name )').order('code'),
      supabase.from('suppliers').select('id, name').order('name')
    ])
    setProducts(prodRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLocations(locRes.data ?? [])
    setSuppliers(supRes.data ?? [])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    let itemId = productId

    // ถ้าเป็นสินค้าใหม่ ให้สร้าง inventory_items + products ก่อน
    if (isNewProduct) {
      const { data: newItem, error: itemError } = await supabase
        .from('inventory_items')
        .insert({ item_type: 'product', sku: newSku, name: newName, category_id: newCategoryId || null, unit: newUnit })
        .select('id').single()

      if (itemError) {
        setMessage({ ok: false, text: 'สร้างสินค้าใหม่ไม่สำเร็จ: ' + itemError.message })
        setSaving(false)
        return
      }

      const { error: productError } = await supabase
        .from('products')
        .insert({ item_id: newItem.id, reorder_point: Number(newReorderPoint) || 0 })

      if (productError) {
        setMessage({ ok: false, text: 'สร้างข้อมูลสินค้าไม่สำเร็จ: ' + productError.message })
        setSaving(false)
        return
      }

      itemId = newItem.id
    }

    if (!itemId || !locationId || !qty || Number(qty) <= 0) {
      setMessage({ ok: false, text: 'กรุณากรอกสินค้า ตำแหน่ง และจำนวนให้ครบ' })
      setSaving(false)
      return
    }

    // สร้าง stock_items แถวใหม่สำหรับ Lot นี้ (เริ่มที่ 0 แล้วให้ movement ปรับยอดให้)
    const { data: stockItem, error: stockItemError } = await supabase
      .from('stock_items')
      .insert({
        item_id: itemId,
        location_id: locationId,
        lot_no: lotNo || null,
        expiry_date: expiryDate || null,
        qty: 0,
        received_at: new Date().toISOString()
      })
      .select('id').single()

    if (stockItemError) {
      setMessage({ ok: false, text: 'สร้าง Lot ไม่สำเร็จ: ' + stockItemError.message })
      setSaving(false)
      return
    }

    // บันทึกการรับเข้า — Trigger ในฐานข้อมูลจะปรับยอด qty ให้อัตโนมัติ
    const { error: movementError } = await supabase
      .from('stock_movements')
      .insert({
        stock_item_id: stockItem.id,
        movement_type: 'inbound',
        qty: Number(qty),
        to_location_id: locationId,
        supplier_id: supplierId || null,
        ref_no: refNo || null
      })

    setSaving(false)

    if (movementError) {
      setMessage({ ok: false, text: 'บันทึกรับเข้าไม่สำเร็จ: ' + movementError.message })
      return
    }

    setMessage({ ok: true, text: `รับสินค้าเข้าสำเร็จ ${qty} หน่วย` })
    setLotNo(''); setExpiryDate(''); setQty(''); setRefNo('')
    if (isNewProduct) {
      setIsNewProduct(false); setNewSku(''); setNewName(''); setNewCategoryId(''); setNewReorderPoint('')
      loadOptions()
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>รับสินค้าเข้า</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>
          เพิ่มสินค้าใหม่ (ถ้ายังไม่มี) แล้วบันทึกจำนวนที่รับเข้าจริง
        </p>

        <form onSubmit={handleSubmit} className="stat-card" style={{ marginTop: 20, maxWidth: 520 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={isNewProduct} onChange={(e) => setIsNewProduct(e.target.checked)} style={{ marginRight: 6 }} />
            สินค้านี้ยังไม่มีในระบบ (สร้างใหม่)
          </label>

          {isNewProduct ? (
            <div style={{ marginTop: 12 }}>
              <input placeholder="SKU" value={newSku} onChange={(e) => setNewSku(e.target.value)} required style={{ width: '100%', marginBottom: 8 }} />
              <input placeholder="ชื่อสินค้า" value={newName} onChange={(e) => setNewName(e.target.value)} required style={{ width: '100%', marginBottom: 8 }} />
              <select value={newCategoryId} onChange={(e) => setNewCategoryId(e.target.value)} style={{ width: '100%', marginBottom: 8 }}>
                <option value="">— ประเภทสินค้า —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="หน่วยนับ เช่น กก., ชิ้น" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
              <input type="number" placeholder="จุดสั่งซื้อ (Reorder point)" value={newReorderPoint} onChange={(e) => setNewReorderPoint(e.target.value)} style={{ width: '100%' }} />
            </div>
          ) : (
            <select value={productId} onChange={(e) => setProductId(e.target.value)} required={!isNewProduct} style={{ width: '100%', marginTop: 12 }}>
              <option value="">— เลือกสินค้า —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
            </select>
          )}

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--line)' }} />

          <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>ตำแหน่งจัดเก็บ</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} required style={{ width: '100%', margin: '4px 0 10px' }}>
            <option value="">— เลือกตำแหน่ง —</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.departments?.name} / {l.code}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="Lot No. (ถ้ามี)" value={lotNo} onChange={(e) => setLotNo(e.target.value)} style={{ flex: 1, marginBottom: 10 }} />
            <input type="date" placeholder="วันหมดอายุ" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} style={{ flex: 1, marginBottom: 10 }} />
          </div>

          <input type="number" placeholder="จำนวนที่รับเข้า" value={qty} onChange={(e) => setQty(e.target.value)} required min="1" style={{ width: '100%', marginBottom: 10 }} />

          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
            <option value="">— Supplier (ถ้ามี) —</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <input placeholder="เลขที่เอกสารอ้างอิง เช่น PO-2026-0001" value={refNo} onChange={(e) => setRefNo(e.target.value)} style={{ width: '100%', marginBottom: 14 }} />

          <button className="primary" type="submit" disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึกรับสินค้าเข้า'}
          </button>

          {message && (
            <p className={`badge ${message.ok ? 'success' : 'danger'}`} style={{ display: 'inline-block', marginTop: 12 }}>
              {message.text}
            </p>
          )}
        </form>
      </main>
    </div>
  )
}
