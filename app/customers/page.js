'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const STATUS_LABEL = {
  prospect: { label: 'ลูกค้าเป้าหมาย', tone: 'warning' },
  active: { label: 'ใช้งานอยู่', tone: 'success' },
  inactive: { label: 'ไม่ได้ซื้อแล้ว', tone: 'danger' },
  vip: { label: 'VIP', tone: 'success' }
}
const CONTACT_TYPE_LABEL = { call: 'โทร', email: 'อีเมล', meeting: 'นัดเจอ', other: 'อื่นๆ' }

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [users, setUsers] = useState([])
  const [addresses, setAddresses] = useState({})
  const [contactLogs, setContactLogs] = useState({})
  const [expandedId, setExpandedId] = useState(null)

  const [form, setForm] = useState({
    name: '', contact_name: '', phone: '', email: '', address: '',
    tax_id: '', business_type: '', responsible_user_id: '', status: 'prospect'
  })
  const [saving, setSaving] = useState(false)

  const [addrLabel, setAddrLabel] = useState('')
  const [addrText, setAddrText] = useState('')
  const [logType, setLogType] = useState('call')
  const [logNote, setLogNote] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [custRes, userRes] = await Promise.all([
      supabase.from('customers').select('*').order('name'),
      supabase.from('profiles').select('id, name, email').order('name')
    ])
    setCustomers(custRes.data ?? [])
    setUsers(userRes.data ?? [])
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('customers').insert({
      ...form,
      responsible_user_id: form.responsible_user_id || null
    })
    setSaving(false)
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    setForm({ name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '', business_type: '', responsible_user_id: '', status: 'prospect' })
    loadAll()
  }

  async function handleUpdateStatus(customerId, status) {
    await supabase.from('customers').update({ status }).eq('id', customerId)
    loadAll()
  }

  async function handleDeleteCustomer(id) {
    if (!confirm('ลบลูกค้ารายนี้?')) return
    await supabase.from('customers').delete().eq('id', id)
    loadAll()
  }

  async function toggleExpand(customerId) {
    if (expandedId === customerId) { setExpandedId(null); return }
    setExpandedId(customerId)
    if (!addresses[customerId]) {
      const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', customerId)
      setAddresses((prev) => ({ ...prev, [customerId]: data ?? [] }))
    }
    if (!contactLogs[customerId]) {
      const { data } = await supabase.from('customer_contact_logs').select('*').eq('customer_id', customerId).order('contacted_at', { ascending: false })
      setContactLogs((prev) => ({ ...prev, [customerId]: data ?? [] }))
    }
  }

  async function handleAddAddress(customerId) {
    if (!addrText) return
    await supabase.from('customer_addresses').insert({ customer_id: customerId, label: addrLabel || null, address: addrText })
    const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', customerId)
    setAddresses((prev) => ({ ...prev, [customerId]: data ?? [] }))
    setAddrLabel(''); setAddrText('')
  }

  async function handleAddLog(customerId) {
    if (!logNote) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('customer_contact_logs').insert({
      customer_id: customerId, contact_type: logType, note: logNote, created_by: user?.id
    })
    const { data } = await supabase.from('customer_contact_logs').select('*').eq('customer_id', customerId).order('contacted_at', { ascending: false })
    setContactLogs((prev) => ({ ...prev, [customerId]: data ?? [] }))
    setLogNote('')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>ลูกค้า</h2>

        <form onSubmit={handleAddCustomer} className="stat-card" style={{ marginTop: 16, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input placeholder="ชื่อบริษัท" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
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
          <input placeholder="ที่อยู่บริษัท" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
          <button className="primary" type="submit" disabled={saving} style={{ marginTop: 10 }}>+ เพิ่มลูกค้า</button>
        </form>

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead><tr><th>บริษัท</th><th>ผู้ติดต่อ</th><th>ประเภทธุรกิจ</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <>
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(c.id)}>
                  <td>{c.name}</td>
                  <td>{c.contact_name ?? '-'} {c.phone ? `· ${c.phone}` : ''}</td>
                  <td>{c.business_type ?? '-'}</td>
                  <td>
                    <select
                      value={c.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                    >
                      {Object.entries(STATUS_LABEL).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c.id) }}>ลบ</button>
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr key={c.id + '-expand'}>
                    <td colSpan={5} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                        <div>
                          <strong style={{ fontSize: 13 }}>ที่อยู่จัดส่ง</strong>
                          <ul style={{ fontSize: 13, margin: '8px 0' }}>
                            {(addresses[c.id] ?? []).map((a) => (
                              <li key={a.id}>{a.label ? `${a.label}: ` : ''}{a.address}</li>
                            ))}
                            {(addresses[c.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีที่อยู่</li>}
                          </ul>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input placeholder="ป้ายกำกับ" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} style={{ flex: 1 }} />
                            <input placeholder="ที่อยู่" value={addrText} onChange={(e) => setAddrText(e.target.value)} style={{ flex: 2 }} />
                            <button onClick={() => handleAddAddress(c.id)}>+ เพิ่ม</button>
                          </div>
                        </div>

                        <div>
                          <strong style={{ fontSize: 13 }}>ประวัติการติดต่อ</strong>
                          <ul style={{ fontSize: 13, margin: '8px 0', maxHeight: 160, overflowY: 'auto' }}>
                            {(contactLogs[c.id] ?? []).map((l) => (
                              <li key={l.id}>
                                <span className="mono" style={{ color: 'var(--ink-soft)' }}>
                                  {new Date(l.contacted_at).toLocaleDateString('th-TH')}
                                </span>
                                {' '}[{CONTACT_TYPE_LABEL[l.contact_type]}] {l.note}
                              </li>
                            ))}
                            {(contactLogs[c.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีประวัติ</li>}
                          </ul>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <select value={logType} onChange={(e) => setLogType(e.target.value)}>
                              {Object.entries(CONTACT_TYPE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <input placeholder="บันทึกการติดต่อ" value={logNote} onChange={(e) => setLogNote(e.target.value)} style={{ flex: 1 }} />
                            <button onClick={() => handleAddLog(c.id)}>+ บันทึก</button>
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีลูกค้า</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
