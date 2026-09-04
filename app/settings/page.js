'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const TABS = [
  { key: 'warehouses', label: 'คลังสินค้า' },
  { key: 'departments', label: 'แผนก' },
  { key: 'locations', label: 'ตำแหน่งจัดเก็บ' },
  { key: 'categories', label: 'ประเภทสินค้า' }
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

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [w, d, l, c] = await Promise.all([
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('departments').select('*, warehouses ( name )').order('name'),
      supabase.from('locations').select('*, departments ( name )').order('code'),
      supabase.from('categories').select('*').order('name')
    ])
    setWarehouses(w.data ?? [])
    setDepartments(d.data ?? [])
    setLocations(l.data ?? [])
    setCategories(c.data ?? [])
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
      </main>
    </div>
  )
}
