import React, { useState } from 'react';

/**
 * FarmerAvatar — displays farmer profile photo or initials fallback.
 *
 * Props:
 *   fullName        — farmer's full name (for initials fallback)
 *   profileImageUrl — optional URL to profile image
 *   size            — pixel size (default: 40)
 *   onClick         — optional click handler (e.g., to trigger upload)
 *   editable        — if true, shows camera overlay on hover
 *   style           — additional inline styles
 */

// Deterministic color from name string — consistent across renders
const AVATAR_COLORS = [
  '#22C55E', '#0891B2', '#8B5CF6', '#F59E0B', '#EF4444',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
];

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

export default function FarmerAvatar({ fullName, profileImageUrl, size = 40, onClick, editable = false, style = {} }) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(fullName);
  const color = AVATAR_COLORS[hashName(fullName || '') % AVATAR_COLORS.length];
  const showImage = profileImageUrl && !imgError;
  const fontSize = Math.max(size * 0.38, 10);

  return (
    <div
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: showImage ? '#1E293B' : color,
        color: '#fff', fontWeight: 700, fontSize,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative', overflow: 'hidden',
        letterSpacing: '0.03em', userSelect: 'none',
        ...style,
      }}
      title={fullName || 'Farmer'}
    >
      {showImage ? (
        <img
          src={profileImageUrl}
          alt={`${fullName || 'Farmer'} photo`}
          loading="lazy"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      ) : (
        initials
      )}
      {editable && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s',
          borderRadius: '50%', fontSize: Math.max(size * 0.3, 12),
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}
        >
          {'\uD83D\uDCF7'}
        </div>
      )}
    </div>
  );
}

// Compact avatar for table rows
export function FarmerAvatarSmall({ fullName, profileImageUrl }) {
  return <FarmerAvatar fullName={fullName} profileImageUrl={profileImageUrl} size={32} />;
}
