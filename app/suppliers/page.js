'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const STATUS_LABEL = { active: { label: 'ใช้งานอยู่', tone: 'success' }, inactive: { label: 'ไม่ได้ใช้แล้ว', tone: 'danger' } }
const CONTACT_TYPE_LABEL = { call: 'โทร', email: 'อีเมล', meeting: 'นัดเจอ', other: 'อื่นๆ' }

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [users, setUsers] = useState([])
  const [purchaseHistory, setPurchaseHistory] = useState({})
  const [contactLogs, setContactLogs] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  const [form, setForm] = useState({
    name: '', contact_name: '', phone: '', email: '', address: '',
    tax_id: '', business_type: '', responsible_user_id: '', status: 'active'
  })
  const [saving, setSaving] = useState(false)

  const [logType, setLogType] = useState('call')
  const [logNote, setLogNote] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [supRes, userRes] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('profiles').select('id, name, email').order('name')
    ])
    setSuppliers(supRes.data ?? [])
    setUsers(userRes.data ?? [])
  }

  async function handleAddSupplier(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert({ ...form, responsible_user_id: form.responsible_user_id || null })
    setSaving(false)
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '', business_type: '', responsible_user_id: '', status: 'active' })
    loadAll()
  }

  async function handleUpdateStatus(supplierId, status) {
    await supabase.from('suppliers').update({ status }).eq('id', supplierId)
    loadAll()
  }

  async function handleDeleteSupplier(id) {
    if (!confirm('ลบ Supplier รายนี้?')) return
    await supabase.from('suppliers').delete().eq('id', id)
    loadAll()
  }

  async function toggleExpand(supplierId) {
    if (expandedId === supplierId) { setExpandedId(null); return }
    setExpandedId(supplierId)
    if (!purchaseHistory[supplierId]) {
      const { data } = await supabase
        .from('v_purchase_report')
        .select('*')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false })
        .limit(30)
      setPurchaseHistory((prev) => ({ ...prev, [supplierId]: data ?? [] }))
    }
    if (!contactLogs[supplierId]) {
      const { data } = await supabase.from('supplier_contact_logs').select('*').eq('supplier_id', supplierId).order('contacted_at', { ascending: false })
      setContactLogs((prev) => ({ ...prev, [supplierId]: data ?? [] }))
    }
  }

  async function handleAddLog(supplierId) {
    if (!logNote) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('supplier_contact_logs').insert({ supplier_id: supplierId, contact_type: logType, note: logNote, created_by: user?.id })
    const { data } = await supabase.from('supplier_contact_logs').select('*').eq('supplier_id', supplierId).order('contacted_at', { ascending: false })
    setContactLogs((prev) => ({ ...prev, [supplierId]: data ?? [] }))
    setLogNote('')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>Supplier</h2>

        <form onSubmit={handleAddSupplier} className="stat-card" style={{ marginTop: 16, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="ชื่อ Supplier" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="ชื่อผู้ติดต่อ" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            <input placeholder="เบอร์โทรศัพท์" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="เลขผู้เสียภาษี" value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} />
            <input placeholder="ประเภทธุรกิจ" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
            <select value={form.responsible_user_id} onChange={(e) => setForm({ ...form, responsible_user_id: e.target.value })}>
              <option value="">— ผู้รับผิดชอบ —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_LABEL).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
            </select>
          </div>
          <input placeholder="ที่อยู่" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
          <button className="primary" type="submit" disabled={saving} style={{ marginTop: 10 }}>+ เพิ่ม Supplier</button>
        </form>

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead><tr><th>ชื่อ</th><th>ผู้ติดต่อ</th><th>ประเภทธุรกิจ</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {suppliers.map((s) => (
              <>
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(s.id)}>
                  <td>{s.name}</td>
                  <td>{s.contact_name ?? '-'} {s.phone ? `· ${s.phone}` : ''}</td>
                  <td>{s.business_type ?? '-'}</td>
                  <td>
                    <select value={s.status} onClick={(e) => e.stopPropagation()} onChange={(e) => handleUpdateStatus(s.id, e.target.value)}>
                      {Object.entries(STATUS_LABEL).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteSupplier(s.id) }}>ลบ</button>
                  </td>
                </tr>
                {expandedId === s.id && (
                  <tr key={s.id + '-expand'}>
                    <td colSpan={5} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>

                        <div>
                          <strong style={{ fontSize: 13 }}>ประวัติการรับสินค้า/ราคาซื้อ</strong>
                          <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 8px' }}>
                            ดึงจากประวัติการรับสินค้าเข้าที่อ้างอิงใบคำนวณต้นทุน — ไม่ต้องกรอกเอง
                          </p>
                          <table style={{ width: '100%', fontSize: 13 }}>
                            <thead><tr><th style={{ textAlign: 'left' }}>วันที่</th><th style={{ textAlign: 'left' }}>สินค้า</th><th style={{ textAlign: 'right' }}>จำนวน</th><th style={{ textAlign: 'right' }}>ราคา/หน่วย</th></tr></thead>
                            <tbody>
                              {(purchaseHistory[s.id] ?? []).map((h) => (
                                <tr key={h.movement_id}>
                                  <td className="mono">{new Date(h.created_at).toLocaleDateString('th-TH')}</td>
                                  <td>{h.sku} — {h.product_name}</td>
                                  <td className="mono" style={{ textAlign: 'right' }}>{h.qty}</td>
                                  <td className="mono" style={{ textAlign: 'right' }}>
                                    {h.unit_cost != null ? Number(h.unit_cost).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
                                  </td>
                                </tr>
                              ))}
                              {(purchaseHistory[s.id] ?? []).length === 0 && (
                                <tr><td colSpan={4} style={{ color: 'var(--ink-soft)', padding: 12 }}>ยังไม่มีประวัติการรับสินค้าจาก Supplier รายนี้</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <strong style={{ fontSize: 13 }}>ประวัติการติดต่อ</strong>
                          <ul style={{ fontSize: 13, margin: '8px 0', maxHeight: 160, overflowY: 'auto' }}>
                            {(contactLogs[s.id] ?? []).map((l) => (
                              <li key={l.id}>
                                <span className="mono" style={{ color: 'var(--ink-soft)' }}>{new Date(l.contacted_at).toLocaleDateString('th-TH')}</span>
                                {' '}[{CONTACT_TYPE_LABEL[l.contact_type]}] {l.note}
                              </li>
                            ))}
                            {(contactLogs[s.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีประวัติ</li>}
                          </ul>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select value={logType} onChange={(e) => setLogType(e.target.value)}>
                              {Object.entries(CONTACT_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <input placeholder="บันทึกการติดต่อ" value={logNote} onChange={(e) => setLogNote(e.target.value)} style={{ flex: 1 }} />
                            <button onClick={() => handleAddLog(s.id)}>+ บันทึก</button>
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มี Supplier</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
