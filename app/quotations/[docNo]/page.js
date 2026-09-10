'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabaseClient'

export default function QuotationDocPage() {
  const { docNo } = useParams()
  const [sheet, setSheet] = useState(null)
  const [items, setItems] = useState([])
  const [company, setCompany] = useState(null)
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [docNo])

  async function loadData() {
    setLoading(true)
    const decoded = decodeURIComponent(docNo)

    const [sheetRes, companyRes, templateRes] = await Promise.all([
      supabase
        .from('cost_sheets')
        .select('id, doc_no, created_at, attend_to, sale_remark, customers ( name, address, tax_id )')
        .eq('doc_no', decoded)
        .eq('is_current', true)
        .single(),
      supabase.from('company_profile').select('*').limit(1).single(),
      supabase.from('quotation_template').select('*').limit(1).single()
    ])

    setSheet(sheetRes.data)
    setCompany(companyRes.data)
    setTemplate(templateRes.data)

    if (sheetRes.data) {
      const { data: itemRows } = await supabase
        .from('cost_sheet_items')
        .select('qty, sales_price, remark, product_name_text, inventory_items ( sku, name )')
        .eq('cost_sheet_id', sheetRes.data.id)
      setItems(itemRows ?? [])
    }

    setLoading(false)
  }

  if (loading) return null
  if (!sheet) return <p style={{ padding: 32 }}>ไม่พบใบเสนอราคาเลขที่ {decodeURIComponent(docNo)}</p>

  const customer = sheet.customers
  const accent = template?.accent_color || '#111111'
  const logoPos = template?.logo_position || 'left'
  const headerJustify = logoPos === 'right' ? 'row-reverse' : logoPos === 'center' ? 'column' : 'row'

  return (
    <div style={{ background: '#f2f2f2', minHeight: '100vh', padding: 20 }}>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .doc-page { box-shadow: none !important; margin: 0 !important; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 800, margin: '0 auto 16px' }}>
        <button onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>
        <a href="/quotations" style={{ marginLeft: 12, fontSize: 13 }}>← กลับไปคลังใบเสนอราคา</a>
      </div>

      <div className="doc-page" style={{ maxWidth: 800, margin: '0 auto', background: 'white', padding: 40, boxShadow: '0 0 12px rgba(0,0,0,0.1)' }}>

        <div style={{ display: 'flex', flexDirection: headerJustify, justifyContent: 'space-between', alignItems: logoPos === 'center' ? 'center' : 'flex-start', gap: 12 }}>
          <div>
            {company?.logo_url && <img src={company.logo_url} alt="logo" style={{ height: 50, marginBottom: 8 }} />}
          </div>
          <div style={{ textAlign: logoPos === 'center' ? 'center' : (logoPos === 'right' ? 'left' : 'right') }}>
            <h2 style={{ margin: 0, color: accent }}>QUOTATION</h2>
            <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{company?.name}</p>
            <p style={{ margin: '2px 0', fontSize: 13, color: '#555' }}>{company?.address}</p>
            <p style={{ margin: '2px 0', fontSize: 13, color: '#555' }}>Tel. {company?.tel}</p>
          </div>
        </div>

        <hr style={{ margin: '20px 0', borderColor: accent, opacity: 0.3 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {template?.show_attend_to && <p><b>Attend to</b> &nbsp; {sheet.attend_to}</p>}
            <p><b>Customer Name</b> &nbsp; {customer?.name}</p>
            <p><b>Company Address</b><br />{customer?.address}</p>
            {template?.show_tax_id && <p><b>TAX ID:</b> &nbsp; {customer?.tax_id}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><b>Quotation No :</b> {sheet.doc_no}</p>
            <p><b>Date:</b> {new Date(sheet.created_at).toLocaleDateString('en-GB')}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 14 }}>
          <thead>
            <tr style={{ background: accent, color: 'white' }}>
              <th style={{ border: '1px solid #ddd', padding: 8, textAlign: 'left' }}>Product</th>
              <th style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>Price</th>
              <th style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>Quantity</th>
              <th style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>Amount</th>
              {template?.show_remark_column && <th style={{ border: '1px solid #ddd', padding: 8, textAlign: 'left' }}>Remark</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ border: '1px solid #ddd', padding: 8 }}>{it.inventory_items?.name ?? it.product_name_text}</td>
                <td style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>{Number(it.sales_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>{it.qty}</td>
                <td style={{ border: '1px solid #ddd', padding: 8, textAlign: 'right' }}>{(it.qty * it.sales_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                {template?.show_remark_column && <td style={{ border: '1px solid #ddd', padding: 8 }}>{it.remark}</td>}
              </tr>
            ))}
          </tbody>
        </table>

        {sheet.sale_remark && (
          <div style={{ marginTop: 24 }}>
            <strong>Sale Remark</strong>
            <p style={{ whiteSpace: 'pre-line', fontSize: 13, marginTop: 6 }}>{sheet.sale_remark}</p>
          </div>
        )}
      </div>
    </div>
  )
}
