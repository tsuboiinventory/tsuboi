'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const STATUS_LABEL = {
  pending: { label: 'รอหยิบ', tone: 'warning' },
  in_progress: { label: 'กำลังหยิบ', tone: 'warning' },
  completed: { label: 'ส่งแล้ว', tone: 'success' },
  cancelled: { label: 'ยกเลิก', tone: 'danger' }
}

export default function PickListsPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [pickLists, setPickLists] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newCustomerId, setNewCustomerId] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setCheckingAuth(false)
    })
  }, [router])

  useEffect(() => {
    if (checkingAuth) return
    loadData()
  }, [checkingAuth])

  async function loadData() {
    setLoading(true)
    const [listRes, custRes] = await Promise.all([
      supabase
        .from('pick_lists')
        .select('id, status, created_at, closed_at, customers ( name )')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id, name').order('name')
    ])
    setPickLists(listRes.data ?? [])
    setCustomers(custRes.data ?? [])
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newCustomerId) return
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('pick_lists')
      .insert({ customer_id: newCustomerId, created_by: user?.id })
      .select('id')
      .single()

    setCreating(false)

    if (error) {
      alert('สร้างใบสั่งหยิบไม่สำเร็จ: ' + error.message)
      return
    }

    router.push(`/pick-lists/${data.id}`)
  }

  if (checkingAuth) return null

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>ใบสั่งหยิบสินค้า</h2>
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13 }}>
              {loading ? 'กำลังโหลด...' : `ทั้งหมด ${pickLists.length} ใบ`}
            </p>
          </div>
          <button className="primary" onClick={() => setShowCreate((v) => !v)}>
            + สร้างใบสั่งหยิบใหม่
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="stat-card" style={{ marginTop: 20, maxWidth: 420 }}>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
              เลือกลูกค้าสำหรับใบสั่งหยิบนี้
            </label>
            <select
              value={newCustomerId}
              onChange={(e) => setNewCustomerId(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
              required
            >
              <option value="">— เลือกลูกค้า —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button className="primary" type="submit" disabled={creating}>
              {creating ? 'กำลังสร้าง...' : 'สร้างใบและเพิ่มรายการสินค้า'}
            </button>
          </form>
        )}

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>ลูกค้า</th>
              <th>สถานะ</th>
              <th>สร้างเมื่อ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pickLists.map((pl) => {
              const status = STATUS_LABEL[pl.status] ?? { label: pl.status, tone: 'warning' }
              return (
                <tr key={pl.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/pick-lists/${pl.id}`)}>
                  <td>{pl.customers?.name ?? '-'}</td>
                  <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
                  <td className="mono">{new Date(pl.created_at).toLocaleString('th-TH')}</td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)' }}>ดูรายละเอียด →</td>
                </tr>
              )
            })}
            {!loading && pickLists.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>
                ยังไม่มีใบสั่งหยิบ
              </td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
