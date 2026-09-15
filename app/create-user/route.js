import { createClient } from '@supabase/supabase-js'

// สำคัญ: SUPABASE_SERVICE_ROLE_KEY ต้องตั้งเป็น Environment Variable ใน Vercel
// (ชื่อห้ามขึ้นต้นด้วย NEXT_PUBLIC_ เด็ดขาด ไม่งั้นจะรั่วไปฝั่ง Browser)

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return Response.json({ error: 'ยังไม่ได้ Login' }, { status: 401 })
    }

    // client ตัวแรก: ใช้ token ของคนเรียก เพื่อเช็คสิทธิ์จริง (ผ่าน RLS ปกติ)
    const callerClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser()
    if (authError || !callerUser) {
      return Response.json({ error: 'Token ไม่ถูกต้อง' }, { status: 401 })
    }

    const { data: profile } = await callerClient
      .from('profiles')
      .select('role_id, roles ( permissions )')
      .eq('id', callerUser.id)
      .single()

    if (!profile?.roles?.permissions?.['users.manage']) {
      return Response.json({ error: 'ไม่มีสิทธิ์สร้างผู้ใช้ใหม่' }, { status: 403 })
    }

    const { email, password, name, role_id } = await request.json()
    if (!email || !password) {
      return Response.json({ error: 'ต้องใส่อีเมลและรหัสผ่าน' }, { status: 400 })
    }

    // client ตัวที่สอง: ใช้ Service Role Key (สิทธิ์เต็ม) สร้าง User จริง — รันเฉพาะฝั่ง Server เท่านั้น
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true
    })

    if (createError) {
      return Response.json({ error: createError.message }, { status: 400 })
    }

    await adminClient.from('profiles').update({ name: name || null, role_id: role_id || null }).eq('id', newUser.user.id)

    return Response.json({ success: true, user_id: newUser.user.id })

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
