'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function ShippingCompaniesPage() {
  const [companies, setCompanies] = useState([])
  const [services, setServices] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '' })
  const [saving, setSaving] = useState(false)

  const [svcLabel, setSvcLabel] = useState('')
  const [svcAmount, setSvcAmount] = useState('')

  useEffect(() => { loadCompanies() }, [])

  async function loadCompanies() {
    const { data } = await supabase.from('shipping_companies').select('*').order('name')
    setCompanies(data ?? [])
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('shipping_companies').insert(form)
    setSaving(false)
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '' })
    loadCompanies()
  }

  async function handleDelete(id) {
    if (!confirm('ลบบริษัทขนส่งรายนี้?')) return
    await supabase.from('shipping_companies').delete().eq('id', id)
    loadCompanies()
  }

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!services[id]) {
      const { data } = await supabase.from('shipping_company_services').select('*').eq('shipping_company_id', id)
      setServices((prev) => ({ ...prev, [id]: data ?? [] }))
    }
  }

  async function handleAddService(companyId) {
    if (!svcLabel || svcAmount === '') return
    await supabase.from('shipping_company_services').insert({
      shipping_company_id: companyId, service_label: svcLabel, default_amount: Number(svcAmount)
    })
    const { data } = await supabase.from('shipping_company_services').select('*').eq('shipping_company_id', companyId)
    setServices((prev) => ({ ...prev, [companyId]: data ?? [] }))
    setSvcLabel(''); setSvcAmount('')
  }

  async function handleDeleteService(companyId, serviceId) {
    await supabase.from('shipping_company_services').delete().eq('id', serviceId)
    const { data } = await supabase.from('shipping_company_services').select('*').eq('shipping_company_id', companyId)
    setServices((prev) => ({ ...prev, [companyId]: data ?? [] }))
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>บริษัทขนส่ง (Shipping Company)</h2>

        <form onSubmit={handleAdd} className="stat-card" style={{ marginTop: 16, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="ชื่อบริษัทขนส่ง" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="ชื่อผู้ติดต่อ" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <input placeholder="เบอร์โทร" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="เลขผู้เสียภาษี" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
          </div>
          <input placeholder="ที่อยู่" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
          <button className="primary" type="submit" disabled={saving} style={{ marginTop: 10 }}>+ เพิ่มบริษัทขนส่ง</button>
        </form>

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead><tr><th>ชื่อ</th><th>ผู้ติดต่อ</th><th></th></tr></thead>
          <tbody>
            {companies.map((c) => (
              <>
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(c.id)}>
                  <td>{c.name}</td>
                  <td>{c.contact_name ?? '-'} {c.phone ? `· ${c.phone}` : ''}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}>ลบ</button>
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr key={c.id + '-svc'}>
                    <td colSpan={3} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12 }}>
                        <strong style={{ fontSize: 13 }}>รายการค่าบริการ (Rate Card)</strong>
                        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 8px' }}>
                          รายการเหล่านี้จะถูกดึงไปใส่ในใบคำนวณต้นทุนอัตโนมัติเมื่อเลือกบริษัทขนส่งนี้ (แก้ไขต่อในใบได้)
                        </p>
                        <ul style={{ fontSize: 13, margin: '8px 0' }}>
                          {(services[c.id] ?? []).map((s) => (
                            <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 400, padding: '4px 0' }}>
                              <span>{s.service_label} — <span className="mono">{Number(s.default_amount).toLocaleString()}</span></span>
                              <button onClick={() => handleDeleteService(c.id, s.id)} style={{ fontSize: 11 }}>ลบ</button>
                            </li>
                          ))}
                          {(services[c.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีรายการค่าบริการ</li>}
                        </ul>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input placeholder="ชื่อค่าบริการ เช่น Freight, Handling" value={svcLabel} onChange={(e) => setSvcLabel(e.target.value)} style={{ flex: 2 }} />
                          <input placeholder="ราคาเริ่มต้น" type="number" value={svcAmount} onChange={(e) => setSvcAmount(e.target.value)} style={{ flex: 1 }} />
                          <button onClick={() => handleAddService(c.id)}>+ เพิ่ม</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีบริษัทขนส่ง</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
