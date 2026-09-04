'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'
import Sidebar from '../../../components/Sidebar'

const STATUS_LABEL = {
  pending: { label: 'รอหยิบ', tone: 'warning' },
  in_progress: { label: 'กำลังหยิบ', tone: 'warning' },
  completed: { label: 'ส่งแล้ว', tone: 'success' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' }
}

export default function PickListDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [pickList, setPickList] = useState(null)
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const [newProductId, setNewProductId] = useState('')
  const [newQty, setNewQty] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [notice, setNotice] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const [selectedStrategy, setSelectedStrategy] = useState('FEFO')
  const [availableLots, setAvailableLots] = useState([])
  const [selectedLotId, setSelectedLotId] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setCheckingAuth(false)
    })
  }, [router])

  useEffect(() => {
    if (checkingAuth) return
    loadData()
  }, [checkingAuth, id])

  async function loadData() {
    setLoading(true)

    const [plRes, itemsRes, prodRes] = await Promise.all([
      supabase.from('pick_lists').select('id, status, customers ( name )').eq('id', id).single(),
      supabase
        .from('pick_list_items')
        .select(`
          id, requested_qty, picked_qty,
          stock_items (
            id, lot_no, expiry_date, qty,
            inventory_items ( sku, name ),
            locations ( code, departments ( name ) )
          )
        `)
        .eq('pick_list_id', id)
        .order('created_at'),
      supabase
        .from('inventory_items')
        .select('id, sku, name')
        .eq('item_type', 'product')
        .order('name')
    ])

    setPickList(plRes.data)
    setItems(itemsRes.data ?? [])
    setProducts(prodRes.data ?? [])
    setLoading(false)
  }

  const isEditable = pickList?.status === 'pending' || pickList?.status === 'in_progress'

  useEffect(() => {
    setSelectedLotId('')
    setAvailableLots([])

    if (!newProductId || selectedStrategy !== 'MANUAL') return

    async function loadLots() {
      const { data: lots } = await supabase
        .from('stock_items')
        .select('id, lot_no, expiry_date, qty, reserved_qty, locations ( code )')
        .eq('item_id', newProductId)
      setAvailableLots((lots ?? []).filter((l) => l.qty - l.reserved_qty > 0))
    }

    loadLots()
  }, [newProductId, selectedStrategy])

  async function handleAddItem(e) {
    e.preventDefault()
    if (!newProductId || !newQty || Number(newQty) <= 0) return

    if (selectedStrategy === 'MANUAL' && !selectedLotId) {
      setNotice({ type: 'error', text: 'กรุณาเลือก Lot ที่ต้องการหยิบ' })
      return
    }

    setAddingItem(true)
    setNotice(null)

    if (selectedStrategy === 'MANUAL') {
      const { error } = await supabase.rpc('reserve_pick_list_item_manual', {
        p_pick_list_id: id,
        p_stock_item_id: selectedLotId,
        p_qty: Number(newQty)
      })

      setAddingItem(false)

      if (error) {
        setNotice({ type: 'error', text: 'เพิ่มรายการไม่สำเร็จ: ' + error.message })
        return
      }
      setNotice({ type: 'success', text: 'จองสต๊อกจาก Lot ที่เลือกสำเร็จ' })
    } else {
      const { data: remainder, error } = await supabase.rpc('create_pick_list_item', {
        p_pick_list_id: id,
        p_item_id: newProductId,
        p_requested_qty: Number(newQty),
        p_strategy: selectedStrategy
      })

      setAddingItem(false)

      if (error) {
        setNotice({ type: 'error', text: 'เพิ่มรายการไม่สำเร็จ: ' + error.message })
        return
      }

      if (remainder > 0) {
        setNotice({ type: 'warning', text: `สต๊อกไม่พอ จองได้ขาดอยู่ ${remainder} หน่วย (จองเท่าที่มีให้แล้ว)` })
      } else {
        setNotice({ type: 'success', text: `จองสต๊อกสำเร็จตามวิธี ${selectedStrategy}` })
      }
    }

    setNewProductId('')
    setNewQty('')
    setSelectedLotId('')
    loadData()
  }

  async function handlePickedQtyChange(itemId, value, requestedQty) {
    const qty = Math.max(0, Math.min(Number(value) || 0, requestedQty))
    setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, picked_qty: qty } : it)))
  }

  async function handleSavePickedQty(itemId, qty) {
    await supabase.from('pick_list_items').update({ picked_qty: qty }).eq('id', itemId)
  }

  async function handleConfirmShipment() {
    if (!confirm('ยืนยันส่งของ? ระบบจะตัดสต๊อกจริงและปิดใบนี้')) return
    setConfirming(true)

    const { error } = await supabase.rpc('confirm_pick_list_shipment', { p_pick_list_id: id })

    setConfirming(false)

    if (error) {
      alert('ยืนยันไม่สำเร็จ: ' + error.message)
      return
    }
    loadData()
  }

  async function handleCancel() {
    if (!confirm('ยกเลิกใบสั่งหยิบนี้? การจองสต๊อกทั้งหมดจะถูกปลดคืน')) return

    const { error } = await supabase.rpc('cancel_pick_list', { p_pick_list_id: id })

    if (error) {
      alert('ยกเลิกไม่สำเร็จ: ' + error.message)
      return
    }
    loadData()
  }

  if (checkingAuth || loading) return null
  if (!pickList) return <p style={{ padding: 32 }}>ไม่พบใบสั่งหยิบนี้</p>

  const status = STATUS_LABEL[pickList.status] ?? { label: pickList.status, tone: 'warning' }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <a href="/pick-lists" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>← กลับไปหน้ารายการ</a>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>ใบสั่งหยิบ — {pickList.customers?.name}</h2>
            <span className={`badge ${status.tone}`}>{status.label}</span>
          </div>
          {isEditable && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCancel}>ยกเลิกใบ</button>
              <button className="primary" onClick={handleConfirmShipment} disabled={confirming}>
                {confirming ? 'กำลังยืนยัน...' : 'ยืนยันส่ง'}
              </button>
            </div>
          )}
        </div>

        {isEditable && (
          <form onSubmit={handleAddItem} className="filter-row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <select value={newProductId} onChange={(e) => setNewProductId(e.target.value)} required>
              <option value="">— เลือกสินค้า —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
              ))}
            </select>

            <select value={selectedStrategy} onChange={(e) => setSelectedStrategy(e.target.value)}>
              <option value="FEFO">FEFO — หมดอายุก่อนออกก่อน</option>
              <option value="FIFO">FIFO — รับเข้าก่อนออกก่อน</option>
              <option value="MANUAL">เลือก Lot เอง</option>
            </select>

            {selectedStrategy === 'MANUAL' && (
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                required
                style={{ minWidth: 260 }}
              >
                <option value="">— เลือก Lot —</option>
                {availableLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lot_no ?? 'ไม่มี Lot'} · {lot.locations?.code} · เหลือ {lot.qty - lot.reserved_qty}
                    {lot.expiry_date ? ` · หมดอายุ ${lot.expiry_date}` : ''}
                  </option>
                ))}
              </select>
            )}

            <input
              type="number"
              placeholder="จำนวนที่ต้องการ"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              min="1"
              required
              style={{ maxWidth: 160 }}
            />
            <button className="primary" type="submit" disabled={addingItem}>
              {addingItem ? 'กำลังเพิ่ม...' : '+ เพิ่มรายการ'}
            </button>
          </form>
        )}

        {notice && (
          <p className={`badge ${notice.type === 'error' ? 'danger' : notice.type === 'warning' ? 'warning' : 'success'}`}
            style={{ display: 'inline-block', marginTop: 10 }}>
            {notice.text}
          </p>
        )}

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>Lot</th>
              <th>ตำแหน่ง</th>
              <th>จองไว้</th>
              <th>หยิบได้จริง</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="mono">{it.stock_items?.inventory_items?.sku}</td>
                <td>{it.stock_items?.inventory_items?.name}</td>
                <td className="mono">{it.stock_items?.lot_no ?? '-'}</td>
                <td>
                  {it.stock_items?.locations?.departments?.name} / {it.stock_items?.locations?.code}
                </td>
                <td className="mono">{it.requested_qty}</td>
                <td>
                  {isEditable ? (
                    <input
                      type="number"
                      className="mono"
                      style={{ width: 90 }}
                      value={it.picked_qty}
                      min="0"
                      max={it.requested_qty}
                      onChange={(e) => handlePickedQtyChange(it.id, e.target.value, it.requested_qty)}
                      onBlur={(e) => handleSavePickedQty(it.id, Number(e.target.value) || 0)}
                    />
                  ) : (
                    <span className="mono">{it.picked_qty}</span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>
                ยังไม่มีรายการสินค้าในใบนี้
              </td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
