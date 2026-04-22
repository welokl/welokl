'use client'
import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Plus Jakarta Sans', sans-serif", color: 'var(--text)' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap');

        .pp-hero { background: linear-gradient(135deg, #FF3008 0%, #FF6B00 100%); }
        .pp-card {
          background: var(--card-bg);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 28px;
          margin-bottom: 16px;
        }
        .pp-section-title {
          font-family: 'Syne', sans-serif;
          font-weight: 800;
          font-size: 17px;
          color: var(--text);
          margin-bottom: 12px;
          letter-spacing: -0.02em;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pp-section-title span {
          width: 32px; height: 32px;
          border-radius: 10px;
          background: rgba(255,48,8,.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .pp-body {
          font-size: 14px;
          color: var(--text-3, #888);
          line-height: 1.85;
        }
        .pp-list {
          list-style: none;
          padding: 0; margin: 10px 0 0;
          display: flex; flex-direction: column; gap: 8px;
        }
        .pp-list li {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 14px; color: var(--text-2, #666); line-height: 1.6;
        }
        .pp-list li::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #FF3008;
          flex-shrink: 0;
          margin-top: 8px;
        }
        .pp-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,48,8,.08);
          border: 1px solid rgba(255,48,8,.2);
          border-radius: 999px;
          padding: 5px 14px;
          font-size: 12px; font-weight: 700;
          color: #FF3008;
          margin-bottom: 20px;
        }
        .pp-highlight {
          background: rgba(255,48,8,.06);
          border-left: 3px solid #FF3008;
          border-radius: 0 12px 12px 0;
          padding: 14px 16px;
          margin-top: 12px;
          font-size: 14px;
          color: var(--text-2, #666);
          line-height: 1.7;
        }
        .pp-contact-card {
          background: linear-gradient(135deg, #FF3008, #FF6B00);
          border-radius: 20px;
          padding: 28px;
          text-align: center;
          margin-bottom: 32px;
        }
        .pp-divider {
          height: 1px;
          background: var(--border);
          margin: 8px 0 20px;
        }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FF3008', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 15, color: '#fff' }}>W</div>
            <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: 'var(--text)', letterSpacing: '-0.03em' }}>dwarpar</span>
          </Link>
          <div style={{ flex: 1 }} />
          <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="pp-hero" style={{ padding: '48px 20px 52px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div className="pp-badge" style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', color: '#fff' }}>
            📄 Legal
          </div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,5vw,2.8rem)', color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 12 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,.8)', fontWeight: 500, marginBottom: 0 }}>
            Last updated: March 2026
          </p>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 20px 60px' }}>

        {/* Intro */}
        <div className="pp-card">
          <p className="pp-body">
            Dwarpar ("we", "our", or "us") operates the Dwarpar mobile application and website. This page informs users about our policies regarding the collection, use, and disclosure of personal information when using our service. By using Dwarpar, you agree to the collection and use of information in accordance with this policy.
          </p>
        </div>

        {/* Information We Collect */}
        <div className="pp-card">
          <div className="pp-section-title"><span>👤</span> Information We Collect</div>
          <div className="pp-divider" />

          <p className="pp-body" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Personal Information</p>
          <ul className="pp-list">
            <li>Name</li>
            <li>Phone number</li>
            <li>Email address</li>
            <li>Delivery address</li>
          </ul>

          <p className="pp-body" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, marginTop: 20 }}>Location Data</p>
          <p className="pp-body">Dwarpar may collect precise or approximate location data to:</p>
          <ul className="pp-list">
            <li>Show nearby shops and services</li>
            <li>Enable delivery tracking</li>
            <li>Improve delivery accuracy</li>
          </ul>

          <p className="pp-body" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, marginTop: 20 }}>Device Information</p>
          <ul className="pp-list">
            <li>Device type and operating system</li>
            <li>App usage data</li>
            <li>IP address</li>
          </ul>

          <p className="pp-body" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, marginTop: 20 }}>Order Information</p>
          <p className="pp-body">When you place orders through Dwarpar, we store order details including items ordered, payment information, and delivery status.</p>
        </div>

        {/* How We Use */}
        <div className="pp-card">
          <div className="pp-section-title"><span>⚙️</span> How We Use Your Information</div>
          <div className="pp-divider" />
          <ul className="pp-list">
            <li>Provide and operate the Dwarpar platform</li>
            <li>Process orders and deliveries</li>
            <li>Connect customers with local shops and services</li>
            <li>Improve user experience</li>
            <li>Send order updates and notifications</li>
            <li>Prevent fraud and maintain security</li>
          </ul>
        </div>

        {/* Data Sharing */}
        <div className="pp-card">
          <div className="pp-section-title"><span>🤝</span> Data Sharing</div>
          <div className="pp-divider" />
          <p className="pp-body">Dwarpar may share information with:</p>
          <ul className="pp-list" style={{ marginBottom: 16 }}>
            <li>Local shops to fulfill your orders</li>
            <li>Delivery partners for completing deliveries</li>
            <li>Service providers necessary to operate the platform</li>
          </ul>
          <div className="pp-highlight">
            🔒 <strong>We do not sell personal data to third parties.</strong> Your information is only shared to the extent necessary to deliver our service.
          </div>
        </div>

        {/* Data Security */}
        <div className="pp-card">
          <div className="pp-section-title"><span>🛡️</span> Data Security</div>
          <div className="pp-divider" />
          <p className="pp-body">
            We implement reasonable security measures to protect your personal information from unauthorized access, misuse, or disclosure. All data is stored securely and transmitted over encrypted connections. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </div>

        {/* Third Party */}
        <div className="pp-card">
          <div className="pp-section-title"><span>🔗</span> Third-Party Services</div>
          <div className="pp-divider" />
          <p className="pp-body" style={{ marginBottom: 12 }}>Dwarpar may use third-party services such as:</p>
          <ul className="pp-list">
            <li>Payment providers (UPI, cash processing)</li>
            <li>Cloud infrastructure (Supabase, Vercel)</li>
            <li>Push notification services (Firebase)</li>
            <li>Analytics tools</li>
          </ul>
          <p className="pp-body" style={{ marginTop: 12 }}>These services may collect information as governed by their own privacy policies.</p>
        </div>

        {/* Children */}
        <div className="pp-card">
          <div className="pp-section-title"><span>👶</span> Children's Privacy</div>
          <div className="pp-divider" />
          <p className="pp-body">
            Dwarpar is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us immediately.
          </p>
        </div>

        {/* Changes */}
        <div className="pp-card">
          <div className="pp-section-title"><span>📝</span> Changes to This Policy</div>
          <div className="pp-divider" />
          <p className="pp-body">
            We may update our Privacy Policy from time to time. Any changes will be posted on this page with an updated revision date. We encourage you to review this page periodically. Continued use of the app after changes constitutes acceptance of the new policy.
          </p>
        </div>

        {/* Contact */}
        <div className="pp-contact-card">
          <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
          <h2 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 22, color: '#fff', marginBottom: 8, letterSpacing: '-0.03em' }}>Questions?</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.8)', marginBottom: 20, lineHeight: 1.6 }}>
            If you have any questions about this Privacy Policy, we're here to help.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <a href="mailto:support@dwarpar.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#FF3008', padding: '12px 28px', borderRadius: 14, fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>
              ✉️ support@dwarpar.com
            </a>
            <a href="https://dwarpar.com" style={{ fontSize: 13, color: 'rgba(255,255,255,.75)', fontWeight: 600, textDecoration: 'none' }}>
              dwarpar.com
            </a>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
            © {new Date().getFullYear()} Dwarpar · Your neighbourhood on your phone
          </p>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10 }}>
            <Link href="/" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', fontWeight: 600 }}>Home</Link>
            <Link href="/stores" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', fontWeight: 600 }}>Browse Shops</Link>
            <Link href="/auth/signup" style={{ fontSize: 12, color: 'var(--text-3)', textDecoration: 'none', fontWeight: 600 }}>Sign Up</Link>
          </div>
        </div>

      </div>
    </div>
  )
}
