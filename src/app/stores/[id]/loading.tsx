export default function StoreDetailLoading() {
  return (
    <div style={{ minHeight: '100dvh', background: '#f5f5f4', paddingBottom: 80 }}>
      {/* Banner skeleton */}
      <div style={{ position: 'relative', height: 180, background: '#fff', overflow: 'visible' }}>
        <div className="skel" style={{ height: 180, borderRadius: 0 }} />
        {/* DP skeleton */}
        <div style={{ position: 'absolute', bottom: -38, left: 16, width: 80, height: 80, borderRadius: 22, background: '#fff', border: '4px solid #fff', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,.15)' }}>
          <div className="skel" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
        </div>
      </div>

      {/* Info section skeleton */}
      <div style={{ background: '#fff', padding: '56px 16px 20px', marginBottom: 10 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skel" style={{ height: 22, borderRadius: 6, width: '50%' }} />
          <div className="skel" style={{ height: 14, borderRadius: 6, width: '35%' }} />
          <div className="skel" style={{ height: 14, borderRadius: 6, width: '60%' }} />
        </div>
      </div>

      {/* Product list skeleton */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
            <div style={{ flex: 1, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skel" style={{ height: 15, borderRadius: 6, width: '65%' }} />
              <div className="skel" style={{ height: 12, borderRadius: 6, width: '80%' }} />
              <div className="skel" style={{ height: 12, borderRadius: 6, width: '30%' }} />
            </div>
            <div className="skel" style={{ width: 120, height: 120, flexShrink: 0, margin: 10, borderRadius: 14 }} />
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
