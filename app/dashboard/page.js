'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function DashboardPage() {
  const router = useRouter()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(true)
  const [stockItems, setStockItems] = useState([])
  const [departments, setDepartments] = useState([])
  const [categories, setCategories] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  const [departmentFilter, setDepartmentFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')

  // เช็คว่า Login อยู่ไหม ก่อนโหลดข้อมูลใดๆ
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
        return
      }
      setCheckingAuth(false)
    })
  }, [router])

  useEffect(() => {
    if (checkingAuth) return
    loadData()
  }, [checkingAuth])

  async function loadData() {
    setLoading(true)

    const [stockRes, deptRes, catRes, notifRes, userRes] = await Promise.all([
      supabase
        .from('stock_items')
        .select(`
          id, qty, reserved_qty, lot_no, expiry_date,
          inventory_items ( id, sku, name, category_id ),
          locations ( id, code, department_id, departments ( id, name ) ),
          products ( reorder_point )
        `)
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('categories').select('id, name').order('name'),
      supabase.auth.getUser(),
      supabase.auth.getUser()
    ])

    setStockItems(stockRes.data ?? [])
    setDepartments(deptRes.data ?? [])
    setCategories(catRes.data ?? [])

    const userId = notifRes.data?.user?.id
    if (userId) {
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      setUnreadCount(count ?? 0)
    }

    setLoading(false)
  }

  function getStatus(row) {
    const reorderPoint = row.products?.reorder_point ?? 0
    const daysToExpiry = row.expiry_date
      ? Math.ceil((new Date(row.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      : null

    if (row.qty < reorderPoint) return { label: 'ต่ำกว่าจุดสั่งซื้อ', tone: 'danger' }
    if (daysToExpiry !== null && daysToExpiry <= 7) return { label: 'ใกล้หมดอายุ', tone: 'warning' }
    return { label: 'ปกติ', tone: 'success' }
  }

  const filteredItems = useMemo(() => {
    return stockItems.filter((row) => {
      if (departmentFilter && row.locations?.department_id !== departmentFilter) return false
      if (categoryFilter && row.inventory_items?.category_id !== categoryFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const matchSku = row.inventory_items?.sku?.toLowerCase().includes(q)
        const matchName = row.inventory_items?.name?.toLowerCase().includes(q)
        if (!matchSku && !matchName) return false
      }
      return true
    })
  }, [stockItems, departmentFilter, categoryFilter, search])

  const stats = useMemo(() => {
    const totalSku = new Set(stockItems.map((r) => r.inventory_items?.id)).size
    const lowStock = stockItems.filter((r) => r.qty < (r.products?.reorder_point ?? 0)).length
    const nearExpiry = stockItems.filter((r) => {
      if (!r.expiry_date) return false
      const days = Math.ceil((new Date(r.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
      return days <= 7
    }).length
    return { totalSku, lowStock, nearExpiry }
  }, [stockItems])

  if (checkingAuth) return null

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>รายการสต๊อกสินค้า</h2>
            <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 13 }}>
              {loading ? 'กำลังโหลด...' : `ทั้งหมด ${filteredItems.length} รายการ`}
            </p>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat-card">
            <div className="label">SKU ทั้งหมด</div>
            <div className="value">{stats.totalSku}</div>
          </div>
          <div className="stat-card">
            <div className="label">ต่ำกว่าจุดสั่งซื้อ</div>
            <div className="value" style={{ color: 'var(--danger-ink)' }}>{stats.lowStock}</div>
          </div>
          <div className="stat-card">
            <div className="label">ใกล้หมดอายุ</div>
            <div className="value" style={{ color: 'var(--warning-ink)' }}>{stats.nearExpiry}</div>
          </div>
          <div className="stat-card">
            <div className="label">แจ้งเตือนที่ยังไม่อ่าน</div>
            <div className="value">{unreadCount}</div>
          </div>
        </div>

        <div className="filter-row">
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">ทุกประเภท</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="ค้นหา SKU หรือชื่อสินค้า"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>ชื่อสินค้า</th>
              <th>ตำแหน่ง</th>
              <th>คงเหลือ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((row) => {
              const status = getStatus(row)
              return (
                <tr key={row.id}>
                  <td className="mono">{row.inventory_items?.sku}</td>
                  <td>{row.inventory_items?.name}</td>
                  <td>
                    {row.locations?.departments?.name} / {row.locations?.code}
                  </td>
                  <td className="mono">{row.qty}</td>
                  <td><span className={`badge ${status.tone}`}>{status.label}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <a href={`/print-tag?stock_item_id=${row.id}`} title="พิมพ์ QR">🏷️</a>
                  </td>
                </tr>
              )
            })}
            {!loading && filteredItems.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>
                ไม่พบข้อมูลตามตัวกรองนี้
              </td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
