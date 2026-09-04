'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function CustomersPage() {
  const [customers, setCustomers] = useState([])
  const [addresses, setAddresses] = useState({}) // customer_id -> [address]
  const [expandedId, setExpandedId] = useState(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [taxId, setTaxId] = useState('')
  const [saving, setSaving] = useState(false)

  const [addrLabel, setAddrLabel] = useState('')
  const [addrText, setAddrText] = useState('')

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name')
    setCustomers(data ?? [])
  }

  async function handleAddCustomer(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('customers').insert({ name, phone: phone || null, tax_id: taxId || null })
    setSaving(false)
    if (error) { alert('เพิ่มไม่สำเร็จ: ' + error.message); return }
    setName(''); setPhone(''); setTaxId('')
    loadCustomers()
  }

  async function handleDeleteCustomer(id) {
    if (!confirm('ลบลูกค้ารายนี้?')) return
    await supabase.from('customers').delete().eq('id', id)
    loadCustomers()
  }

  async function toggleAddresses(customerId) {
    if (expandedId === customerId) { setExpandedId(null); return }
    setExpandedId(customerId)
    if (!addresses[customerId]) {
      const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', customerId)
      setAddresses((prev) => ({ ...prev, [customerId]: data ?? [] }))
    }
  }

  async function handleAddAddress(customerId) {
    if (!addrText) return
    await supabase.from('customer_addresses').insert({ customer_id: customerId, label: addrLabel || null, address: addrText })
    const { data } = await supabase.from('customer_addresses').select('*').eq('customer_id', customerId)
    setAddresses((prev) => ({ ...prev, [customerId]: data ?? [] }))
    setAddrLabel(''); setAddrText('')
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>ลูกค้า</h2>

        <form onSubmit={handleAddCustomer} className="filter-row" style={{ marginTop: 16 }}>
          <input placeholder="ชื่อลูกค้า" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="เบอร์โทร" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="เลขผู้เสียภาษี" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          <button className="primary" type="submit" disabled={saving}>+ เพิ่มลูกค้า</button>
        </form>

        <table className="data-table" style={{ marginTop: 16 }}>
          <thead><tr><th>ชื่อ</th><th>เบอร์โทร</th><th>เลขผู้เสียภาษี</th><th></th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <>
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => toggleAddresses(c.id)}>
                  <td>{c.name}</td>
                  <td className="mono">{c.phone ?? '-'}</td>
                  <td className="mono">{c.tax_id ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(c.id) }}>ลบ</button>
                  </td>
                </tr>
                {expandedId === c.id && (
                  <tr key={c.id + '-addr'}>
                    <td colSpan={4} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12 }}>
                        <strong style={{ fontSize: 13 }}>ที่อยู่จัดส่ง</strong>
                        <ul style={{ fontSize: 13, margin: '8px 0' }}>
                          {(addresses[c.id] ?? []).map((a) => (
                            <li key={a.id}>{a.label ? `${a.label}: ` : ''}{a.address}</li>
                          ))}
                          {(addresses[c.id] ?? []).length === 0 && <li style={{ color: 'var(--ink-soft)' }}>ยังไม่มีที่อยู่</li>}
                        </ul>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input placeholder="ป้ายกำกับ เช่น สาขาหลัก" value={addrLabel} onChange={(e) => setAddrLabel(e.target.value)} style={{ flex: 1 }} />
                          <input placeholder="ที่อยู่เต็ม" value={addrText} onChange={(e) => setAddrText(e.target.value)} style={{ flex: 2 }} />
                          <button onClick={() => handleAddAddress(c.id)}>+ เพิ่มที่อยู่</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีลูกค้า</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
