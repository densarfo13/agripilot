import dotenv from 'dotenv';
dotenv.config();

const TOKEN_URL = 'https://services.sentinel-hub.com/oauth/token';
const STATS_URL = 'https://services.sentinel-hub.com/api/v1/statistics';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Force the next getAccessToken() to fetch a fresh token. Public so the
 * scan pipeline (or a retry path) can recover from a server-side token
 * revocation, and so tests can reset the module-level cache deterministically.
 */
export function invalidateToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    // Invalid/absent CREDENTIALS — never retryable (a fresh token won't help).
    throw new Error('Missing Sentinel Hub OAuth credentials');
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const json = await res.json();

  if (!res.ok) {
    console.error('[Sentinel Auth Error]', json);
    throw new Error('Failed to authenticate Sentinel Hub');
  }

  cachedToken = json.access_token;
  tokenExpiresAt = Date.now() + ((json.expires_in - 60) * 1000);

  return cachedToken;
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Statistical-API request body for a 30-day mean NDVI over a small box
// centred on the point. Extracted so the request is built once and reused
// across the auth-retry attempt (identical payload, fresh token only).
function _buildNdviStatsBody(lat, lon) {
  return {
    input: {
      bounds: {
        bbox: [lon - 0.002, lat - 0.002, lon + 0.002, lat + 0.002],
        properties: {
          crs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
        },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: { maxCloudCoverage: 70 },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: dateDaysAgo(30),
        to: new Date().toISOString(),
      },
      aggregationInterval: { of: 'P30D' },
      evalscript: `
        //VERSION=3
        function setup() {
          return {
            input: ["B04", "B08", "dataMask"],
            output: [
              { id: "default", bands: 1, sampleType: "FLOAT32" },
              { id: "dataMask", bands: 1 }
            ]
          };
        }

        function evaluatePixel(sample) {
          let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
          return {
            default: [ndvi],
            dataMask: [sample.dataMask]
          };
        }
      `,
    },
    calculations: { default: {} },
  };
}

function _postStats(token, body) {
  return fetch(STATS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function fetchNDVI({ latitude, longitude }) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  // Validate BEFORE spending an OAuth call — fail fast, explainable.
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid latitude or longitude');
  }

  const requestBody = _buildNdviStatsBody(lat, lon);

  let token = await getAccessToken();
  let res = await _postStats(token, requestBody);

  // AUTH — retry ONCE on an expired/revoked token. A cached token can outlive
  // its server-side validity (clock skew / revocation), surfacing as a 401.
  // Invalidate + refetch exactly once. Invalid CREDENTIALS still fail fast
  // (getAccessToken throws), so this never loops on a permanent auth failure.
  if (res.status === 401) {
    invalidateToken();
    token = await getAccessToken();
    res = await _postStats(token, requestBody);
  }

  const json = await res.json();

  if (!res.ok) {
    console.error('[Sentinel Stats Error]', json);
    throw new Error('Sentinel NDVI request failed');
  }

  const mean =
    json?.data?.[0]?.outputs?.default?.bands?.B0?.stats?.mean ?? null;

  return {
    data: Number.isFinite(mean) ? [mean] : [],
    raw: json,
  };
}
