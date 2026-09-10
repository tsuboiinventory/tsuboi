'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

function PrintTagInner() {
  const searchParams = useSearchParams()
  const initialId = searchParams.get('stock_item_id') || ''

  const [stockItemId, setStockItemId] = useState(initialId)
  const [stockItem, setStockItem] = useState(null)
  const [scanUrl, setScanUrl] = useState('')
  const [fontSize, setFontSize] = useState(11)
  const [statusMsg, setStatusMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const canvasRef = useRef(null)
  const tagRef = useRef(null)

  useEffect(() => {
    if (initialId) loadAndRender(initialId)
  }, [initialId])

  async function loadAndRender(id) {
    if (!id) return
    setLoading(true)
    setStatusMsg('')

    const { data: item, error } = await supabase
      .from('stock_items')
      .select('id, lot_no, expiry_date, qty, inventory_items ( sku, name ), locations ( code )')
      .eq('id', id)
      .single()

    if (error || !item) {
      setStatusMsg('ไม่พบข้อมูลสต๊อกนี้ (เช็คสิทธิ์แผนกด้วย)')
      setLoading(false)
      return
    }
    setStockItem(item)

    let { data: qrTag } = await supabase.from('qr_tags').select('id, code').eq('stock_item_id', id).maybeSingle()

    if (!qrTag) {
      const { data: template } = await supabase.from('tag_templates').select('id').eq('is_default', true).single()
      const code = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const { data: inserted, error: insertErr } = await supabase
        .from('qr_tags')
        .insert({ stock_item_id: id, template_id: template?.id, code })
        .select('id, code')
        .single()
      if (insertErr) { setStatusMsg('สร้าง QR ไม่สำเร็จ: ' + insertErr.message); setLoading(false); return }
      qrTag = inserted
    }

    const url = new URL('/scan', window.location.origin)
    url.searchParams.set('code', qrTag.code)
    setScanUrl(url.toString())

    setLoading(false)
  }

  useEffect(() => {
    if (!scanUrl || !canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, scanUrl, { width: 106, margin: 0 })
  }, [scanUrl])

  useEffect(() => {
    if (!stockItem || !tagRef.current) return
    let size = 11
    setFontSize(size)
    const check = () => {
      if (!tagRef.current) return
      if (tagRef.current.scrollHeight > tagRef.current.clientHeight && size > 7) {
        size -= 0.5
        setFontSize(size)
        requestAnimationFrame(check)
      } else if (tagRef.current.scrollHeight > tagRef.current.clientHeight) {
        setStatusMsg('⚠ เนื้อหายาวเกินพื้นที่ป้าย ถูกตัดบางส่วน')
      }
    }
    requestAnimationFrame(check)
  }, [stockItem])

  function formatDate(d) {
    return new Date(d).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const item = stockItem?.inventory_items
  const fields = stockItem ? [
    { label: 'SKU', value: item?.sku },
    { label: 'Lot', value: stockItem.lot_no || '-' },
    { label: 'หมดอายุ', value: stockItem.expiry_date ? formatDate(stockItem.expiry_date) : '-' },
    { label: 'ตำแหน่ง', value: stockItem.locations?.code }
  ] : []

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <style>{`
          @page { size: 80mm 60mm; margin: 0; }
          @media print {
            body { margin: 0; }
            .no-print { display: none !important; }
            .tag { border: none !important; }
            .app-shell { display: block !important; }
          }
        `}</style>

        <div className="no-print">
          <h2 style={{ margin: '0 0 4px' }}>พิมพ์ QR Tag</h2>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
            <input placeholder="วาง stock_item_id ที่นี่" value={stockItemId} onChange={(e) => setStockItemId(e.target.value)} style={{ flex: 1, maxWidth: 340 }} />
            <button onClick={() => loadAndRender(stockItemId)}>โหลดข้อมูล</button>
            <button className="primary" onClick={() => window.print()} disabled={!stockItem}>พิมพ์</button>
          </div>
          {statusMsg && <p style={{ color: 'var(--warning-ink)', fontSize: 13 }}>{statusMsg}</p>}
          {loading && <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>กำลังโหลด...</p>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <div
            ref={tagRef}
            className="tag"
            style={{
              width: '80mm', height: '60mm', padding: '3mm', boxSizing: 'border-box',
              display: 'flex', flexDirection: 'column', border: '1px solid var(--line)',
              background: 'white', overflow: 'hidden'
            }}
          >
            <div style={{
              fontWeight: 700, fontSize: '12pt', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              borderBottom: '0.3mm solid #999', paddingBottom: '1.5mm', marginBottom: '1.5mm', color: '#111'
            }}>
              {item?.name || '— ยังไม่ได้โหลดข้อมูล —'}
            </div>

            {stockItem && (
              <div style={{ flex: 1, display: 'flex', gap: '3mm', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ flexShrink: 0, alignSelf: 'center' }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: `${fontSize}pt` }}>
                  {fields.map((f) => (
                    <div key={f.label}>
                      <div style={{ color: '#666', fontSize: '0.75em' }}>{f.label}</div>
                      <div style={{ fontWeight: 600, color: '#111' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PrintTagPage() {
  return (
    <Suspense fallback={null}>
      <PrintTagInner />
    </Suspense>
  )
}
