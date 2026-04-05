import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client.js';
import StatusBadge from '../components/StatusBadge.jsx';

export default function FarmerDetailPage() {
  const { id } = useParams();
  const [farmer, setFarmer] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/farmers/${id}`).then(r => setFarmer(r.data)).catch(() => navigate('/farmers')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading farmer...</div>;
  if (!farmer) return null;

  return (
    <>
      <div className="page-header">
        <h1>{farmer.fullName}</h1>
        <div className="flex gap-1">
          <button className="btn btn-primary" onClick={() => navigate(`/farmer-home/${id}`)}>Farmer Home</button>
          <button className="btn btn-outline" onClick={() => navigate('/farmers')}>Back to Farmers</button>
        </div>
      </div>
      <div className="page-body">
        <div className="detail-grid">
          <div className="card">
            <div className="card-header">Farmer Information</div>
            <div className="card-body">
              <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{farmer.phone}</span></div>
              <div className="detail-row"><span className="detail-label">National ID</span><span className="detail-value">{farmer.nationalId || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Region</span><span className="detail-value">{farmer.region}</span></div>
              <div className="detail-row"><span className="detail-label">District</span><span className="detail-value">{farmer.district || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Village</span><span className="detail-value">{farmer.village || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Primary Crop</span><span className="detail-value">{farmer.primaryCrop || '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Farm Size</span><span className="detail-value">{farmer.farmSizeAcres ? `${farmer.farmSizeAcres} acres` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Experience</span><span className="detail-value">{farmer.yearsExperience ? `${farmer.yearsExperience} years` : '-'}</span></div>
              <div className="detail-row"><span className="detail-label">Created By</span><span className="detail-value">{farmer.createdBy?.fullName}</span></div>
              <div className="detail-row"><span className="detail-label">Created At</span><span className="detail-value">{new Date(farmer.createdAt).toLocaleDateString()}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              Applications ({farmer.applications?.length || 0})
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/applications/new?farmerId=${farmer.id}`)}>+ New Application</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr><th>Crop</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {farmer.applications?.map(app => (
                    <tr key={app.id} onClick={() => navigate(`/applications/${app.id}`)} style={{ cursor: 'pointer' }}>
                      <td>{app.cropType}</td>
                      <td>{app.currencyCode || 'KES'} {app.requestedAmount?.toLocaleString()}</td>
                      <td><StatusBadge value={app.status} /></td>
                      <td className="text-sm text-muted">{new Date(app.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!farmer.applications || farmer.applications.length === 0) && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>No applications yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
