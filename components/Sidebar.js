'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'สต๊อกสินค้า' },
  { href: '/receive', label: 'รับสินค้าเข้า' },
  { href: '/pick-lists', label: 'ใบสั่งหยิบ' },
  { href: '/customers', label: 'ลูกค้า' },
  { href: '/suppliers', label: 'Supplier' },
  { href: '/import', label: 'นำเข้า Excel' },
  { href: '/automation', label: 'กฎ Automation' },
  { href: '/settings', label: 'ตั้งค่าข้อมูลพื้นฐาน' }
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="sidebar">
      <div className="brand">WMS</div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? 'active' : ''}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div style={{ marginTop: 32 }}>
        <button onClick={handleLogout} style={{ width: '100%' }}>
          ออกจากระบบ
        </button>
      </div>
    </aside>
  )
}
