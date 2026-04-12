import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        await verifyEmail(token);
        if (!cancelled) {
          setStatus('success');
          setMessage('Your email has been verified successfully.');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err.message || 'Verification failed. The link may have expired.');
        }
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h1 style={S.title}>Email Verification</h1>

        {status === 'loading' && (
          <div style={S.statusBox}>
            <p style={S.statusText}>Verifying your email...</p>
            <div style={S.spinner} />
          </div>
        )}

        {status === 'success' && (
          <div style={S.successBox}>
            <div style={S.iconCircle}>
              <span style={{ fontSize: '1.5rem' }}>&#10003;</span>
            </div>
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div style={S.errorBox}>
            <div style={{ ...S.iconCircle, background: 'rgba(252,165,165,0.15)', color: '#FCA5A5' }}>
              <span style={{ fontSize: '1.5rem' }}>&#10007;</span>
            </div>
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#FCA5A5' }}>{message}</p>
          </div>
        )}

        <p style={S.footerText}>
          <Link to="/login" style={S.link}>Go to Sign In</Link>
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  card: { width: '100%', maxWidth: '28rem', borderRadius: '16px', background: '#1B2330', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', boxShadow: '0 10px 15px rgba(0,0,0,0.3)', textAlign: 'center' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: '0 0 1.5rem 0' },
  statusBox: { padding: '1rem 0' },
  statusText: { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' },
  spinner: { width: '2rem', height: '2rem', border: '3px solid rgba(255,255,255,0.1)', borderTop: '3px solid #22C55E', borderRadius: '50%', margin: '1rem auto 0', animation: 'spin 1s linear infinite' },
  successBox: { padding: '1rem 0', color: '#86EFAC' },
  errorBox: { padding: '1rem 0' },
  iconCircle: { width: '3rem', height: '3rem', borderRadius: '50%', background: 'rgba(134,239,172,0.15)', color: '#86EFAC', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  link: { color: '#86EFAC', textDecoration: 'none', fontSize: '0.875rem' },
  footerText: { color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '1.5rem' },
};
