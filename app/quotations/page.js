'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function QuotationsIndexPage() {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('cost_sheets')
      .select('doc_no, revision_no, created_at, customers ( name )')
      .eq('is_current', true)
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRows(data ?? []))
  }, [])

  const filtered = rows.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.doc_no.toLowerCase().includes(q) || (r.customers?.name ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>ใบเสนอราคา</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>
          คลังใบเสนอราคา — Generate จากใบคำนวณต้นทุนที่ผูกลูกค้าไว้ ดูได้อย่างเดียว แก้ไขต้องไปแก้ที่ใบคำนวณต้นทุน
        </p>

        <input
          placeholder="ค้นหาเลขที่ใบ หรือชื่อลูกค้า"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginTop: 16, width: '100%', maxWidth: 400 }}
        />

        <table className="data-table" style={{ marginTop: 16 }}>
          <thead><tr><th>เลขที่ใบ</th><th>ลูกค้า</th><th>วันที่</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.doc_no} style={{ cursor: 'pointer' }} onClick={() => window.location.href = `/quotations/${encodeURIComponent(r.doc_no)}`}>
                <td className="mono">{r.doc_no}</td>
                <td>{r.customers?.name}</td>
                <td className="mono">{new Date(r.created_at).toLocaleDateString('th-TH')}</td>
                <td style={{ textAlign: 'right', color: 'var(--accent)' }}>เปิดดู →</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีใบเสนอราคา</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
