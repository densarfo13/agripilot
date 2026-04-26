import React, { useState, useRef } from 'react';
import api from '../api/client.js';
import FarmerAvatar from './FarmerAvatar.jsx';
import { compressImage, formatFileSize } from '../utils/imageCompress.js';
import { useStrictTranslation as useTranslation } from '../i18n/useStrictTranslation.js';

/**
 * ProfilePhotoUpload — modal for uploading/updating farmer profile photo.
 *
 * Props:
 *   farmerId        — farmer ID to upload for
 *   fullName        — farmer's name (for avatar preview)
 *   currentImageUrl — current profile image URL (if any)
 *   onClose         — close handler
 *   onUploaded      — callback after successful upload (receives updated farmer data)
 *   selfUpload      — if true, uses /api/farmers/me/profile-photo endpoint
 */
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePhotoUpload({ farmerId, fullName, currentImageUrl, onClose, onUploaded, selfUpload = false }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const inputRef = useRef(null);
  const uploadGuardRef = useRef(false);
  const { t } = useTranslation();

  const handleFile = (e) => {
    setError('');
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setError('Image must be under 5 MB.');
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | uploaded | failed

  const handleUpload = async () => {
    if (!file || uploadGuardRef.current) return;
    uploadGuardRef.current = true;
    setUploading(true);
    setUploadState('uploading');
    setError('');
    try {
      // Compress image before upload (reduces bandwidth on mobile)
      const compressed = await compressImage(file, { maxWidth: 800, quality: 0.8 });
      const formData = new FormData();
      formData.append('photo', compressed);
      const endpoint = selfUpload
        ? '/farmers/me/profile-photo'
        : `/farmers/${farmerId}/profile-photo`;

      // Timeout-protected upload (20s for photo to handle slow connections)
      const uploadPromise = api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('Upload timed out. Please try again.')), 20000)
      );
      const res = await Promise.race([uploadPromise, timeoutPromise]);

      setUploadState('uploaded');
      onUploaded?.(res.data);
      onClose();
    } catch (err) {
      setUploadState('failed');
      // File and preview are preserved — user can retry without re-selecting
      setError(err?.message?.includes('timed out')
        ? err.message
        : (err.response?.data?.error || 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
      uploadGuardRef.current = false;
    }
  };

  const handleRemove = async () => {
    if (uploadGuardRef.current) return;
    uploadGuardRef.current = true;
    setRemoving(true);
    setError('');
    try {
      const endpoint = selfUpload
        ? '/farmers/me/profile-photo'
        : `/farmers/${farmerId}/profile-photo`;
      await api.delete(endpoint);
      onUploaded?.({ profileImageUrl: null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove photo.');
    } finally {
      setRemoving(false);
      uploadGuardRef.current = false;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <span>{t('photo.profilePhoto')}</span>
          <button className="btn btn-outline btn-sm" onClick={onClose}>X</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center' }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
              {error}
            </div>
          )}

          {/* Preview */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            {preview ? (
              <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '3px solid #22C55E' }}>
                <img src={preview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ) : (
              <FarmerAvatar fullName={fullName} profileImageUrl={currentImageUrl} size={120} />
            )}
          </div>

          {/* File input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
              style={{ width: '100%', maxWidth: 260 }}
            >
              {file ? t('photo.chooseDifferent') : currentImageUrl ? t('photo.chooseNew') : t('photo.choosePhoto')}
            </button>

            {file && (
              <div style={{ fontSize: '0.78rem', color: '#A1A1AA' }}>
                {file.name} ({formatFileSize(file.size)})
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
          <div>
            {currentImageUrl && !preview && (
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={handleRemove}
                disabled={removing}
              >
                {removing ? t('photo.removing') : t('photo.removePhoto')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? t('photo.uploading') : t('photo.upload')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
