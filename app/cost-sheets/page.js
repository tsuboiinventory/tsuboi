'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const EMPTY_CHARGE = { label: '', amount: '' }
const EMPTY_ITEM = { product_id: '', product_name_text: '', qty: '', weight: '', sales_price: '', allocation_method: 'proportional_qty', remark: '' }

export default function CostSheetsPage() {
  const [sheets, setSheets] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [expandedDocNo, setExpandedDocNo] = useState(null)
  const [itemCalc, setItemCalc] = useState({})

  const [showForm, setShowForm] = useState(false)
  const [docNo, setDocNo] = useState('')
  const [isRevision, setIsRevision] = useState(false)
  const [charges, setCharges] = useState([{ ...EMPTY_CHARGE }])
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [customerId, setCustomerId] = useState('')
  const [attendTo, setAttendTo] = useState('')
  const [saleRemark, setSaleRemark] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [sheetRes, prodRes, custRes] = await Promise.all([
      supabase.from('cost_sheets').select('id, doc_no, revision_no, charges, created_at, customer_id, customers ( name )').eq('is_current', true).order('created_at', { ascending: false }),
      supabase.from('inventory_items').select('id, sku, name').eq('item_type', 'product').order('name'),
      supabase.from('customers').select('id, name, contact_name').order('name')
    ])
    setSheets(sheetRes.data ?? [])
    setProducts(prodRes.data ?? [])
    setCustomers(custRes.data ?? [])
  }

  function totalCharges(chargeList) {
    return chargeList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  }

  function openNew() {
    setDocNo(''); setIsRevision(false)
    setCharges([{ ...EMPTY_CHARGE }]); setItems([{ ...EMPTY_ITEM }])
    setCustomerId(''); setAttendTo(''); setSaleRemark('')
    setMessage(null)
    setShowForm(true)
  }

  function handleCustomerChange(id) {
    setCustomerId(id)
    const c = customers.find((x) => x.id === id)
    if (c?.contact_name) setAttendTo(c.contact_name)
  }

  async function openRevise(sheet) {
    setDocNo(sheet.doc_no); setIsRevision(true)
    setCharges(sheet.charges.length ? sheet.charges.map((c) => ({ label: c.label, amount: c.amount })) : [{ ...EMPTY_CHARGE }])

    const { data: full } = await supabase.from('cost_sheets').select('customer_id, attend_to, sale_remark').eq('id', sheet.id).single()
    setCustomerId(full?.customer_id ?? '')
    setAttendTo(full?.attend_to ?? '')
    setSaleRemark(full?.sale_remark ?? '')

    const { data: existingItems } = await supabase
      .from('cost_sheet_items')
      .select('product_id, product_name_text, qty, weight, sales_price, allocation_method, remark')
      .eq('cost_sheet_id', sheet.id)
    setItems(existingItems && existingItems.length ? existingItems.map((i) => ({
      product_id: i.product_id || '', product_name_text: i.product_name_text || '',
      qty: i.qty, weight: i.weight ?? '', sales_price: i.sales_price, allocation_method: i.allocation_method,
      remark: i.remark || ''
    })) : [{ ...EMPTY_ITEM }])

    setMessage(null)
    setShowForm(true)
  }

  function updateCharge(idx, field, value) {
    setCharges((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)))
  }
  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!docNo || items.length === 0 || items.length > 10) {
      setMessage({ ok: false, text: 'กรอกเลขที่ใบ และมีรายการสินค้า 1-10 รายการ' })
      return
    }
    setSaving(true)

    let revisionNo = 1
    if (isRevision) {
      const { data: existing } = await supabase.from('cost_sheets').select('revision_no').eq('doc_no', docNo).order('revision_no', { ascending: false }).limit(1).single()
      revisionNo = (existing?.revision_no ?? 0) + 1
    }

    const { data: { user } } = await supabase.auth.getUser()
    const validCharges = charges.filter((c) => c.label && c.amount !== '').map((c) => ({ label: c.label, amount: Number(c.amount) }))

    const { data: sheet, error: sheetError } = await supabase
      .from('cost_sheets')
      .insert({
        doc_no: docNo, revision_no: revisionNo, is_current: true, charges: validCharges, created_by: user?.id,
        customer_id: customerId || null, attend_to: attendTo || null, sale_remark: saleRemark || null
      })
      .select('id').single()

    if (sheetError) { setMessage({ ok: false, text: 'บันทึกไม่สำเร็จ: ' + sheetError.message }); setSaving(false); return }

    const itemRows = items
      .filter((it) => it.qty)
      .map((it) => ({
        cost_sheet_id: sheet.id,
        product_id: it.product_id || null,
        product_name_text: it.product_id ? null : (it.product_name_text || null),
        qty: Number(it.qty),
        weight: it.weight ? Number(it.weight) : null,
        sales_price: Number(it.sales_price) || 0,
        allocation_method: it.allocation_method,
        remark: it.remark || null
      }))

    const { error: itemsError } = await supabase.from('cost_sheet_items').insert(itemRows)

    setSaving(false)
    if (itemsError) { setMessage({ ok: false, text: 'บันทึกรายการสินค้าไม่สำเร็จ: ' + itemsError.message }); return }

    setMessage({ ok: true, text: `บันทึกสำเร็จ (Revision ${revisionNo})` })
    setShowForm(false)
    loadData()
  }

  async function toggleExpand(sheet) {
    if (expandedDocNo === sheet.doc_no) { setExpandedDocNo(null); return }
    setExpandedDocNo(sheet.doc_no)
    if (!itemCalc[sheet.doc_no]) {
      const { data } = await supabase
        .from('v_cost_sheet_item_calc')
        .select('*, cost_sheet_items ( inventory_items ( sku, name ) )')
        .eq('cost_sheet_id', sheet.id)
      setItemCalc((prev) => ({ ...prev, [sheet.doc_no]: data ?? [] }))
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>ใบคำนวณต้นทุน</h2>
          <button className="primary" onClick={openNew}>+ สร้างใบใหม่</button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="stat-card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input placeholder="เลขที่ใบ" value={docNo} onChange={(e) => setDocNo(e.target.value)} disabled={isRevision} required style={{ maxWidth: 240 }} />
              {isRevision && <span className="badge warning">กำลังสร้าง Revision ใหม่</span>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={customerId} onChange={(e) => handleCustomerChange(e.target.value)} style={{ flex: 1 }}>
                <option value="">— ลูกค้า (ถ้าจะออกใบเสนอราคา) —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="Attend to (ผู้ติดต่อ)" value={attendTo} onChange={(e) => setAttendTo(e.target.value)} style={{ flex: 1 }} />
            </div>

            <strong style={{ fontSize: 14 }}>ค่าใช้จ่ายรวมทั้งใบ</strong>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 8px' }}>เพิ่ม/ลดรายการได้อิสระ (เช่น Purchasing Price, THC Charge, Import Duty ฯลฯ)</p>
            {charges.map((c, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input placeholder="ชื่อค่าใช้จ่าย" value={c.label} onChange={(e) => updateCharge(idx, 'label', e.target.value)} style={{ flex: 2 }} />
                <input placeholder="จำนวนเงิน" type="number" value={c.amount} onChange={(e) => updateCharge(idx, 'amount', e.target.value)} style={{ flex: 1 }} />
                <button type="button" onClick={() => setCharges((prev) => prev.filter((_, i) => i !== idx))}>ลบ</button>
              </div>
            ))}
            <button type="button" onClick={() => setCharges((prev) => [...prev, { ...EMPTY_CHARGE }])} style={{ marginBottom: 4 }}>+ เพิ่มค่าใช้จ่าย</button>
            <p style={{ fontSize: 13, marginTop: 6 }}>รวมทั้งใบ: <b className="mono">{totalCharges(charges).toLocaleString()}</b></p>

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--line)' }} />

            <strong style={{ fontSize: 14 }}>รายการสินค้า (สูงสุด 10 รายการ)</strong>
            {items.map((it, idx) => (
              <div key={idx} className="stat-card" style={{ marginTop: 8, padding: 10 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <select value={it.product_id} onChange={(e) => updateItem(idx, 'product_id', e.target.value)} style={{ flex: 2 }}>
                    <option value="">— สินค้าในระบบ (หรือพิมพ์ชื่อใหม่ด้านล่าง) —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                  {!it.product_id && (
                    <input placeholder="ชื่อสินค้า (ถ้ายังไม่มีในระบบ)" value={it.product_name_text} onChange={(e) => updateItem(idx, 'product_name_text', e.target.value)} style={{ flex: 2 }} />
                  )}
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>ลบ</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="จำนวน" type="number" value={it.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} style={{ flex: 1 }} required />
                  <input placeholder="น้ำหนัก (ถ้ามี)" type="number" value={it.weight} onChange={(e) => updateItem(idx, 'weight', e.target.value)} style={{ flex: 1 }} />
                  <input placeholder="ราคาขาย/หน่วย" type="number" value={it.sales_price} onChange={(e) => updateItem(idx, 'sales_price', e.target.value)} style={{ flex: 1 }} />
                  <select value={it.allocation_method} onChange={(e) => updateItem(idx, 'allocation_method', e.target.value)} style={{ flex: 1 }}>
                    <option value="proportional_qty">เฉลี่ยตามสัดส่วน</option>
                    <option value="lump_sum">Lump sum (รับเต็ม)</option>
                  </select>
                </div>
                <input placeholder="Remark (โชว์ในใบเสนอราคา)" value={it.remark} onChange={(e) => updateItem(idx, 'remark', e.target.value)} style={{ width: '100%', marginTop: 6 }} />
              </div>
            ))}
            {items.length < 10 && (
              <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])} style={{ marginTop: 8 }}>+ เพิ่มรายการสินค้า</button>
            )}

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>หมายเหตุ/เงื่อนไขการขาย (แสดงในใบเสนอราคา)</label>
            <textarea
              value={saleRemark}
              onChange={(e) => setSaleRemark(e.target.value)}
              rows={5}
              placeholder="เช่น Price: DDP/THB&#10;Delivery Allowance: +10%, -20%&#10;Payment Term: ..."
              style={{ width: '100%', marginTop: 4 }}
            />

            {message && (
              <p className={`badge ${message.ok ? 'success' : 'danger'}`} style={{ display: 'block', marginTop: 12, width: 'fit-content' }}>{message.text}</p>
            )}

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="primary" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              <button type="button" onClick={() => setShowForm(false)}>ยกเลิก</button>
            </div>
          </form>
        )}

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead><tr><th>เลขที่ใบ</th><th>Revision</th><th>ค่าใช้จ่ายรวม</th><th>วันที่</th><th></th></tr></thead>
          <tbody>
            {sheets.map((s) => (
              <>
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(s)}>
                  <td className="mono">{s.doc_no}</td>
                  <td>Rev {s.revision_no}</td>
                  <td className="mono">{totalCharges(s.charges).toLocaleString()}</td>
                  <td className="mono">{new Date(s.created_at).toLocaleDateString('th-TH')}</td>
                  <td style={{ textAlign: 'right' }}>
                    {s.customer_id && (
                      <a href={`/quotations/${encodeURIComponent(s.doc_no)}`} onClick={(e) => e.stopPropagation()} style={{ marginRight: 12 }}>
                        ดูใบเสนอราคา
                      </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); openRevise(s) }}>แก้ไข (Revision ใหม่)</button>
                  </td>
                </tr>
                {expandedDocNo === s.doc_no && (
                  <tr key={s.id + '-items'}>
                    <td colSpan={5} style={{ background: 'var(--paper)' }}>
                      <table style={{ width: '100%', fontSize: 13, margin: 12 }}>
                        <thead><tr><th style={{ textAlign: 'left' }}>สินค้า</th><th style={{ textAlign: 'right' }}>จำนวน</th><th style={{ textAlign: 'right' }}>ต้นทุน/หน่วย</th><th style={{ textAlign: 'right' }}>ราคาขาย/หน่วย</th><th style={{ textAlign: 'right' }}>GP</th></tr></thead>
                        <tbody>
                          {(itemCalc[s.doc_no] ?? []).map((calc) => {
                            const gp = calc.sales_price - calc.allocated_unit_cost
                            return (
                              <tr key={calc.cost_sheet_item_id}>
                                <td>{calc.cost_sheet_items?.inventory_items ? `${calc.cost_sheet_items.inventory_items.sku} — ${calc.cost_sheet_items.inventory_items.name}` : '-'}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{calc.qty}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{Number(calc.allocated_unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{Number(calc.sales_price).toLocaleString()}</td>
                                <td className="mono" style={{ textAlign: 'right', color: gp >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>{gp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {sheets.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีใบคำนวณต้นทุน</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
