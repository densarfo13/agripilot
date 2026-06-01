/**
 * CommunityFeedPage.jsx — the /community feed.
 *
 *   <Route path="/community" element={<ProtectedRoute><CommunityFeedPage /></ProtectedRoute>} />
 *
 * Paginated grow-share feed. Shows ONLY:
 *   - community-visibility posts
 *   - public posts
 *   - organization posts when the viewer belongs to the org (server enforces)
 *
 * V1: no infinite scroll — explicit "Show more" button per spec §4
 * ("No infinite feed without pagination"). Filters by taxonomy. Like /
 * Comment / Report each call the corresponding API; the action also
 * records a local artifact so the diagnostics stay honest offline.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { tSafe } from '../i18n/tSafe.js';

const POSTS_KEY = 'farroway_community_posts';
const LIKES_KEY = 'farroway_community_likes';
const REPORTS_KEY = 'farroway_community_report_log';
const ARTIFACT_KEY = 'farroway_community_artifacts';

const FILTERS = Object.freeze([
  { key: 'all', label: 'All' },
  { key: 'vegetables', label: 'Vegetables' },
  { key: 'flowers', label: 'Flowers' },
  { key: 'herbs', label: 'Herbs' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'field_crops', label: 'Field Crops' },
  { key: 'questions', label: 'Questions' },
  { key: 'harvests', label: 'Harvests' },
]);

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

function _readLocalPosts() {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(POSTS_KEY);
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  }, []);
}

function _appendArtifact(kind, idempotencyKey, status) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(ARTIFACT_KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push({ kind, idempotencyKey, ts: Date.now(), status: status || 'recorded' });
    const bounded = list.length > 500 ? list.slice(list.length - 500) : list;
    window.localStorage.setItem(ARTIFACT_KEY, JSON.stringify(bounded));
    return true;
  }, false);
}

function _appendLike(postId) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(LIKES_KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push({ postId, ts: Date.now() });
    window.localStorage.setItem(LIKES_KEY, JSON.stringify(list));
    return true;
  }, false);
}

function _appendReport(postId, reason) {
  return _safe(() => {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(REPORTS_KEY);
    const list = _safe(() => { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }, []);
    list.push({ postId, reason: reason || 'unspecified', ts: Date.now() });
    window.localStorage.setItem(REPORTS_KEY, JSON.stringify(list));
    return true;
  }, false);
}

function _filterPosts(posts, filter) {
  return _safe(() => {
    if (!Array.isArray(posts)) return [];
    // Defensive client-side visibility filter — server is authoritative.
    const visible = posts.filter((p) => {
      if (!p || typeof p !== 'object') return false;
      if (p.deletedAt || p.hidden) return false;
      return p.visibility === 'community' || p.visibility === 'public' || p.visibility === 'organization';
    });
    if (filter === 'all') return visible;
    if (filter === 'questions') return visible.filter((p) => p.postType === 'question');
    if (filter === 'harvests') return visible.filter((p) => p.postType === 'harvest');
    const map = {
      vegetables: ['tomato', 'pepper', 'onion', 'lettuce', 'spinach', 'okra'],
      flowers: ['rose', 'sunflower', 'marigold', 'orchid', 'tulip'],
      herbs: ['basil', 'mint', 'parsley', 'thyme', 'coriander'],
      fruit: ['mango', 'banana', 'orange', 'pineapple', 'apple'],
      field_crops: ['maize', 'rice', 'cassava', 'sorghum', 'millet'],
    };
    const list = map[filter];
    if (!list) return visible;
    return visible.filter((p) => {
      const k = (p.cropKey || '').toLowerCase();
      return list.some((c) => k.includes(c));
    });
  }, []);
}

export default function CommunityFeedPage() {
  const [filter, setFilter] = React.useState('all');
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 20;
  const [postsRaw, setPostsRaw] = React.useState(() => _readLocalPosts());
  const [serverFetched, setServerFetched] = React.useState(false);

  // Best-effort server fetch — never blocks render.
  React.useEffect(() => {
    let alive = true;
    _safe(async () => {
      if (typeof fetch !== 'function') return;
      const res = await fetch(`/api/community/feed?limit=${PAGE_SIZE}&page=${page}`, {
        credentials: 'same-origin',
      });
      if (!alive || !res || !res.ok) return;
      const body = await res.json().catch(() => null);
      if (alive && body && Array.isArray(body.posts)) {
        setPostsRaw((prev) => {
          // Merge by id, server wins.
          const byId = new Map();
          prev.forEach((p) => p && p.id && byId.set(p.id, p));
          body.posts.forEach((p) => p && p.id && byId.set(p.id, p));
          return Array.from(byId.values());
        });
        setServerFetched(true);
      }
    }, null);
    return () => { alive = false; };
  }, [page]);

  const filtered = React.useMemo(() => _filterPosts(postsRaw, filter), [postsRaw, filter]);
  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > visible.length;

  const onLike = (post) => {
    const idempotencyKey = `like:${post.id}:${Date.now()}`;
    _appendLike(post.id);
    _appendArtifact('LikeCreated', idempotencyKey, 'recorded');
    _safe(async () => {
      if (typeof fetch !== 'function') return;
      await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/like`, {
        method: 'POST', credentials: 'same-origin',
      });
    }, null);
  };

  const onReport = (post) => {
    const reason = _safe(() => (typeof window !== 'undefined' && window.prompt)
      ? window.prompt(tSafe('community.reportPrompt', 'Why are you reporting this post?'))
      : null, null);
    if (!reason) return;
    const idempotencyKey = `report:${post.id}:${Date.now()}`;
    _appendReport(post.id, reason);
    _appendArtifact('GrowPostReported', idempotencyKey, 'recorded');
    _safe(async () => {
      if (typeof fetch !== 'function') return;
      await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ reason }),
      });
    }, null);
  };

  return (
    <main style={S.page} data-testid="community-feed">
      <header style={S.head}>
        <h1 style={S.title}>{tSafe('community.title', 'Community')}</h1>
        <p style={S.sub}>{tSafe('community.subtitle',
          'See grow updates from other gardeners and farmers. Private by default — your posts are only shared when you choose.')}</p>
      </header>

      <nav style={S.filters} role="navigation" aria-label={tSafe('community.filters', 'Filters')}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button"
            onClick={() => { setFilter(f.key); setPage(1); }}
            style={{ ...S.filterChip, ...(filter === f.key ? S.filterChipOn : null) }}
            data-testid={`community-filter-${f.key}`}>
            {tSafe(`community.filter.${f.key}`, f.label)}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <p style={S.empty}>
          {tSafe('community.empty',
            'No posts yet. Share a grow update from a plant profile or the journal to start the conversation.')}
        </p>
      ) : (
        <ul style={S.list}>
          {visible.map((post) => (
            <li key={post.id} style={S.card} data-testid="community-post">
              <div style={S.cardHead}>
                <strong style={S.author}>{post.authorDisplayName || tSafe('community.anonAuthor', 'Anonymous gardener')}</strong>
                {post.locationLabel ? <span style={S.locLabel}>· {post.locationLabel}</span> : null}
                <span style={S.visBadge}>{tSafe(`community.visibility.${post.visibility}`, post.visibility)}</span>
              </div>
              {post.title ? <h2 style={S.postTitle}>{post.title}</h2> : null}
              <p style={S.meta}>
                {post.plantName || post.cropKey}{post.growthStage ? ` · ${post.growthStage}` : ''}
                {post.healthStatus ? ` · ${post.healthStatus}` : ''}
              </p>
              {post.notes ? <p style={S.notes}>{post.notes}</p> : null}
              <div style={S.cardActions}>
                <button type="button" style={S.action} onClick={() => onLike(post)}
                  data-testid="community-like">
                  👍 {tSafe('community.like', 'Like')} {post.likesCount > 0 ? `(${post.likesCount})` : ''}
                </button>
                <Link to={`/community/posts/${encodeURIComponent(post.id)}`} style={S.action}>
                  💬 {tSafe('community.comment', 'Comment')} {post.commentsCount > 0 ? `(${post.commentsCount})` : ''}
                </Link>
                <button type="button" style={S.actionMuted} onClick={() => onReport(post)}
                  data-testid="community-report">
                  {tSafe('community.report', 'Report')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {hasMore ? (
        <button type="button" style={S.showMore} onClick={() => setPage((n) => n + 1)}
          data-testid="community-show-more">
          {tSafe('community.showMore', 'Show more')}
        </button>
      ) : null}

      <p style={S.footnote}>
        {tSafe('community.footnote',
          'Precise GPS, phone, email and farm address are never shared. Buyer accounts cannot see private grower data.')}
      </p>
    </main>
  );
}

const S = {
  page: { minHeight: '100vh', maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px',
    fontFamily: 'system-ui', color: '#1F2937', background: '#F9FAFB' },
  head: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 800, margin: 0 },
  sub: { fontSize: 13, color: '#4B5563', margin: '6px 0 0' },
  filters: { display: 'flex', flexWrap: 'wrap', gap: 6, margin: '0 0 16px' },
  filterChip: { padding: '6px 12px', borderRadius: 999, border: '1px solid #D1D5DB',
    background: '#FFFFFF', color: '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  filterChipOn: { background: '#6E8B61', color: '#FFFFFF', borderColor: '#6E8B61' },
  list: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 },
  card: { background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 14,
    padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12 },
  author: { color: '#1F2937' },
  locLabel: { color: '#6B7280' },
  visBadge: { marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
    textTransform: 'uppercase', padding: '2px 8px', borderRadius: 999,
    background: 'rgba(110,139,97,0.12)', color: '#33503A' },
  postTitle: { fontSize: 16, fontWeight: 800, margin: 0 },
  meta: { fontSize: 12, color: '#6B7280', margin: 0 },
  notes: { fontSize: 14, color: '#1F2937', margin: 0, lineHeight: 1.5 },
  cardActions: { display: 'flex', gap: 8, marginTop: 4 },
  action: { padding: '6px 12px', borderRadius: 999, border: '1px solid #D1D5DB',
    background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', textDecoration: 'none' },
  actionMuted: { padding: '6px 12px', borderRadius: 999, border: '1px solid #FCA5A5',
    background: '#FEF2F2', color: '#991B1B', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  showMore: { display: 'block', margin: '20px auto 0', padding: '8px 24px', borderRadius: 999,
    border: '1px solid #6E8B61', background: 'rgba(110,139,97,0.08)', color: '#33503A',
    fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  empty: { fontSize: 14, color: '#6B7280', textAlign: 'center', padding: '40px 0' },
  footnote: { fontSize: 11, color: '#9CA3AF', marginTop: 24, textAlign: 'center', fontStyle: 'italic' },
};
