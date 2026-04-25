/**
 * LoginPage — DEPRECATED (P5.14)
 *
 * The legacy V1 login screen (Bearer-token auth, in-app session
 * store) was kept around so older bookmarks / SSO popup callbacks
 * pointing at `/v1/login` wouldn't 404 during the cookie-auth
 * migration. The canonical login is now `/login` (V2Login —
 * cookie-based, httpOnly, CSRF-aware, MFA-aware).
 *
 * This file is now a thin redirect. It exists only so the route
 * `/v1/login` keeps resolving to a valid component; any client
 * landing here is bounced to the canonical route while preserving
 * the original `?next=` query param if present.
 *
 * Removal plan: once analytics show zero `/v1/login` hits for a
 * full week, delete this file + the route in App.jsx.
 *
 * If you need to edit login behaviour, edit `src/pages/auth/V2Login.jsx`
 * — NOT this file.
 */

import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function LoginPage() {
  const location = useLocation();

  // Surface the deprecation in dev so a regression that re-routes
  // anything to /v1/login is loud in the console.
  useEffect(() => {
    if (typeof console !== 'undefined') {
      console.warn(
        '[LoginPage] /v1/login is deprecated — redirecting to /login. '
        + 'Update any bookmarks or SSO redirect URIs.'
      );
    }
  }, []);

  // Preserve the original query string (?next=, ?error=, MFA token, …).
  const target = `/login${location.search || ''}${location.hash || ''}`;
  return <Navigate to={target} replace />;
}
