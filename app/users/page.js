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

  const [showCreate, setShowCreate] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newName, setNewName] = useState('')
  const [newRoleId, setNewRoleId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState(null)

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

  async function handleCreateUser(e) {
    e.preventDefault()
    setCreating(true)
    setCreateMsg(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newEmail, password: newPassword, name: newName, role_id: newRoleId || null })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`เรียก API ไม่สำเร็จ (สถานะ ${res.status}): ${text.startsWith('<') ? 'ไม่พบ API Route (/api/create-user) — เช็คว่าวางไฟล์ถูก path หรือยัง' : text}`)
      }

      const data = await res.json()
      if (data?.error) throw new Error(data.error)

      setCreateMsg({ ok: true, text: 'สร้างบัญชีสำเร็จ' })
      setNewEmail(''); setNewPassword(''); setNewName(''); setNewRoleId('')
      loadData()
    } catch (err) {
      setCreateMsg({ ok: false, text: 'สร้างไม่สำเร็จ: ' + err.message })
    } finally {
      setCreating(false)
    }
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
          กำหนด Role และแผนกที่แต่ละคนเข้าถึงได้
        </p>

        <button className="primary" onClick={() => setShowCreate((v) => !v)} style={{ marginTop: 12 }}>
          {showCreate ? 'ปิดฟอร์ม' : '+ เพิ่มผู้ใช้ใหม่'}
        </button>

        {showCreate && (
          <form onSubmit={handleCreateUser} className="stat-card" style={{ marginTop: 12, maxWidth: 420 }}>
            <input placeholder="อีเมล" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={{ width: '100%', marginBottom: 8 }} />
            <input placeholder="รหัสผ่านเริ่มต้น (อย่างน้อย 6 ตัว)" type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} style={{ width: '100%', marginBottom: 8 }} />
            <input placeholder="ชื่อ" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
            <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
              <option value="">— เลือก Role —</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button className="primary" type="submit" disabled={creating}>{creating ? 'กำลังสร้าง...' : 'สร้างบัญชี'}</button>
            {createMsg && <p className={`badge ${createMsg.ok ? 'success' : 'danger'}`} style={{ display: 'block', marginTop: 10, width: 'fit-content' }}>{createMsg.text}</p>}
          </form>
        )}

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
