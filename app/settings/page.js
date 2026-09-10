'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const TABS = [
  { key: 'warehouses', label: 'คลังสินค้า' },
  { key: 'departments', label: 'แผนก' },
  { key: 'locations', label: 'ตำแหน่งจัดเก็บ' },
  { key: 'categories', label: 'ประเภทสินค้า' },
  { key: 'quotation_design', label: 'บริษัท & ใบเสนอราคา' }
]

export default function SettingsPage() {
  const [tab, setTab] = useState('warehouses')
  const [warehouses, setWarehouses] = useState([])
  const [departments, setDepartments] = useState([])
  const [locations, setLocations] = useState([])
  const [categories, setCategories] = useState([])

  const [wName, setWName] = useState(''); const [wAddress, setWAddress] = useState('')
  const [dName, setDName] = useState(''); const [dWarehouseId, setDWarehouseId] = useState('')
  const [lCode, setLCode] = useState(''); const [lDeptId, setLDeptId] = useState('')
  const [cName, setCName] = useState('')

  const [company, setCompany] = useState(null)
  const [template, setTemplate] = useState(null)
  const [savingDesign, setSavingDesign] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [w, d, l, c, comp, tmpl] = await Promise.all([
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('departments').select('*, warehouses ( name )').order('name'),
      supabase.from('locations').select('*, departments ( name )').order('code'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('company_profile').select('*').limit(1).single(),
      supabase.from('quotation_template').select('*').limit(1).single()
    ])
    setWarehouses(w.data ?? [])
    setDepartments(d.data ?? [])
    setLocations(l.data ?? [])
    setCategories(c.data ?? [])
    setCompany(comp.data)
    setTemplate(tmpl.data)
  }

  async function saveCompanyAndTemplate(e) {
    e.preventDefault()
    setSavingDesign(true)
    const [r1, r2] = await Promise.all([
      supabase.from('company_profile').update({
        name: company.name, address: company.address, tel: company.tel, logo_url: company.logo_url
      }).eq('id', company.id),
      supabase.from('quotation_template').update({
        accent_color: template.accent_color, logo_position: template.logo_position,
        show_tax_id: template.show_tax_id, show_attend_to: template.show_attend_to,
        show_remark_column: template.show_remark_column
      }).eq('id', template.id)
    ])
    setSavingDesign(false)
    if (r1.error || r2.error) { alert('บันทึกไม่สำเร็จ: ' + (r1.error?.message || r2.error?.message)); return }
    alert('บันทึกแล้ว')
  }

  async function addWarehouse(e) {
    e.preventDefault()
    await supabase.from('warehouses').insert({ name: wName, address: wAddress || null })
    setWName(''); setWAddress(''); loadAll()
  }
  async function addDepartment(e) {
    e.preventDefault()
    if (!dWarehouseId) return
    await supabase.from('departments').insert({ name: dName, warehouse_id: dWarehouseId })
    setDName(''); loadAll()
  }
  async function addLocation(e) {
    e.preventDefault()
    if (!lDeptId) return
    await supabase.from('locations').insert({ code: lCode, department_id: lDeptId })
    setLCode(''); loadAll()
  }
  async function addCategory(e) {
    e.preventDefault()
    await supabase.from('categories').insert({ name: cName })
    setCName(''); loadAll()
  }

  async function remove(table, id) {
    if (!confirm('ลบรายการนี้?')) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { alert('ลบไม่สำเร็จ (อาจมีข้อมูลอื่นผูกอยู่): ' + error.message); return }
    loadAll()
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>ตั้งค่าข้อมูลพื้นฐาน</h2>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 20 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={tab === t.key ? 'primary' : ''}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'warehouses' && (
          <>
            <form onSubmit={addWarehouse} className="filter-row">
              <input placeholder="ชื่อคลัง" value={wName} onChange={(e) => setWName(e.target.value)} required />
              <input placeholder="ที่อยู่" value={wAddress} onChange={(e) => setWAddress(e.target.value)} />
              <button className="primary" type="submit">+ เพิ่มคลัง</button>
            </form>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>ชื่อ</th><th>ที่อยู่</th><th></th></tr></thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}><td>{w.name}</td><td>{w.address ?? '-'}</td>
                    <td style={{ textAlign: 'right' }}><button onClick={() => remove('warehouses', w.id)}>ลบ</button></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'departments' && (
          <>
            <form onSubmit={addDepartment} className="filter-row">
              <select value={dWarehouseId} onChange={(e) => setDWarehouseId(e.target.value)} required>
                <option value="">— เลือกคลัง —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <input placeholder="ชื่อแผนก เช่น Zone A" value={dName} onChange={(e) => setDName(e.target.value)} required />
              <button className="primary" type="submit">+ เพิ่มแผนก</button>
            </form>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>ชื่อแผนก</th><th>คลัง</th><th></th></tr></thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}><td>{d.name}</td><td>{d.warehouses?.name}</td>
                    <td style={{ textAlign: 'right' }}><button onClick={() => remove('departments', d.id)}>ลบ</button></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'locations' && (
          <>
            <form onSubmit={addLocation} className="filter-row">
              <select value={lDeptId} onChange={(e) => setLDeptId(e.target.value)} required>
                <option value="">— เลือกแผนก —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input placeholder="รหัสตำแหน่ง เช่น R2-S3" value={lCode} onChange={(e) => setLCode(e.target.value)} required />
              <button className="primary" type="submit">+ เพิ่มตำแหน่ง</button>
            </form>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>รหัส</th><th>แผนก</th><th></th></tr></thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id}><td className="mono">{l.code}</td><td>{l.departments?.name}</td>
                    <td style={{ textAlign: 'right' }}><button onClick={() => remove('locations', l.id)}>ลบ</button></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === 'categories' && (
          <>
            <form onSubmit={addCategory} className="filter-row">
              <input placeholder="ชื่อประเภทสินค้า" value={cName} onChange={(e) => setCName(e.target.value)} required />
              <button className="primary" type="submit">+ เพิ่มประเภท</button>
            </form>
            <table className="data-table" style={{ marginTop: 16 }}>
              <thead><tr><th>ชื่อ</th><th></th></tr></thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}><td>{c.name}</td>
                    <td style={{ textAlign: 'right' }}><button onClick={() => remove('categories', c.id)}>ลบ</button></td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {tab === 'quotation_design' && company && template && (
          <form onSubmit={saveCompanyAndTemplate} style={{ maxWidth: 520 }}>
            <strong style={{ fontSize: 14 }}>ข้อมูลบริษัท (ขึ้นทุกใบเสนอราคา)</strong>
            <input placeholder="ชื่อบริษัท" value={company.name || ''} onChange={(e) => setCompany({ ...company, name: e.target.value })} style={{ width: '100%', margin: '8px 0' }} />
            <input placeholder="ที่อยู่" value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
            <input placeholder="เบอร์โทร" value={company.tel || ''} onChange={(e) => setCompany({ ...company, tel: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
            <input placeholder="URL โลโก้ (ลิงก์รูปภาพ)" value={company.logo_url || ''} onChange={(e) => setCompany({ ...company, logo_url: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />

            <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid var(--line)' }} />

            <strong style={{ fontSize: 14 }}>Layout ใบเสนอราคา</strong>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '10px 0' }}>
              <label style={{ fontSize: 13 }}>สีหลัก</label>
              <input type="color" value={template.accent_color} onChange={(e) => setTemplate({ ...template, accent_color: e.target.value })} />
              <span className="mono" style={{ fontSize: 12 }}>{template.accent_color}</span>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 13, color: 'var(--ink-soft)', marginRight: 8 }}>ตำแหน่งโลโก้</label>
              <select value={template.logo_position} onChange={(e) => setTemplate({ ...template, logo_position: e.target.value })}>
                <option value="left">ซ้าย</option>
                <option value="center">กลาง</option>
                <option value="right">ขวา</option>
              </select>
            </div>

            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={template.show_tax_id} onChange={(e) => setTemplate({ ...template, show_tax_id: e.target.checked })} style={{ marginRight: 6 }} />
              แสดง TAX ID
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              <input type="checkbox" checked={template.show_attend_to} onChange={(e) => setTemplate({ ...template, show_attend_to: e.target.checked })} style={{ marginRight: 6 }} />
              แสดง Attend to
            </label>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>
              <input type="checkbox" checked={template.show_remark_column} onChange={(e) => setTemplate({ ...template, show_remark_column: e.target.checked })} style={{ marginRight: 6 }} />
              แสดงคอลัมน์ Remark ในตารางสินค้า
            </label>

            <button className="primary" type="submit" disabled={savingDesign}>{savingDesign ? 'กำลังบันทึก...' : 'บันทึก'}</button>
          </form>
        )}
      </main>
    </div>
  )
}
