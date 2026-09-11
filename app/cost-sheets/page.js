'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const EMPTY_ITEM = { product_id: '', product_name_text: '', product_search: '', qty: '', unit: '', cost_of_good: '', sales_price: '', remark: '' }
const EMPTY_CHARGE = { label: '', amount: '' }

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
  const [openProductSearchIdx, setOpenProductSearchIdx] = useState(null)
  const [customerId, setCustomerId] = useState('')
  const [attendTo, setAttendTo] = useState('')
  const [saleRemark, setSaleRemark] = useState('')
  const [purchaseRemark, setPurchaseRemark] = useState('')
  const [allocationMethod, setAllocationMethod] = useState('proportional_qty')
  const [exchangeRate, setExchangeRate] = useState('1')
  const [currencyLabel, setCurrencyLabel] = useState('')
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

  function sheetTotals() {
    let totalSales = 0, totalCost = 0
    for (const it of items) {
      const qty = Number(it.qty) || 0
      const calc = liveCalc(it)
      totalSales += qty * (Number(it.sales_price) || 0)
      totalCost += qty * calc.unitCost
    }
    const totalGp = totalSales - totalCost
    const totalGpPercent = totalSales ? (totalGp / totalSales) * 100 : 0
    return { totalSales, totalCost, totalGp, totalGpPercent }
  }

  function totalCharges(chargeList) {
    return chargeList.reduce((sum, c) => sum + (Number(c.amount) || 0), 0)
  }

  // คำนวณต้นทุน/GP แบบสด ตอนกำลังกรอกฟอร์ม (ก่อนบันทึกจริง)
  function liveCalc(item) {
    const rate = Number(exchangeRate) || 1
    const qty = Number(item.qty) || 0
    const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0)
    const totalOverhead = totalCharges(charges)

    const cogThb = (Number(item.cost_of_good) || 0) * rate

    let overheadShare = 0
    if (qty > 0) {
      overheadShare = allocationMethod === 'lump_sum'
        ? totalOverhead / qty
        : (totalQty > 0 ? (totalOverhead * (qty / totalQty)) / qty : 0)
    }

    const unitCost = cogThb + overheadShare
    const salesPrice = Number(item.sales_price) || 0
    const gp = salesPrice - unitCost
    const gpPercent = salesPrice ? (gp / salesPrice) * 100 : 0

    return { unitCost, gp, gpPercent }
  }

  function openNew() {
    setDocNo(''); setIsRevision(false)
    setCharges([{ ...EMPTY_CHARGE }]); setItems([{ ...EMPTY_ITEM }])
    setCustomerId(''); setAttendTo(''); setSaleRemark(''); setPurchaseRemark(''); setAllocationMethod('proportional_qty')
    setExchangeRate('1'); setCurrencyLabel('')
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

    const { data: full } = await supabase.from('cost_sheets').select('customer_id, attend_to, sale_remark, purchase_remark, allocation_method, exchange_rate, currency_label').eq('id', sheet.id).single()
    setCustomerId(full?.customer_id ?? '')
    setAttendTo(full?.attend_to ?? '')
    setSaleRemark(full?.sale_remark ?? '')
    setPurchaseRemark(full?.purchase_remark ?? '')
    setAllocationMethod(full?.allocation_method ?? 'proportional_qty')
    setExchangeRate(String(full?.exchange_rate ?? 1))
    setCurrencyLabel(full?.currency_label ?? '')

    const { data: existingItems } = await supabase
      .from('cost_sheet_items')
      .select('product_id, product_name_text, qty, unit, sales_price, remark, cost_of_good')
      .eq('cost_sheet_id', sheet.id)
    setItems(existingItems && existingItems.length ? existingItems.map((i) => {
      const matched = products.find((p) => p.id === i.product_id)
      return {
        product_id: i.product_id || '', product_name_text: i.product_name_text || '',
        product_search: matched ? `${matched.sku} — ${matched.name}` : (i.product_name_text || ''),
        qty: i.qty, unit: i.unit || '', sales_price: i.sales_price,
        cost_of_good: i.cost_of_good ?? '',
        remark: i.remark || ''
      }
    }) : [{ ...EMPTY_ITEM }])

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
        customer_id: customerId || null, attend_to: attendTo || null, sale_remark: saleRemark || null,
        purchase_remark: purchaseRemark || null,
        allocation_method: allocationMethod,
        exchange_rate: Number(exchangeRate) || 1, currency_label: currencyLabel || null
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
        unit: it.unit || null,
        sales_price: Number(it.sales_price) || 0,
        cost_of_good: Number(it.cost_of_good) || 0,
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
      const { data, error } = await supabase
        .from('v_cost_sheet_item_calc')
        .select('*')
        .eq('cost_sheet_id', sheet.id)
      if (error) { console.error(error); }
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
              <select value={allocationMethod} onChange={(e) => setAllocationMethod(e.target.value)}>
                <option value="proportional_qty">เฉลี่ยตามสัดส่วนจำนวน (ทั้งใบ)</option>
                <option value="lump_sum">Lump sum — รวมทั้งหมดไม่แบ่งสัดส่วน (ทั้งใบ)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>เรทแลกเปลี่ยน (คูณกับ Cost of Good เท่านั้น — ถ้าเป็นบาทอยู่แล้วใส่ 1)</label>
              <input placeholder="เช่น 32 หรือ 1" type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} style={{ maxWidth: 120 }} />
              <input placeholder="สกุลเงิน" value={currencyLabel} onChange={(e) => setCurrencyLabel(e.target.value)} style={{ maxWidth: 120 }} />
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
                <input placeholder="จำนวนเงิน (บาท)" type="number" value={c.amount} onChange={(e) => updateCharge(idx, 'amount', e.target.value)} style={{ flex: 1 }} />
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
                  <div style={{ position: 'relative', flex: 2 }}>
                    <input
                      placeholder="พิมพ์ SKU หรือชื่อสินค้าเพื่อค้นหา"
                      value={it.product_search}
                      onChange={(e) => {
                        updateItem(idx, 'product_search', e.target.value)
                        updateItem(idx, 'product_id', '')
                        setOpenProductSearchIdx(idx)
                      }}
                      onFocus={() => setOpenProductSearchIdx(idx)}
                      onBlur={() => setTimeout(() => setOpenProductSearchIdx((cur) => (cur === idx ? null : cur)), 150)}
                      style={{ width: '100%' }}
                    />
                    {openProductSearchIdx === idx && it.product_search && !it.product_id && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
                        maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.08)'
                      }}>
                        {products
                          .filter((p) => {
                            const q = it.product_search.toLowerCase()
                            return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
                          })
                          .slice(0, 20)
                          .map((p) => (
                            <div
                              key={p.id}
                              onMouseDown={() => {
                                updateItem(idx, 'product_id', p.id)
                                updateItem(idx, 'product_search', `${p.sku} — ${p.name}`)
                                setOpenProductSearchIdx(null)
                              }}
                              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--paper)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <span className="mono">{p.sku}</span> — {p.name}
                            </div>
                          ))}
                        {products.filter((p) => {
                          const q = it.product_search.toLowerCase()
                          return p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
                        }).length === 0 && (
                          <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--ink-soft)' }}>ไม่พบสินค้า — จะใช้เป็นชื่อสินค้าใหม่แทน</div>
                        )}
                      </div>
                    )}
                  </div>
                  {!it.product_id && (
                    <input placeholder="ชื่อสินค้า (ถ้ายังไม่มีในระบบ)" value={it.product_name_text} onChange={(e) => updateItem(idx, 'product_name_text', e.target.value)} style={{ flex: 2 }} />
                  )}
                  <button type="button" onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}>ลบ</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="จำนวน" type="number" value={it.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} style={{ flex: 1 }} required />
                  <select value={it.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} style={{ flex: 1 }}>
                    <option value="">— หน่วยนับ —</option>
                    <option value="ชิ้น">ชิ้น</option>
                    <option value="กก.">กก.</option>
                    <option value="ตัน">ตัน</option>
                    <option value="ม้วน">ม้วน</option>
                    <option value="แผ่น">แผ่น</option>
                    <option value="กล่อง">กล่อง</option>
                    <option value="ลัง">ลัง</option>
                    <option value="เมตร">เมตร</option>
                    <option value="เส้น">เส้น</option>
                    <option value="อัน">อัน</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
                  <input placeholder="Cost of Good (ต้นทุนสินค้า/หน่วย ก่อนคูณเรท)" type="number" value={it.cost_of_good} onChange={(e) => updateItem(idx, 'cost_of_good', e.target.value)} style={{ flex: 1 }} />
                  <input placeholder="ราคาขาย/หน่วย" type="number" value={it.sales_price} onChange={(e) => updateItem(idx, 'sales_price', e.target.value)} style={{ flex: 1 }} />
                </div>

                {(() => {
                  const calc = liveCalc(it)
                  return (
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '6px 0 0' }}>
                      ต้นทุน/หน่วย (ประเมิน): <b className="mono">{calc.unitCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                      {' · '}GP: <b className="mono" style={{ color: calc.gp >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>
                        {calc.gp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </b>
                      {' ('}{calc.gpPercent.toFixed(1)}%{')'}
                    </p>
                  )
                })()}
                <input placeholder="Remark (โชว์ในใบเสนอราคา)" value={it.remark} onChange={(e) => updateItem(idx, 'remark', e.target.value)} style={{ width: '100%', marginTop: 6 }} />
              </div>
            ))}
            {items.length < 10 && (
              <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])} style={{ marginTop: 8 }}>+ เพิ่มรายการสินค้า</button>
            )}

            {(() => {
              const t = sheetTotals()
              return (
                <div className="stat-card" style={{ marginTop: 16, background: 'var(--paper)' }}>
                  <strong style={{ fontSize: 14 }}>สรุปทั้งใบ</strong>
                  <p style={{ fontSize: 13, margin: '8px 0 0' }}>
                    ยอดขายรวม: <b className="mono">{t.totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                    {' · '}ต้นทุนรวม: <b className="mono">{t.totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                    {' · '}GP รวม: <b className="mono" style={{ color: t.totalGp >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>
                      {t.totalGp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </b>
                    {' ('}{t.totalGpPercent.toFixed(1)}%{')'}
                  </p>
                </div>
              )
            })()}

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>หมายเหตุ/เงื่อนไขการขาย (แสดงในใบเสนอราคา)</label>
            <textarea
              value={saleRemark}
              onChange={(e) => setSaleRemark(e.target.value)}
              rows={5}
              placeholder="เช่น Price: DDP/THB&#10;Delivery Allowance: +10%, -20%&#10;Payment Term: ..."
              style={{ width: '100%', marginTop: 4 }}
            />

            <label style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12, display: 'block' }}>เงื่อนไขการซื้อ (ใช้ภายใน — ไม่แสดงบนใบเสนอราคา)</label>
            <textarea
              value={purchaseRemark}
              onChange={(e) => setPurchaseRemark(e.target.value)}
              rows={4}
              placeholder="เช่น เงื่อนไขการชำระเงินกับ Supplier, วันส่งมอบ ฯลฯ"
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
                            const product = products.find((p) => p.id === calc.product_id)
                            const productLabel = product ? `${product.sku} — ${product.name}` : (calc.product_name_text || '-')
                            return (
                              <tr key={calc.cost_sheet_item_id}>
                                <td>{productLabel}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{calc.qty} {calc.unit || ''}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{Number(calc.allocated_unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                <td className="mono" style={{ textAlign: 'right' }}>{Number(calc.sales_price).toLocaleString()}</td>
                                <td className="mono" style={{ textAlign: 'right', color: gp >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>{gp.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {(() => {
                        const rows = itemCalc[s.doc_no] ?? []
                        const totalSales = rows.reduce((sum, r) => sum + r.qty * r.sales_price, 0)
                        const totalCost = rows.reduce((sum, r) => sum + r.qty * r.allocated_unit_cost, 0)
                        const totalGp = totalSales - totalCost
                        const totalGpPercent = totalSales ? (totalGp / totalSales) * 100 : 0
                        return rows.length > 0 ? (
                          <p style={{ fontSize: 13, margin: '8px 12px' }}>
                            <b>สรุปทั้งใบ</b> — ยอดขายรวม: <b className="mono">{totalSales.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                            {' · '}ต้นทุนรวม: <b className="mono">{totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</b>
                            {' · '}GP รวม: <b className="mono" style={{ color: totalGp >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>
                              {totalGp.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </b>
                            {' ('}{totalGpPercent.toFixed(1)}%{')'}
                          </p>
                        ) : null
                      })()}
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
