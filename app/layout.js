import './globals.css'

export const metadata = {
  title: 'WMS — ระบบคลังสินค้า',
  description: 'ระบบจัดการคลังสินค้า'
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
