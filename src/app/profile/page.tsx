'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BottomNav from '@/components/BottomNav'
import Link from 'next/link'

interface SavedAddress { label: string; address: string; lat?: number; lng?: number }

// SVG icons
const Icons = {
  back: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  orders: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" stroke="#555" strokeWidth="2" strokeLinecap="round"/><rect x="9" y="3" width="6" height="4" rx="2" stroke="#555" strokeWidth="2"/><path d="M9 12h6M9 16h4" stroke="#555" strokeWidth="2" strokeLinecap="round"/></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  lock: <svg viewBox="0 0 24 24" fill="none" width={20} height={20}><rect x="3" y="11" width="18" height="11" rx="2" stroke="#555" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="#555" strokeWidth="2" strokeLinecap="round"/></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M9 18l6-6-6-6" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#888"/></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" width={12} height={12}><path d="M18 6L6 18M6 6l12 12" stroke="#888" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" width={16} height={16}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

export default function ProfilePage() {
  const router = useRouter()
  const [user,      setUser]      = useState<any>(null)
  const [name,      setName]      = useState('')
  const [phone,     setPhone]     = useState('')
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [orderCount,setOrderCount]= useState(0)
  const [editing,   setEditing]   = useState(false)
  const [err,       setErr]       = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user: au } } = await sb.auth.getUser()
    if (!au) { window.location.href = '/auth/login'; return }
    const [{ data: profile }, { count }] = await Promise.all([
      sb.from('users').select('*').eq('id', au.id).single(),
      sb.from('orders').select('*', { count:'exact', head:true }).eq('customer_id', au.id).eq('status', 'delivered'),
    ])
    setUser(profile); setName(profile?.name || ''); setPhone(profile?.phone || '')
    setOrderCount(count || 0)
    try { setAddresses(JSON.parse(localStorage.getItem('welokl_addresses') || '[]')) } catch {}
    setLoading(false)
  }

  async function saveProfile() {
    if (!name.trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    await createClient().from('users').update({ name: name.trim(), phone: phone.trim() || null }).eq('id', user.id)
    setSaved(true); setEditing(false); setTimeout(() => setSaved(false), 2200); setSaving(false)
  }

  function removeAddress(label: string) {
    const updated = addresses.filter(a => a.label !== label)
    setAddresses(updated); localStorage.setItem('welokl_addresses', JSON.stringify(updated))
  }

  async function signOut() {
    await createClient().auth.signOut(); window.location.href = '/'
  }

  const inp: React.CSSProperties = { width:'100%', padding:'13px 14px', borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--input-bg)', color:'var(--text-primary)', fontSize:15, fontFamily:'inherit', outline:'none', boxSizing:'border-box', transition:'border .2s' }

  const QUICK_LINKS = [
    { icon: Icons.orders, label:'My Orders',     sub:`${orderCount} delivered`, href:'/orders/history', color:'var(--blue-light)', iconColor:'#4f46e5' },
    { icon: Icons.heart,  label:'Saved Shops',   sub:'Your favourites',         href:'/favourites',     color:'var(--red-light)', iconColor:'#FF3008' },
    { icon: Icons.lock,   label:'Privacy Policy', sub:'How we use your data',   href:'/privacy',        color:'var(--page-bg)', iconColor:'var(--text-muted)' },
  ]

  const ADDRESS_ICONS: Record<string,JSX.Element> = {
    home: <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#4f46e5" strokeWidth="2"/><polyline points="9 22 9 12 15 12 15 22" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round"/></svg>,
    work: <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><rect x="2" y="7" width="20" height="14" rx="2" stroke="#16a34a" strokeWidth="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" stroke="#16a34a" strokeWidth="2"/></svg>,
    other: <svg viewBox="0 0 24 24" fill="none" width={18} height={18}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FF3008" opacity=".15"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#FF3008"/></svg>,
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--page-bg)', fontFamily:"'Plus Jakarta Sans',sans-serif", paddingBottom:'calc(88px + env(safe-area-inset-bottom, 0px))' }}>

      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'var(--card-white)', borderBottom:'1px solid var(--divider)', padding:'0 16px' }}>
        <div style={{ maxWidth:640, margin:'0 auto', display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={() => router.back()} style={{ width:36, height:36, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {Icons.back}
          </button>
          <h1 style={{ fontWeight:900, fontSize:17, color:'var(--text-primary)', flex:1, letterSpacing:'-0.02em' }}>My Account</h1>
        </div>
      </div>

      {loading ? (
        <div style={{ padding:'20px 12px', maxWidth:640, margin:'0 auto', display:'flex', flexDirection:'column', gap:12 }}>
          <style>{`@keyframes sh{0%{background-position:-400px 0}100%{background-position:400px 0}}.sk{background:linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);background-size:400px 100%;animation:sh 1.4s infinite;border-radius:16px;}`}</style>
          {[100,80,200,160].map((h,i) => <div key={i} className="sk" style={{ height:h }} />)}
        </div>
      ) : (
        <div style={{ maxWidth:640, margin:'0 auto', padding:'16px 12px' }}>

          {/* Profile hero */}
          <div style={{ background:'var(--card-white)', borderRadius:24, padding:'24px 20px', marginBottom:12, position:'relative' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'linear-gradient(135deg,#FF3008,#ff6b35)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:28, fontWeight:900, color:'#fff' }}>{name.charAt(0).toUpperCase() || '?'}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:900, fontSize:18, color:'var(--text-primary)', marginBottom:2, letterSpacing:'-0.02em' }}>{name || 'Your name'}</p>
                <p style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email}</p>
                {phone && <p style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>{phone}</p>}
              </div>
              <button onClick={() => setEditing(!editing)} style={{ width:36, height:36, borderRadius:12, background:'var(--page-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                {Icons.edit}
              </button>
            </div>

            {/* Stats */}
            <div style={{ marginTop:20 }}>
              <div style={{ background:'var(--red-light)', borderRadius:16, padding:'14px 16px', textAlign:'center' }}>
                <p style={{ fontSize:22, fontWeight:900, color:'#FF3008', letterSpacing:'-0.03em' }}>{orderCount}</p>
                <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', marginTop:2 }}>Orders delivered</p>
              </div>
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div style={{ background:'var(--card-white)', borderRadius:20, padding:'20px', marginBottom:12 }}>
              <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom:16 }}>Edit details</p>
              {err && <div style={{ background:'var(--error-light)', border:'1px solid #fecaca', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>⚠ {err}</div>}
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Full name</label>
                <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="Your full name"
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'} onBlur={e => e.currentTarget.style.borderColor='#eee'} />
              </div>
              <div style={{ marginBottom:18 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'var(--text-secondary)', marginBottom:6 }}>Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="10-digit number"
                  onFocus={e => e.currentTarget.style.borderColor='#FF3008'} onBlur={e => e.currentTarget.style.borderColor='#eee'} />
              </div>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setEditing(false)} style={{ flex:1, padding:'13px', borderRadius:14, border:'1.5px solid var(--divider)', background:'var(--page-bg)', color:'var(--text-primary)', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving} style={{ flex:2, padding:'13px', borderRadius:14, border:'none', background: saved ? '#16a34a' : '#FF3008', color:'#fff', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'inherit', transition:'background .2s' }}>
                  {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save changes'}
                </button>
              </div>
            </div>
          )}

          {/* Quick links */}
          <div style={{ background:'var(--card-white)', borderRadius:20, overflow:'hidden', marginBottom:12 }}>
            {QUICK_LINKS.map((item, i, arr) => (
              <Link key={item.label} href={item.href} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderBottom: i < arr.length-1 ? '1px solid #F5F5F5' : 'none', textDecoration:'none' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:item.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {item.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:700, fontSize:14, color:'var(--text-primary)', marginBottom:1 }}>{item.label}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)' }}>{item.sub}</p>
                </div>
                {Icons.chevron}
              </Link>
            ))}
          </div>

          {/* Saved addresses */}
          <div style={{ background:'var(--card-white)', borderRadius:20, padding:'18px 16px', marginBottom:12 }}>
            <p style={{ fontWeight:800, fontSize:15, color:'var(--text-primary)', marginBottom: addresses.length ? 14 : 8 }}>Saved addresses</p>
            {addresses.length === 0 ? (
              <p style={{ fontSize:13, color:'var(--text-faint)' }}>No saved addresses yet. Save one at checkout.</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {addresses.map(addr => (
                  <div key={addr.label} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:14, background:'var(--input-bg)', border:'1px solid var(--divider)' }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'var(--chip-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {ADDRESS_ICONS[addr.label] || ADDRESS_ICONS.other}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:800, color:'var(--text-secondary)', textTransform:'capitalize', marginBottom:2 }}>{addr.label}</p>
                      <p style={{ fontSize:13, color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{addr.address}</p>
                    </div>
                    <button onClick={() => removeAddress(addr.label)} style={{ width:28, height:28, borderRadius:8, background:'var(--chip-bg)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {Icons.close}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sign out */}
          <button onClick={signOut} style={{ width:'100%', padding:'14px', borderRadius:18, border:'none', background:'var(--card-white)', color:'#ef4444', fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <svg viewBox="0 0 24 24" fill="none" width={18} height={18}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>

        </div>
      )}

      <BottomNav active="account" />
    </div>
  )
}