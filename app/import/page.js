'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function ImportPage() {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([])
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setErrors([])

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    setRows(XLSX.utils.sheet_to_json(sheet, { defval: '' }))
  }

  async function handleConfirm() {
    setBusy(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .insert({ uploaded_by: user?.id, file_name: fileName, target_table: 'inventory_items', total_rows: rows.length })
      .select('id').single()

    if (jobError) { setResult({ ok: false, text: jobError.message }); setBusy(false); return }

    const { error: rpcError } = await supabase.rpc('bulk_import_inventory_items', {
      p_import_job_id: job.id,
      p_rows: rows
    })

    if (rpcError) { setResult({ ok: false, text: rpcError.message }); setBusy(false); return }

    const { data: jobResult } = await supabase
      .from('import_jobs').select('success_rows, error_rows, total_rows').eq('id', job.id).single()
    const { data: errRows } = await supabase
      .from('import_job_errors').select('row_number, error_message').eq('import_job_id', job.id).order('row_number')

    setResult({ ok: true, ...jobResult })
    setErrors(errRows ?? [])
    setRows([])
    setBusy(false)
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>นำเข้าข้อมูลสินค้าจาก Excel</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
          คอลัมน์ที่รองรับ: sku, name, item_type (product/office_supply), category_name, unit, reorder_point, reorder_qty, asset_no
        </p>

        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ marginTop: 12 }} />

        {rows.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p>พบ {rows.length} แถว จากไฟล์ {fileName}</p>
            <button className="primary" onClick={handleConfirm} disabled={busy}>
              {busy ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้า'}
            </button>
          </div>
        )}

        {result && (
          <p className={`badge ${result.ok ? 'success' : 'danger'}`} style={{ display: 'inline-block', marginTop: 16 }}>
            {result.ok
              ? `นำเข้าสำเร็จ ${result.success_rows}/${result.total_rows} แถว (ผิดพลาด ${result.error_rows})`
              : `นำเข้าไม่สำเร็จ: ${result.text}`}
          </p>
        )}

        {errors.length > 0 && (
          <table className="data-table" style={{ marginTop: 16 }}>
            <thead><tr><th>แถวที่</th><th>ข้อผิดพลาด</th></tr></thead>
            <tbody>
              {errors.map((e, i) => (
                <tr key={i}><td className="mono">{e.row_number}</td><td>{e.error_message}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}
