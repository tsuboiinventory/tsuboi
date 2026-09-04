'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Sidebar from '../../components/Sidebar'

const EMPTY_FORM = {
  id: null,
  name: '',
  trigger_event: 'stock_movement.created',
  condition: '{\n  "and": [\n    { "field": "movement_type", "op": "=", "value": "outbound" }\n  ]\n}',
  action: '[\n  { "type": "notify", "target": "role:หัวหน้าคลัง", "message": "แจ้งเตือน" }\n]',
  is_active: true
}

export default function AutomationPage() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null) // null = ไม่แสดงฟอร์ม
  const [jsonError, setJsonError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRules() }, [])

  async function loadRules() {
    setLoading(true)
    const { data } = await supabase.from('automation_rules').select('*').order('created_at', { ascending: false })
    setRules(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setJsonError('')
    setForm(EMPTY_FORM)
  }

  function openEdit(rule) {
    setJsonError('')
    setForm({
      id: rule.id,
      name: rule.name,
      trigger_event: rule.trigger_event,
      condition: JSON.stringify(rule.condition, null, 2),
      action: JSON.stringify(rule.action, null, 2),
      is_active: rule.is_active
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setJsonError('')

    let conditionParsed, actionParsed
    try {
      conditionParsed = JSON.parse(form.condition)
      actionParsed = JSON.parse(form.action)
    } catch (err) {
      setJsonError('รูปแบบ JSON ไม่ถูกต้อง: ' + err.message)
      return
    }

    setSaving(true)
    const payload = {
      name: form.name,
      trigger_event: form.trigger_event,
      condition: conditionParsed,
      action: actionParsed,
      is_active: form.is_active
    }

    const { error } = form.id
      ? await supabase.from('automation_rules').update(payload).eq('id', form.id)
      : await supabase.from('automation_rules').insert(payload)

    setSaving(false)
    if (error) { setJsonError('บันทึกไม่สำเร็จ: ' + error.message); return }

    setForm(null)
    loadRules()
  }

  async function handleToggleActive(rule) {
    await supabase.from('automation_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
    loadRules()
  }

  async function handleDelete(rule) {
    if (!confirm(`ลบ Rule "${rule.name}"?`)) return
    await supabase.from('automation_rules').delete().eq('id', rule.id)
    loadRules()
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>กฎ Automation</h2>
          <button className="primary" onClick={openNew}>+ สร้าง Rule ใหม่</button>
        </div>

        {form && (
          <form onSubmit={handleSave} className="stat-card" style={{ marginTop: 16, maxWidth: 600 }}>
            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>ชื่อ Rule</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              style={{ width: '100%', margin: '4px 0 12px' }}
            />

            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Trigger Event</label>
            <select
              value={form.trigger_event}
              onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}
              style={{ width: '100%', margin: '4px 0 12px' }}
            >
              <option value="stock_movement.created">stock_movement.created — เกิดทันทีที่มีความเคลื่อนไหวสต๊อก</option>
              <option value="schedule.daily">schedule.daily — เช็คทุกวันเที่ยงคืน</option>
            </select>

            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Condition (JSON)</label>
            <textarea
              className="mono"
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              rows={6}
              style={{ width: '100%', margin: '4px 0 12px', fontSize: 13 }}
            />

            <label style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Action (JSON)</label>
            <textarea
              className="mono"
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              rows={5}
              style={{ width: '100%', margin: '4px 0 12px', fontSize: 13 }}
            />

            <label style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                style={{ marginRight: 6 }}
              />
              เปิดใช้งาน
            </label>

            {jsonError && <p style={{ color: 'var(--danger-ink)', fontSize: 13 }}>{jsonError}</p>}

            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="primary" type="submit" disabled={saving}>
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
              <button type="button" onClick={() => setForm(null)}>ยกเลิก</button>
            </div>
          </form>
        )}

        <table className="data-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>Trigger</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{r.trigger_event}</td>
                <td>
                  <span className={`badge ${r.is_active ? 'success' : 'danger'}`} style={{ cursor: 'pointer' }}
                    onClick={() => handleToggleActive(r)}>
                    {r.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </span>
                </td>
                <td style={{ textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => openEdit(r)}>แก้ไข</button>
                  <button onClick={() => handleDelete(r)}>ลบ</button>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)', padding: 32 }}>
                ยังไม่มี Rule
              </td></tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  )
}
