/**
 * Marketplace — buyer-facing list of available produce.
 *
 *   <Route path="/marketplace" element={<Marketplace />} />
 *
 * Spec contract (Buyer + Funding/Impact merge, § 6):
 *   * Cards show: crop, quantity + unit, region, ready date,
 *     status. Filter by crop + region.
 *   * "I'm Interested" button opens an interest form
 *     (name / phone / email / message). On submit:
 *     `saveBuyerInterest()` then a confirmation message.
 *   * Empty state: "No produce available yet." (never crash
 *     on no listings).
 *   * Privacy hard rule: farmer phone is NEVER exposed.
 *     Buyer interest is routed to the platform/admin via the
 *     stored interest record + the BUYER_INTEREST_SUBMITTED
 *     event.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getActiveListings, saveBuyerInterest, MARKET_EVENTS,
} from '../market/marketStore.js';
import { safeTrackEvent } from '../lib/analytics.js';
import { tSafe } from '../i18n/tSafe.js';
import { FARROWAY_BRAND } from '../brand/farrowayBrand.js';
import BrandLogo from '../components/BrandLogo.jsx';

const C = FARROWAY_BRAND.colors;

export default function Marketplace() {
  const [listings, setListings] = useState(() => getActiveListings());
  const [cropFilter, setCropFilter]     = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [activeListing, setActiveListing] = useState(null); // for interest form

  // Re-read storage when the user opens this tab in another
  // window — a farmer adding a listing on their phone should
  // surface in a buyer's tab without a refresh.
  useEffect(() => {
    function onStorage(e) {
      if (e.key === 'farroway_market_listings') {
        setListings(getActiveListings());
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
    return undefined;
  }, []);

  useEffect(() => {
    // Track that this surface was viewed for the impact
    // metrics. Fire-and-forget; never blocks render.
    try { safeTrackEvent('MARKETPLACE_VIEWED', {}); } catch { /* ignore */ }
  }, []);

  // Build filter option lists from current data.
  const cropOptions = useMemo(() => {
    const set = new Set();
    for (const l of listings) {
      const c = String(l.crop || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort();
  }, [listings]);

  const regionOptions = useMemo(() => {
    const set = new Set();
    for (const l of listings) {
      const r = String(l.location?.region || '').trim();
      if (r) set.add(r);
    }
    return Array.from(set).sort();
  }, [listings]);

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      if (cropFilter && String(l.crop || '').toLowerCase()
                          !== cropFilter.toLowerCase()) return false;
      if (regionFilter && String(l.location?.region || '').toLowerCase()
                            !== regionFilter.toLowerCase()) return false;
      return true;
    });
  }, [listings, cropFilter, regionFilter]);

  return (
    <main style={S.page}>
      <div style={S.container}>
        <header style={S.header}>
          <BrandLogo variant="light" size="md" />
          <h1 style={S.title}>
            {tSafe('market.availableProduce', 'Available Produce')}
          </h1>
          <p style={S.lead}>
            {tSafe('market.marketplaceLead',
              'Browse what farmers have ready. Tap "I\u2019m Interested" to start a conversation through Farroway.')}
          </p>
        </header>

        {/* Filters */}
        <section style={S.filters} data-testid="marketplace-filters">
          <label style={S.filterLabel}>
            {tSafe('market.crop', 'Crop')}
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              style={S.filterSelect}
              data-testid="marketplace-filter-crop"
            >
              <option value="">{tSafe('market.allCrops', 'All crops')}</option>
              {cropOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label style={S.filterLabel}>
            {tSafe('market.region', 'Region')}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              style={S.filterSelect}
              data-testid="marketplace-filter-region"
            >
              <option value="">{tSafe('market.allRegions', 'All regions')}</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        </section>

        {/* Listing grid OR empty state */}
        {filtered.length === 0 ? (
          <div style={S.empty} data-testid="marketplace-empty">
            <span style={S.emptyIcon} aria-hidden="true">{'\uD83C\uDF31'}</span>
            <p style={S.emptyText}>
              {tSafe('market.noProduce', 'No produce available yet.')}
            </p>
            <p style={S.emptyHint}>
              {tSafe('market.noProduceHint',
                'New listings will appear here as farmers mark crops ready.')}
            </p>
          </div>
        ) : (
          <ul style={S.grid} data-testid="marketplace-grid">
            {filtered.map((l) => (
              <li key={l.id} style={S.tile}>
                <ListingCard
                  listing={l}
                  onInterested={() => {
                    safeTrackEvent(MARKET_EVENTS.LISTING_VIEWED, {
                      listingId: l.id, crop: l.crop,
                    });
                    setActiveListing(l);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {activeListing && (
        <InterestModal
          listing={activeListing}
          onClose={() => setActiveListing(null)}
          onSubmitted={() => setActiveListing(null)}
        />
      )}

      <p style={S.footerNote}>
        <Link to="/sell" style={S.footerLink}>
          {tSafe('market.iAmAFarmer',
            'Are you a farmer? List your produce →')}
        </Link>
      </p>
    </main>
  );
}

/* ─── Listing card ────────────────────────────────────────── */

function ListingCard({ listing, onInterested }) {
  const ready = listing.readyDate
    ? new Date(listing.readyDate).toLocaleDateString(undefined,
        { month: 'short', day: 'numeric', year: 'numeric' })
    : tSafe('market.readyAnytime', 'Ready now');

  return (
    <article style={cardStyles.card}>
      <div style={cardStyles.cropRow}>
        <span style={cardStyles.crop}>{listing.crop || '—'}</span>
        <span style={cardStyles.statusPill(listing.status)}>
          {String(listing.status || 'ACTIVE')}
        </span>
      </div>
      <div style={cardStyles.qty}>
        {listing.quantity || 0} {listing.unit || 'kg'}
      </div>
      <div style={cardStyles.metaRow}>
        <span style={cardStyles.meta}>
          📍 {listing.location?.region || tSafe('market.unknownRegion', 'Unknown region')}
          {listing.location?.country
            ? `, ${listing.location.country}` : ''}
        </span>
        <span style={cardStyles.meta}>📅 {ready}</span>
      </div>
      {listing.priceRange && (
        <div style={cardStyles.price}>
          💰 {listing.priceRange}
        </div>
      )}
      <button
        type="button"
        onClick={onInterested}
        style={cardStyles.btn}
        data-testid={`marketplace-interest-${listing.id}`}
      >
        {tSafe('market.interested', 'I\u2019m Interested')}
      </button>
    </article>
  );
}

const cardStyles = {
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '1rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    height: '100%',
  },
  cropRow: { display: 'flex', alignItems: 'center',
             justifyContent: 'space-between', gap: '0.5rem' },
  crop:    { fontSize: '1.0625rem', fontWeight: 800, color: C.white,
             textTransform: 'capitalize' },
  statusPill: (s) => ({
    fontSize: '0.6875rem', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    padding: '0.2rem 0.55rem', borderRadius: '999px',
    background: s === 'SOLD'
      ? 'rgba(255,255,255,0.05)'
      : 'rgba(34,197,94,0.15)',
    color: s === 'SOLD'
      ? 'rgba(255,255,255,0.55)'
      : C.lightGreen,
    border: '1px solid rgba(255,255,255,0.10)',
  }),
  qty:     { fontSize: '1.5rem', fontWeight: 800, color: C.white },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: '0.65rem',
             color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' },
  meta:    { display: 'inline-flex', alignItems: 'center', gap: '0.25rem' },
  price:   { color: C.lightGreen, fontWeight: 700, fontSize: '0.9375rem' },
  btn: {
    marginTop: '0.5rem',
    padding: '0.7rem 1rem',
    borderRadius: '10px',
    border: 'none',
    background: C.green,
    color: C.white,
    fontSize: '0.9375rem',
    fontWeight: 800,
    cursor: 'pointer',
    boxShadow: '0 6px 18px rgba(34,197,94,0.20)',
  },
};

/* ─── Buyer-interest modal ────────────────────────────────── */

function InterestModal({ listing, onClose, onSubmitted }) {
  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [message, setMessage] = useState('');
  const [done,    setDone]    = useState(false);
  const [errMsg,  setErrMsg]  = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setErrMsg('');
    if (!name.trim()) {
      setErrMsg(tSafe('market.error.nameRequired', 'Please enter your name.'));
      return;
    }
    if (!phone.trim()) {
      setErrMsg(tSafe('market.error.phoneRequired',
        'Please enter a phone we can reach you on.'));
      return;
    }
    saveBuyerInterest({
      listingId:  listing.id,
      buyerName:  name,
      buyerPhone: phone,
      buyerEmail: email,
      message,
    });
    setDone(true);
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose} role="dialog">
      <div
        style={modalStyles.card}
        onClick={(e) => e.stopPropagation()}
        data-testid="marketplace-interest-modal"
      >
        {!done ? (
          <>
            <header style={modalStyles.header}>
              <h2 style={modalStyles.title}>
                {tSafe('market.interestedTitle',
                  `Interested in ${listing.crop}`)}
              </h2>
              <button type="button" onClick={onClose}
                      style={modalStyles.close}
                      aria-label={tSafe('common.close', 'Close')}>
                ✕
              </button>
            </header>
            <p style={modalStyles.lead}>
              {tSafe('market.interestLead',
                'Share your contact and a short note. Farroway will get in touch.')}
            </p>

            {errMsg && (
              <p style={modalStyles.err} role="alert">{errMsg}</p>
            )}

            <form onSubmit={handleSubmit} style={modalStyles.form}>
              <input
                type="text"
                placeholder={tSafe('market.buyerName', 'Your name')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={modalStyles.input}
                data-testid="interest-name"
                required
              />
              <input
                type="tel"
                placeholder={tSafe('market.buyerPhone', 'Phone (with country code)')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={modalStyles.input}
                data-testid="interest-phone"
                required
              />
              <input
                type="email"
                placeholder={tSafe('market.buyerEmail', 'Email (optional)')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={modalStyles.input}
                data-testid="interest-email"
              />
              <textarea
                placeholder={tSafe('market.buyerMessage',
                  'Anything we should know? (optional)')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                style={{ ...modalStyles.input, resize: 'vertical' }}
                data-testid="interest-message"
              />

              <button type="submit"
                      style={modalStyles.submit}
                      data-testid="interest-submit">
                {tSafe('market.interestSubmit', 'Send Interest')}
              </button>
            </form>

            <p style={modalStyles.privacy}>
              {tSafe('market.interestPrivacy',
                'Your contact stays with Farroway. We never share farmer phone numbers.')}
            </p>
          </>
        ) : (
          <>
            <span style={modalStyles.successIcon}>{'\u2705'}</span>
            <h2 style={modalStyles.title}>
              {tSafe('market.interestThanks', 'Interest sent.')}
            </h2>
            <p style={modalStyles.lead}>
              {tSafe('market.interestThanksLead',
                'The team will follow up with you shortly.')}
            </p>
            <button type="button" onClick={onSubmitted}
                    style={modalStyles.submit}>
              {tSafe('common.done', 'Done')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const modalStyles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'rgba(8,12,22,0.78)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    width: '100%', maxWidth: '28rem',
    background: C.darkPanel,
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '18px', padding: '1.5rem',
    color: C.white,
    display: 'flex', flexDirection: 'column', gap: '0.85rem',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
  },
  header: { display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: '0.5rem' },
  title:  { margin: 0, fontSize: '1.25rem', fontWeight: 800,
            color: C.white, letterSpacing: '-0.005em' },
  close:  { background: 'transparent', border: 'none',
            color: C.white, fontSize: '1rem', cursor: 'pointer' },
  lead:   { margin: 0, color: 'rgba(255,255,255,0.7)',
            fontSize: '0.9375rem', lineHeight: 1.5 },
  err:    { margin: 0, color: '#FCA5A5', fontSize: '0.875rem',
            background: 'rgba(239,68,68,0.10)',
            border: '1px solid rgba(239,68,68,0.30)',
            borderRadius: '8px', padding: '0.5rem 0.75rem' },
  form:   { display: 'flex', flexDirection: 'column', gap: '0.6rem',
            marginTop: '0.25rem' },
  input:  {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.7rem 0.85rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  submit: {
    marginTop: '0.5rem',
    padding: '0.85rem 1.25rem', borderRadius: '12px',
    border: 'none', background: C.green, color: C.white,
    fontSize: '1rem', fontWeight: 800, cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(34,197,94,0.25)',
  },
  successIcon: { fontSize: '2rem' },
  privacy: { margin: 0, color: 'rgba(255,255,255,0.55)',
             fontSize: '0.8125rem', lineHeight: 1.45 },
};

/* ─── Page styles ────────────────────────────────────────── */

const S = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(180deg, ${C.navy} 0%, ${C.darkPanel} 100%)`,
    color: C.white,
    padding: '1.5rem 1rem 4rem',
  },
  container: {
    maxWidth: '64rem', margin: '0 auto',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  header: {
    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    gap: '0.5rem',
  },
  title: { margin: 0, fontSize: '1.5rem', fontWeight: 800,
           letterSpacing: '-0.01em', color: C.white },
  lead:  { margin: 0, color: 'rgba(255,255,255,0.7)',
           fontSize: '0.9375rem', maxWidth: '38rem' },
  filters: {
    display: 'flex', flexWrap: 'wrap', gap: '0.65rem',
    alignItems: 'flex-end',
  },
  filterLabel: {
    display: 'flex', flexDirection: 'column', gap: '0.25rem',
    color: 'rgba(255,255,255,0.65)', fontSize: '0.8125rem',
    minWidth: '12rem',
  },
  filterSelect: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '10px',
    padding: '0.6rem 0.75rem',
    color: C.white, fontSize: '0.9375rem',
    outline: 'none', boxSizing: 'border-box',
  },
  grid: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'grid', gap: '0.85rem',
    gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
  },
  tile: { display: 'flex' },
  empty: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '2rem 1.25rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.5rem', textAlign: 'center',
  },
  emptyIcon: { fontSize: '2rem' },
  emptyText: { margin: 0, fontSize: '1rem', fontWeight: 700,
               color: C.white },
  emptyHint: { margin: 0, color: 'rgba(255,255,255,0.6)',
               fontSize: '0.875rem' },
  footerNote: { textAlign: 'center', marginTop: '2rem' },
  footerLink: { color: C.lightGreen, fontSize: '0.875rem',
                fontWeight: 700, textDecoration: 'none' },
};
