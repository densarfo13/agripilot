import dotenv from 'dotenv';
dotenv.config();

const TOKEN_URL = 'https://services.sentinel-hub.com/oauth/token';
const STATS_URL = 'https://services.sentinel-hub.com/api/v1/statistics';

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
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

export async function fetchNDVI({ latitude, longitude }) {
  const token = await getAccessToken();

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Invalid latitude or longitude');
  }

  const requestBody = {
    input: {
      bounds: {
        bbox: [
          lon - 0.002,
          lat - 0.002,
          lon + 0.002,
          lat + 0.002,
        ],
        properties: {
          crs: 'http://www.opengis.net/def/crs/EPSG/0/4326',
        },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          dataFilter: {
            maxCloudCoverage: 70,
          },
        },
      ],
    },

    aggregation: {
      timeRange: {
        from: dateDaysAgo(30),
        to: new Date().toISOString(),
      },
      aggregationInterval: {
        of: 'P30D',
      },
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

    calculations: {
      default: {},
    },
  };

  const res = await fetch(STATS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

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

