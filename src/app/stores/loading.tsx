export default function StoresLoading() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #fafaf9)', padding: '0 0 80px' }}>
      {/* Header skeleton */}
      <div style={{ background: '#fff', padding: '16px', borderBottom: '1px solid #f0efee' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="skel" style={{ height: 40, borderRadius: 12 }} />
        </div>
      </div>

      {/* Category chips skeleton */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skel" style={{ height: 32, width: 80, borderRadius: 999, flexShrink: 0 }} />
        ))}
      </div>

      {/* Shop cards skeleton */}
      <div style={{ padding: '0 16px', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 0, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
            <div className="skel" style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 0 }} />
            <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skel" style={{ height: 16, borderRadius: 6, width: '60%' }} />
              <div className="skel" style={{ height: 12, borderRadius: 6, width: '40%' }} />
              <div className="skel" style={{ height: 12, borderRadius: 6, width: '50%' }} />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .skel {
          background: linear-gradient(90deg, #f0efee 25%, #e8e6e4 50%, #f0efee 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
