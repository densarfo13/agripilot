/**
 * src/runtime/review/ReviewPage.jsx — Human review queue page.
 *
 * Internal-only surface for reviewers + admins. Renders the
 * pending review queue grouped by REVIEW_TYPES. The canonical
 * /internal/review route in src/App.jsx mounts the existing
 * `src/pages/internal/ReviewPage.jsx` (which is also called
 * <ReviewPage>); this file is the runtime-local view that
 * powers an embedded preview inside the review runtime
 * diagnostics + serves as a fallback if the page-level
 * surface is unavailable.
 *
 * Strict-rule audit
 *   - Pure React. No fetch.
 *   - All data comes through the runtime barrel.
 *   - Renders an empty state for unknown types (fail-closed UI).
 */

import React from 'react';
import {
  REVIEW_TYPES,
  REVIEW_STATUSES,
} from './reviewContracts';
import { listReviews } from './ReviewQueue';

const STYLES = Object.freeze({
  page: {
    minHeight: '100vh',
    background: '#F6F1E7',
    color: '#1F2933',
    padding: '24px 16px 96px',
    maxWidth: 960,
    margin: '0 auto',
  },
  h1: { margin: 0, fontSize: 22, fontWeight: 800 },
  meta: {
    margin: '6px 0 24px',
    fontSize: 12,
    color: 'rgba(31, 41, 51, 0.6)',
  },
  group: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  groupHeader: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
  },
  empty: {
    margin: '12px 0 0',
    fontSize: 13,
    color: 'rgba(31, 41, 51, 0.55)',
  },
  row: {
    padding: '8px 0',
    borderTop: '1px solid rgba(31, 41, 51, 0.08)',
    fontSize: 13,
  },
});

export default function ReviewPage() {
  // listReviews() returns a frozen snapshot; never mutate.
  let items = [];
  try {
    items = (listReviews() || []).slice();
  } catch {
    items = [];
  }

  // Group by type. Unknown types fall through to an "other" bucket
  // but are never rendered — fail-closed UI.
  const byType = new Map();
  for (const t of REVIEW_TYPES) byType.set(t, []);
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const t = item.type;
    if (byType.has(t)) byType.get(t).push(item);
  }

  return (
    <main style={STYLES.page} data-screen="human-review">
      <h1 style={STYLES.h1}>Human review queue</h1>
      <p style={STYLES.meta}>
        Internal-only. Statuses: {REVIEW_STATUSES.join(' · ')}
      </p>

      {REVIEW_TYPES.map((type) => {
        const rows = byType.get(type) || [];
        return (
          <section key={type} style={STYLES.group}>
            <h2 style={STYLES.groupHeader}>{type}</h2>
            {rows.length === 0 ? (
              <p style={STYLES.empty}>No items pending.</p>
            ) : (
              rows.map((row, i) => (
                <div key={row.id || i} style={STYLES.row}>
                  <strong>{row.status || 'pending'}</strong>
                  {' — '}
                  {row.summary || row.id || 'item'}
                </div>
              ))
            )}
          </section>
        );
      })}
    </main>
  );
}
