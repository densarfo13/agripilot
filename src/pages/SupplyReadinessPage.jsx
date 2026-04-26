import { useEffect, useState, useCallback } from 'react';
import {
  getAdminSupplyList, exportSupplyCSV,
  getBuyers, createBuyer, createBuyerLink, updateBuyerLink,
  exportBuyerLinksCSV,
} from '../lib/api.js';
import { getCropLabel } from '../utils/crops.js';
import { useTranslation } from '../i18n/index.js';

const LINK_STATUSES = ['buyer_linked', 'buyer_contacted', 'in_discussion', 'matched', 'closed', 'cancelled'];

function statusLabel(s) {
  return (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SupplyReadinessPage() {
  const { lang } = useTranslation();
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readyOnly, setReadyOnly] = useState(false);
  const [cropFilter, setCropFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Link buyer modal state
  const [linkTarget, setLinkTarget] = useState(null); // supply record being linked
  const [buyers, setBuyers] = useState([]);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [linkNotes, setLinkNotes] = useState('');
  const [linking, setLinking] = useState(false);

  // Inline new buyer form (within link modal)
  const [showNewBuyer, setShowNewBuyer] = useState(false);
  const [newBuyer, setNewBuyer] = useState({ buyerName: '', companyName: '', phone: '', email: '' });
  const [creatingBuyer, setCreatingBuyer] = useState(false);

  // Status update
  const [updatingLink, setUpdatingLink] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (readyOnly) params.readyOnly = true;
      if (cropFilter) params.crop = cropFilter;
      const data = await getAdminSupplyList(params);
      let supply = data.supply || [];
      if (statusFilter) {
        supply = supply.filter((r) => {
          if (statusFilter === 'linked') return r.buyerLinks?.length > 0;
          if (statusFilter === 'unlinked') return !r.buyerLinks?.length;
          return true;
        });
      }
      setRecords(supply);
      setTotal(supply.length);
    } catch (err) {
      setError(err.message || 'Failed to load supply list');
    } finally {
      setLoading(false);
    }
  }, [readyOnly, cropFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ─── Export handlers ─────────────────────────────────
  const handleExportSupply = async () => {
    try {
      const res = await exportSupplyCSV({ readyOnly });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'supply-readiness.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message || 'Export failed'); }
  };

  const handleExportLinks = async () => {
    try {
      const res = await exportBuyerLinksCSV({});
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'buyer-links.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err.message || 'Export failed'); }
  };

  // ─── Link buyer modal ───────────────────────────────
  const openLinkModal = async (record) => {
    setLinkTarget(record);
    setSelectedBuyerId('');
    setLinkNotes('');
    setShowNewBuyer(false);
    setNewBuyer({ buyerName: '', companyName: '', phone: '', email: '' });
    setBuyersLoading(true);
    try {
      const data = await getBuyers({});
      setBuyers(data.buyers || []);
    } catch { setBuyers([]); }
    finally { setBuyersLoading(false); }
  };

  const closeLinkModal = () => {
    setLinkTarget(null);
  };

  const handleCreateAndSelect = async () => {
    if (!newBuyer.buyerName.trim()) return;
    setCreatingBuyer(true);
    try {
      const data = await createBuyer(newBuyer);
      setBuyers((prev) => [data.buyer, ...prev]);
      setSelectedBuyerId(data.buyer.id);
      setShowNewBuyer(false);
      setNewBuyer({ buyerName: '', companyName: '', phone: '', email: '' });
    } catch (err) { alert(err.message || 'Failed to create buyer'); }
    finally { setCreatingBuyer(false); }
  };

  const handleLink = async () => {
    if (!selectedBuyerId || !linkTarget) return;
    setLinking(true);
    try {
      await createBuyerLink({ supplyId: linkTarget.id, buyerId: selectedBuyerId, notes: linkNotes || undefined });
      closeLinkModal();
      await load();
    } catch (err) { alert(err.message || 'Failed to link buyer'); }
    finally { setLinking(false); }
  };

  // ─── Status update ──────────────────────────────────
  const handleStatusChange = async (linkId, newStatus) => {
    setUpdatingLink(linkId);
    try {
      await updateBuyerLink(linkId, { status: newStatus });
      await load();
    } catch (err) { alert(err.message || 'Failed to update status'); }
    finally { setUpdatingLink(null); }
  };

  const trustColor = (level) => {
    if (level === 'high') return { bg: '#dcfce7', fg: '#166534' };
    if (level === 'good') return { bg: '#dbeafe', fg: '#1e40af' };
    if (level === 'medium') return { bg: '#fef3c7', fg: '#92400e' };
    return { bg: '#f3f4f6', fg: '#6b7280' };
  };

  const uniqueCrops = [...new Set(records.map((r) => r.crop).filter(Boolean))];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Supply Readiness</h1>
        <div style={S.actions}>
          <button style={S.exportBtn} onClick={handleExportSupply}>Export Supply CSV</button>
          <button style={S.exportBtn} onClick={handleExportLinks}>Export Links CSV</button>
        </div>
      </div>

      {/* Filters */}
      <div style={S.filters}>
        <label style={S.filterLabel}>
          <input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} />
          Ready only
        </label>
        <select style={S.filterSelect} value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}>
          <option value="">All crops</option>
          {uniqueCrops.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={S.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="linked">Has buyer link</option>
          <option value="unlinked">No buyer link</option>
        </select>
        <span style={S.totalLabel}>{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      {error && <div style={S.error}>{error}</div>}
      {loading && <div style={S.loading}>Loading...</div>}
      {!loading && records.length === 0 && <div style={S.empty}>No supply readiness records found.</div>}

      {/* Table */}
      {!loading && records.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Farmer</th>
                <th style={S.th}>Crop</th>
                <th style={S.th}>Qty</th>
                <th style={S.th}>Harvest</th>
                <th style={S.th}>Price</th>
                <th style={S.th}>Trust</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Buyer</th>
                <th style={S.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const tc = trustColor(r.trust?.level);
                const latestLink = r.buyerLinks?.[0];
                return (
                  <tr key={r.id} style={S.tr}>
                    <td style={S.td}>
                      <div style={S.farmerName}>{r.farmer?.name || 'Unknown'}</div>
                      <div style={S.farmerMeta}>
                        {r.farmer?.uuid && <span style={S.uuidTag}>{r.farmer.uuid.slice(0, 8)}</span>}
                        {r.farmer?.location || ''}{r.farmer?.country ? `, ${r.farmer.country}` : ''}
                      </div>
                    </td>
                    <td style={S.td}>{getCropLabel(r.crop, lang) || r.crop}</td>
                    <td style={S.td}>{r.estimatedQuantity != null ? `${r.estimatedQuantity} ${r.quantityUnit}` : '-'}</td>
                    <td style={S.td}>{r.expectedHarvestDate ? new Date(r.expectedHarvestDate).toLocaleDateString() : '-'}</td>
                    <td style={S.td}>{r.priceExpectation != null ? `${r.priceExpectation} ${r.currency}` : '-'}</td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: tc.bg, color: tc.fg }}>{r.trust?.label}</span>
                    </td>
                    <td style={S.td}>
                      <span style={S.statusPill(r.status)}>{r.status}</span>
                    </td>
                    <td style={S.td}>
                      {latestLink ? (
                        <div>
                          <div style={S.buyerNameCell}>{latestLink.buyerName}</div>
                          <div style={S.buyerCompany}>{latestLink.buyerCompany || ''}</div>
                          <select
                            style={S.statusSelect}
                            value={latestLink.status}
                            onChange={(e) => handleStatusChange(latestLink.id, e.target.value)}
                            disabled={updatingLink === latestLink.id}
                          >
                            {LINK_STATUSES.map((st) => (
                              <option key={st} value={st}>{statusLabel(st)}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <span style={S.noBuyer}>-</span>
                      )}
                    </td>
                    <td style={S.td}>
                      {r.readyToSell && (
                        <button style={S.linkBtn} onClick={() => openLinkModal(r)}>
                          {latestLink ? '+ Link' : 'Link Buyer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Link Buyer Modal */}
      {linkTarget && (
        <div style={S.overlay} onClick={closeLinkModal}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={S.modalTitle}>Link Buyer</h2>
            <div style={S.modalInfo}>
              <strong>{linkTarget.farmer?.name}</strong> — {getCropLabel(linkTarget.crop, lang) || linkTarget.crop}
              {linkTarget.estimatedQuantity != null && ` — ${linkTarget.estimatedQuantity} ${linkTarget.quantityUnit}`}
            </div>

            {buyersLoading ? (
              <div style={S.loading}>Loading buyers...</div>
            ) : (
              <>
                <label style={S.label}>Select Buyer</label>
                <select style={S.modalSelect} value={selectedBuyerId} onChange={(e) => setSelectedBuyerId(e.target.value)}>
                  <option value="">-- Choose buyer --</option>
                  {buyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.buyerName}{b.companyName ? ` (${b.companyName})` : ''}
                    </option>
                  ))}
                </select>

                <button style={S.textBtn} onClick={() => setShowNewBuyer(!showNewBuyer)}>
                  {showNewBuyer ? 'Cancel new buyer' : '+ Create new buyer'}
                </button>

                {showNewBuyer && (
                  <div style={S.newBuyerForm}>
                    <input style={S.modalInput} placeholder="Buyer name *" value={newBuyer.buyerName} onChange={(e) => setNewBuyer((p) => ({ ...p, buyerName: e.target.value }))} />
                    <input style={S.modalInput} placeholder="Company" value={newBuyer.companyName} onChange={(e) => setNewBuyer((p) => ({ ...p, companyName: e.target.value }))} />
                    <input style={S.modalInput} placeholder="Phone" value={newBuyer.phone} onChange={(e) => setNewBuyer((p) => ({ ...p, phone: e.target.value }))} />
                    <input style={S.modalInput} placeholder="Email" value={newBuyer.email} onChange={(e) => setNewBuyer((p) => ({ ...p, email: e.target.value }))} />
                    <button style={S.primaryBtn} onClick={handleCreateAndSelect} disabled={creatingBuyer || !newBuyer.buyerName.trim()}>
                      {creatingBuyer ? 'Creating...' : 'Create & Select'}
                    </button>
                  </div>
                )}

                <label style={{ ...S.label, marginTop: '12px' }}>Notes (optional)</label>
                <textarea style={{ ...S.modalInput, minHeight: '50px', resize: 'vertical' }} value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} />

                <div style={S.modalActions}>
                  <button style={S.cancelBtn} onClick={closeLinkModal}>Cancel</button>
                  <button style={S.primaryBtn} onClick={handleLink} disabled={linking || !selectedBuyerId}>
                    {linking ? 'Linking...' : 'Link Buyer'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  actions: { display: 'flex', gap: '0.5rem' },
  exportBtn: {
    padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
  },
  filters: { display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' },
  filterLabel: { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '14px' },
  filterSelect: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' },
  totalLabel: { fontSize: '13px', color: '#6b7280' },
  error: { color: '#dc2626', fontSize: '14px', marginBottom: '1rem' },
  loading: { color: '#6b7280', fontSize: '14px' },
  empty: { color: '#9ca3af', fontSize: '14px', padding: '2rem', textAlign: 'center' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  farmerName: { fontWeight: 500 },
  farmerMeta: { fontSize: '12px', color: '#9ca3af' },
  uuidTag: { display: 'inline-block', background: '#f3f4f6', borderRadius: '4px', padding: '1px 4px', fontSize: '11px', fontFamily: 'monospace', marginRight: '4px' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 600 },
  statusPill: (status) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '12px', fontWeight: 500,
    background: status === 'connected' ? '#dbeafe' : status === 'active' ? '#dcfce7' : '#f3f4f6',
    color: status === 'connected' ? '#1e40af' : status === 'active' ? '#166534' : '#6b7280',
  }),
  buyerNameCell: { fontWeight: 500, fontSize: '13px' },
  buyerCompany: { fontSize: '11px', color: '#9ca3af' },
  statusSelect: { fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid #d1d5db', marginTop: '2px' },
  noBuyer: { color: '#d1d5db' },
  linkBtn: {
    padding: '6px 14px', borderRadius: '6px', border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
  },
  // Modal
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '100%',
    maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
  },
  modalTitle: { fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' },
  modalInfo: { fontSize: '14px', color: '#374151', marginBottom: '1rem', padding: '8px', background: '#f9fafb', borderRadius: '8px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' },
  modalSelect: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  modalInput: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box', marginBottom: '6px' },
  textBtn: { background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '13px', padding: '6px 0', textDecoration: 'underline' },
  newBuyerForm: { background: '#f9fafb', borderRadius: '8px', padding: '10px', marginTop: '6px', marginBottom: '6px' },
  primaryBtn: {
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
  },
  cancelBtn: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '14px' },
  modalActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' },
};
