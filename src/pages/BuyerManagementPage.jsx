import { useEffect, useState, useCallback } from 'react';
import { getBuyers, createBuyer, updateBuyer } from '../lib/api.js';

export default function BuyerManagementPage() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // buyer object or null
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  function emptyForm() {
    return { buyerName: '', companyName: '', contactName: '', phone: '', email: '', cropsInterested: '', regionsCovered: '', notes: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBuyers({ search: search || undefined });
      setBuyers(data.buyers || []);
    } catch (err) {
      setError(err.message || 'Failed to load buyers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const handleNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const handleEdit = (buyer) => {
    setEditing(buyer);
    setForm({
      buyerName: buyer.buyerName || '',
      companyName: buyer.companyName || '',
      contactName: buyer.contactName || '',
      phone: buyer.phone || '',
      email: buyer.email || '',
      cropsInterested: buyer.cropsInterested || '',
      regionsCovered: buyer.regionsCovered || '',
      notes: buyer.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.buyerName.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateBuyer(editing.id, form);
      } else {
        await createBuyer(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm());
  };

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Buyer Management</h1>
        <button style={S.primaryBtn} onClick={handleNew}>+ New Buyer</button>
      </div>

      {/* Search */}
      <div style={S.searchRow}>
        <input
          style={S.searchInput}
          type="text"
          placeholder="Search buyers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* Create/Edit Form */}
      {showForm && (
        <div style={S.formCard}>
          <h2 style={S.formTitle}>{editing ? 'Edit Buyer' : 'New Buyer'}</h2>
          <div style={S.formGrid}>
            <div style={S.field}>
              <label style={S.label}>Buyer Name *</label>
              <input style={S.input} value={form.buyerName} onChange={(e) => setField('buyerName', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Company</label>
              <input style={S.input} value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Contact Name</label>
              <input style={S.input} value={form.contactName} onChange={(e) => setField('contactName', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Phone</label>
              <input style={S.input} value={form.phone} onChange={(e) => setField('phone', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} />
            </div>
            <div style={S.field}>
              <label style={S.label}>Crops Interested</label>
              <input style={S.input} value={form.cropsInterested} onChange={(e) => setField('cropsInterested', e.target.value)} placeholder="maize, rice, cocoa" />
            </div>
            <div style={S.field}>
              <label style={S.label}>Regions Covered</label>
              <input style={S.input} value={form.regionsCovered} onChange={(e) => setField('regionsCovered', e.target.value)} placeholder="Northern, Ashanti" />
            </div>
            <div style={{ ...S.field, gridColumn: '1 / -1' }}>
              <label style={S.label}>Notes</label>
              <textarea style={{ ...S.input, minHeight: '60px', resize: 'vertical' }} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
            </div>
          </div>
          <div style={S.formActions}>
            <button style={S.cancelBtn} onClick={handleCancel}>Cancel</button>
            <button style={S.primaryBtn} onClick={handleSave} disabled={saving || !form.buyerName.trim()}>
              {saving ? 'Saving...' : (editing ? 'Update' : 'Create')}
            </button>
          </div>
        </div>
      )}

      {/* Buyer List */}
      {loading && <div style={S.loading}>Loading...</div>}
      {!loading && buyers.length === 0 && <div style={S.empty}>No buyers yet. Click "+ New Buyer" to add one.</div>}

      {!loading && buyers.length > 0 && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Name</th>
                <th style={S.th}>Company</th>
                <th style={S.th}>Contact</th>
                <th style={S.th}>Crops</th>
                <th style={S.th}>Regions</th>
                <th style={S.th}>Links</th>
                <th style={S.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map((b) => (
                <tr key={b.id} style={S.tr}>
                  <td style={S.td}>
                    <div style={S.buyerName}>{b.buyerName}</div>
                    {b.phone && <div style={S.meta}>{b.phone}</div>}
                  </td>
                  <td style={S.td}>{b.companyName || '-'}</td>
                  <td style={S.td}>
                    {b.contactName || '-'}
                    {b.email && <div style={S.meta}>{b.email}</div>}
                  </td>
                  <td style={S.td}>{b.cropsInterested || '-'}</td>
                  <td style={S.td}>{b.regionsCovered || '-'}</td>
                  <td style={S.td}>{b.buyerLinks?.length || 0}</td>
                  <td style={S.td}>
                    <button style={S.editBtn} onClick={() => handleEdit(b)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { padding: '1.5rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' },
  title: { fontSize: '1.5rem', fontWeight: 700, margin: 0 },
  primaryBtn: {
    padding: '8px 16px', borderRadius: '8px', border: 'none',
    background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 500,
  },
  searchRow: { marginBottom: '1rem' },
  searchInput: { padding: '8px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', maxWidth: '320px', boxSizing: 'border-box' },
  error: { color: '#dc2626', fontSize: '14px', marginBottom: '1rem' },
  loading: { color: '#6b7280', fontSize: '14px' },
  empty: { color: '#9ca3af', fontSize: '14px', padding: '2rem', textAlign: 'center' },
  formCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px',
    padding: '1.25rem', marginBottom: '1.5rem',
  },
  formTitle: { fontSize: '1.125rem', fontWeight: 600, margin: '0 0 1rem' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  field: {},
  label: { display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '4px' },
  input: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', boxSizing: 'border-box' },
  formActions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '1rem' },
  cancelBtn: { padding: '8px 16px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: '14px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  buyerName: { fontWeight: 500 },
  meta: { fontSize: '12px', color: '#9ca3af' },
  editBtn: {
    padding: '4px 12px', borderRadius: '6px', border: '1px solid #d1d5db',
    background: '#fff', cursor: 'pointer', fontSize: '13px',
  },
};
