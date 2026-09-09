'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const TABS = [
  { key: 'by_product', label: 'ยอดขายต่อสินค้า' },
  { key: 'by_customer', label: 'ยอดซื้อต่อลูกค้า' },
  { key: 'purchase_compare', label: 'เปรียบเทียบราคาซื้อ' }
]

function fmt(n) {
  return Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function ReportsPage() {
  const [tab, setTab] = useState('by_product')
  const [salesRows, setSalesRows] = useState([])
  const [purchaseRows, setPurchaseRows] = useState([])
  const [categories, setCategories] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [expandedCustomer, setExpandedCustomer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [salesRes, purchaseRes, catRes] = await Promise.all([
      supabase.from('v_sales_report').select('*'),
      supabase.from('v_purchase_report').select('*'),
      supabase.from('categories').select('id, name')
    ])
    setSalesRows(salesRes.data ?? [])
    setPurchaseRows(purchaseRes.data ?? [])
    setCategories(catRes.data ?? [])
    setLoading(false)
  }

  // ---------- Tab 1: ยอดขายต่อสินค้า (เทียบในหมวดเดียวกันได้) ----------
  const byProduct = useMemo(() => {
    const filtered = categoryFilter ? salesRows.filter((r) => r.category_id === categoryFilter) : salesRows
    const map = new Map()
    for (const r of filtered) {
      const key = r.item_id
      if (!map.has(key)) map.set(key, { sku: r.sku, name: r.product_name, qty: 0, saleValue: 0, gp: 0 })
      const acc = map.get(key)
      acc.qty += Number(r.qty)
      acc.saleValue += Number(r.total_sale_value ?? 0)
      acc.gp += Number(r.total_gp ?? 0)
    }
    return [...map.values()]
      .map((a) => ({ ...a, avgPrice: a.qty ? a.saleValue / a.qty : 0, gpPercent: a.saleValue ? (a.gp / a.saleValue) * 100 : 0 }))
      .sort((a, b) => b.saleValue - a.saleValue)
  }, [salesRows, categoryFilter])

  // ---------- Tab 2: ยอดซื้อต่อลูกค้า ----------
  const byCustomer = useMemo(() => {
    const map = new Map()
    for (const r of salesRows) {
      const key = r.customer_id ?? 'ไม่ระบุ'
      if (!map.has(key)) map.set(key, { name: r.customer_name ?? 'ไม่ระบุลูกค้า', qty: 0, value: 0, products: new Map() })
      const acc = map.get(key)
      acc.qty += Number(r.qty)
      acc.value += Number(r.total_sale_value ?? 0)
      const pKey = r.item_id
      const prevQty = acc.products.get(pKey)?.qty ?? 0
      const prevVal = acc.products.get(pKey)?.value ?? 0
      acc.products.set(pKey, { sku: r.sku, name: r.product_name, qty: prevQty + Number(r.qty), value: prevVal + Number(r.total_sale_value ?? 0) })
    }
    return [...map.entries()].map(([id, v]) => ({ id, ...v, products: [...v.products.values()] })).sort((a, b) => b.value - a.value)
  }, [salesRows])

  // ---------- Tab 3: เปรียบเทียบราคาซื้อ (สินค้าเดียวกัน หลาย Supplier/หลายครั้ง) ----------
  const purchaseCompare = useMemo(() => {
    const map = new Map()
    for (const r of purchaseRows) {
      if (r.unit_cost == null) continue
      const key = r.item_id
      if (!map.has(key)) map.set(key, { sku: r.sku, name: r.product_name, entries: [] })
      map.get(key).entries.push({ supplier: r.supplier_name ?? 'ไม่ระบุ', cost: Number(r.unit_cost), date: r.created_at })
    }
    return [...map.values()].filter((p) => p.entries.length > 0)
  }, [purchaseRows])

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>รายงาน</h2>
        {loading && <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>กำลังโหลด...</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 20 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? 'primary' : ''}>{t.label}</button>
          ))}
        </div>

        {tab === 'by_product' && (
          <>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ marginBottom: 12 }}>
              <option value="">ทุกประเภท (เทียบทั้งหมด)</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <table className="data-table">
              <thead><tr><th>SKU</th><th>ชื่อสินค้า</th><th style={{ textAlign: 'right' }}>จำนวนขาย</th><th style={{ textAlign: 'right' }}>ราคาเฉลี่ย/หน่วย</th><th style={{ textAlign: 'right' }}>ยอดขายรวม</th><th style={{ textAlign: 'right' }}>GP%</th></tr></thead>
              <tbody>
                {byProduct.map((p) => (
                  <tr key={p.sku}>
                    <td className="mono">{p.sku}</td>
                    <td>{p.name}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmt(p.qty)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmt(p.avgPrice)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmt(p.saleValue)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: p.gpPercent >= 0 ? 'var(--success-ink)' : 'var(--danger-ink)' }}>{fmt(p.gpPercent)}%</td>
                  </tr>
                ))}
                {byProduct.length === 0 && !loading && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีข้อมูลยอดขาย (ต้องมีการเบิกออกที่อ้างอิงใบคำนวณต้นทุนก่อน)</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {tab === 'by_customer' && (
          <table className="data-table">
            <thead><tr><th>ลูกค้า</th><th style={{ textAlign: 'right' }}>จำนวนรวม</th><th style={{ textAlign: 'right' }}>ยอดซื้อรวม</th><th></th></tr></thead>
            <tbody>
              {byCustomer.map((c) => (
                <>
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}>
                    <td>{c.name}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmt(c.qty)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmt(c.value)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{expandedCustomer === c.id ? 'ซ่อน' : 'ดูรายละเอียด'}</td>
                  </tr>
                  {expandedCustomer === c.id && (
                    <tr key={c.id + '-detail'}>
                      <td colSpan={4} style={{ background: 'var(--paper)' }}>
                        <table style={{ width: '100%', fontSize: 13, margin: 12 }}>
                          <thead><tr><th style={{ textAlign: 'left' }}>สินค้า</th><th style={{ textAlign: 'right' }}>จำนวน</th><th style={{ textAlign: 'right' }}>มูลค่า</th></tr></thead>
                          <tbody>
                            {c.products.map((p) => (
                              <tr key={p.sku}><td>{p.sku} — {p.name}</td><td className="mono" style={{ textAlign: 'right' }}>{fmt(p.qty)}</td><td className="mono" style={{ textAlign: 'right' }}>{fmt(p.value)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {byCustomer.length === 0 && !loading && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'purchase_compare' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 12 }}>ราคาต่อหน่วยแต่ละครั้งที่รับเข้า เทียบตาม Supplier — ใช้พิจารณาว่าราคาต่างกันแค่ไหน</p>
            {purchaseCompare.map((p) => (
              <div key={p.sku} className="stat-card" style={{ marginBottom: 12 }}>
                <strong>{p.sku} — {p.name}</strong>
                <table style={{ width: '100%', fontSize: 13, marginTop: 8 }}>
                  <thead><tr><th style={{ textAlign: 'left' }}>วันที่</th><th style={{ textAlign: 'left' }}>Supplier</th><th style={{ textAlign: 'right' }}>ราคา/หน่วย</th></tr></thead>
                  <tbody>
                    {p.entries.sort((a, b) => new Date(b.date) - new Date(a.date)).map((e, idx) => (
                      <tr key={idx}>
                        <td className="mono">{new Date(e.date).toLocaleDateString('th-TH')}</td>
                        <td>{e.supplier}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{fmt(e.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {purchaseCompare.length === 0 && !loading && (
              <p style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีข้อมูล (ต้องรับเข้าโดยอ้างอิงใบคำนวณต้นทุนก่อน)</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
