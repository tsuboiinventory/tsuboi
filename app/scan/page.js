'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

function ScanInner() {
  const searchParams = useSearchParams()
  const codeFromUrl = searchParams.get('code') || ''

  const [code, setCode] = useState(codeFromUrl)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (codeFromUrl) lookup(codeFromUrl)
  }, [codeFromUrl])

  async function lookup(c) {
    setLoading(true)
    setError('')
    setResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('ต้อง Login ก่อนถึงจะดูข้อมูลได้')
      setLoading(false)
      return
    }

    const { data: qrTag, error: qrError } = await supabase
      .from('qr_tags')
      .select(`
        id, code,
        stock_items (
          id, lot_no, expiry_date, qty,
          inventory_items ( sku, name ),
          locations ( code, departments ( name ) )
        )
      `)
      .eq('code', c)
      .single()

    setLoading(false)

    if (qrError || !qrTag) {
      setError('ไม่พบข้อมูล QR นี้ในระบบ (หรือคุณไม่มีสิทธิ์เข้าถึงแผนกนี้)')
      return
    }
    setResult(qrTag.stock_items)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>สแกน QR สต๊อกสินค้า</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>สแกน QR บนป้าย หรือใส่รหัสด้วยตัวเอง</p>

        <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
          <input placeholder="รหัส QR" value={code} onChange={(e) => setCode(e.target.value)} style={{ flex: 1, maxWidth: 320 }} />
          <button className="primary" onClick={() => lookup(code)}>ค้นหา</button>
        </div>

        {loading && <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>กำลังค้นหา...</p>}
        {error && <p className="badge danger" style={{ display: 'inline-block' }}>{error}</p>}

        {result && (
          <div className="stat-card" style={{ maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 10px' }}>{result.inventory_items?.name}</h3>
            {[
              ['SKU', result.inventory_items?.sku],
              ['Lot', result.lot_no || '-'],
              ['วันหมดอายุ', result.expiry_date || '-'],
              ['ตำแหน่ง', `${result.locations?.departments?.name ?? ''} / ${result.locations?.code ?? ''}`],
              ['คงเหลือ', result.qty]
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 14 }}>
                <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanInner />
    </Suspense>
  )
}
