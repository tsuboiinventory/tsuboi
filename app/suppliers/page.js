'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [links, setLinks] = useState({}) // supplier_id -> [product_supplier rows]
  const [expandedId, setExpandedId] = useState(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')

  const [linkProductId, setLinkProductId] = useState('')
  const [linkCost, setLinkCost] = useState('')
  const [linkLeadTime, setLinkLeadTime] = useState('')

  useEffect(() => {
    loadSuppliers()
    supabase.from('inventory_items').select('id, sku, name').eq('item_type', 'product').order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('*').order('name')
    setSuppliers(data ?? [])
  }

  async function handleAddSupplier(e) {
    e.preventDefault()
    const { error } = await supabase.from('suppliers').insert({ name, phone: phone || null, tax_id: taxId || null })
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    setName(''); setPhone(''); setTaxId('')
    loadSuppliers()
  }

  async function handleDeleteSupplier(id) {
    if (!confirm('ลบ Supplier รายนี้?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    loadSuppliers()
  }

  async function toggleLinks(supplierId) {
    if (expandedId === supplierId) { setExpandedId(null); return }
    setExpandedId(supplierId)
    if (!links[supplierId]) {
      const { data } = await supabase
        .from('product_suppliers')
        .select('id, cost_price, lead_time_days, is_preferred, inventory_items ( sku, name )')
        .eq('supplier_id', supplierId)
      setLinks((prev) => ({ ...prev, [supplierId]: data ?? [] }))
    }
  }

  async function handleAddLink(supplierId) {
    if (!linkProductId) return
    const { error } = await supabase.from('product_suppliers').insert({
      supplier_id: supplierId,
      product_id: linkProductId,
      cost_price: linkCost ? Number(linkCost) : null,
      lead_time_days: linkLeadTime ? Number(linkLeadTime) : null
    })
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    const { data } = await supabase
      .from('product_suppliers')
      .select('id, cost_price, lead_time_days, is_preferred, inventory_items ( sku, name )')
      .eq('supplier_id', supplierId)
    setLinks((prev) => ({ ...prev, [supplierId]: data ?? [] }))
    setLinkProductId(''); setLinkCost(''); setLinkLeadTime('')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>Supplier</h2>

        <form onSubmit={handleAddSupplier} className="filter-row" style={{ marginTop: 16 }}>
          <input placeholder="ชื่อ Supplier" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="เลขผู้เสียภาษี" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          <button className="primary" type="submit">+ เพิ่ม Supplier</button>
        </form>

        <table className="data-table" style={{ marginTop: 16 }}>
          <thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <>
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggleLinks(s.id)}>
                  <td>{s.name}</td>
                  <td className="mono">{s.phone ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(s.id) }}>ลบ</button>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr key={s.id + '-links'}>
                    <td colSpan={3} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12 }}>
                        <strong style={{ fontSize: 13 }}>สินค้าที่ส่ง</strong>
                        <ul style={{ fontSize: 13, margin: '8px 0' }}>
                          {(links[s.id] ?? []).map((l) => (
                            <li key={l.id}>
                              {l.inventory_items?.sku} — {l.inventory_items?.name}
                              {l.cost_price ? ` · ฿${l.cost_price}` : ''}
                              {l.lead_time_days ? ` · ${l.lead_time_days} วัน` : ''}
                            </li>
                          ))}
                          {(links[s.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีสินค้าที่ผูกไว้</li>}
                        </ul>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select value={linkProductId} onChange={(e) => setLinkProductId(e.target.value)} style={{ flex: 2 }}>
                            <option value="">— เลือกสินค้า —</option>
                            {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                          </select>
                          <input placeholder="ราคา/หน่วย" type="number" value={linkCost} onChange={(e) => setLinkCost(e.target.value)} style={{ flex: 1 }} />
                          <input placeholder="Lead time (วัน)" type="number" value={linkLeadTime} onChange={(e) => setLinkLeadTime(e.target.value)} style={{ flex: 1 }} />
                          <button onClick={() => handleAddLink(s.id)}>+ ผูกสินค้า</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มี Supplier</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
