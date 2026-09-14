'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])
  const [userDeptAccess, setUserDeptAccess] = useState({}) // user_id -> [department_id]
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [userRes, roleRes, deptRes] = await Promise.all([
      supabase.from('profiles').select('id, name, email, role_id').order('email'),
      supabase.from('roles').select('id, name').order('name'),
      supabase.from('departments').select('id, name, warehouses ( name )').order('name')
    ])
    setUsers(userRes.data ?? [])
    setRoles(roleRes.data ?? [])
    setDepartments(deptRes.data ?? [])
  }

  async function handleRoleChange(userId, roleId) {
    await supabase.from('profiles').update({ role_id: roleId || null }).eq('id', userId)
    loadData()
  }

  async function toggleExpand(userId) {
    if (expandedId === userId) { setExpandedId(null); return }
    setExpandedId(userId)
    if (!userDeptAccess[userId]) {
      const { data } = await supabase.from('user_department_access').select('department_id').eq('user_id', userId)
      setUserDeptAccess((prev) => ({ ...prev, [userId]: (data ?? []).map((d) => d.department_id) }))
    }
  }

  async function toggleDeptAccess(userId, deptId, checked) {
    if (checked) {
      await supabase.from('user_department_access').insert({ user_id: userId, department_id: deptId })
    } else {
      await supabase.from('user_department_access').delete().eq('user_id', userId).eq('department_id', deptId)
    }
    const { data } = await supabase.from('user_department_access').select('department_id').eq('user_id', userId)
    setUserDeptAccess((prev) => ({ ...prev, [userId]: (data ?? []).map((d) => d.department_id) }))
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <h2 style={{ margin: '0 0 4px' }}>จัดการผู้ใช้งาน</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, margin: 0 }}>
          กำหนด Role และแผนกที่แต่ละคนเข้าถึงได้ — บัญชีต้องถูกสร้างผ่าน Supabase Auth ก่อน (Dashboard → Authentication) หน้านี้แค่ผูกสิทธิ์เท่านั้น
        </p>

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead><tr><th>อีเมล</th><th>ชื่อ</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <>
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => toggleExpand(u.id)}>
                  <td className="mono">{u.email}</td>
                  <td>{u.name ?? '-'}</td>
                  <td>
                    <select value={u.role_id ?? ''} onClick={(e) => e.stopPropagation()} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      <option value="">— ไม่มี Role —</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)' }}>{expandedId === u.id ? 'ซ่อนแผนก' : 'ตั้งค่าแผนก'}</td>
                </tr>
                {expandedId === u.id && (
                  <tr key={u.id + '-dept'}>
                    <td colSpan={4} style={{ background: 'var(--paper)' }}>
                      <div style={{ padding: 12 }}>
                        <strong style={{ fontSize: 13 }}>แผนกที่เข้าถึงได้</strong>
                        <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 8px' }}>
                          ถ้า Role มี permission "access_all_departments" อยู่แล้ว จะเห็นทุกแผนกโดยไม่ต้องติ๊กที่นี่
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {departments.map((d) => (
                            <label key={d.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <input
                                type="checkbox"
                                checked={(userDeptAccess[u.id] ?? []).includes(d.id)}
                                onChange={(e) => toggleDeptAccess(u.id, d.id, e.target.checked)}
                              />
                              {d.warehouses?.name} / {d.name}
                            </label>
                          ))}
                          {departments.length === 0 && <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>ยังไม่มีแผนกในระบบ</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>ยังไม่มีผู้ใช้งาน</td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
