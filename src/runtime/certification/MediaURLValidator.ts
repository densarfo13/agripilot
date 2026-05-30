// Farroway Production Certification — Media URL Validator
// Pure structural validator. Never makes HTTP requests.

export const MEDIA_URL_VALIDATOR_VERSION =
  "farroway-media-url-validator-v1";

const _isObj = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object";
const _arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const _str = (v: unknown): string => (typeof v === "string" ? v : "");
const _safe = <T>(fn: () => T, fb: T): T => {
  try {
    return fn();
  } catch {
    return fb;
  }
};

export interface MediaURLShapeResult {
  readonly ok: boolean;
  readonly reason: string;
}

export interface MediaCatalogEntry {
  readonly url?: unknown;
}

export interface MediaCatalogValidationResult {
  readonly total: number;
  readonly valid: number;
  readonly broken: ReadonlyArray<{ readonly index: number; readonly url: string; readonly reason: string }>;
  readonly reason: string;
}

const _frozen = <T>(v: T): T => Object.freeze(v) as T;

const _isPlaceholderToken = (raw: string): boolean => {
  const lower = raw.toLowerCase();
  if (lower === "") return true;
  if (lower.includes("placeholder")) return true;
  if (lower.includes("todo")) return true;
  return false;
};

const _isAcceptedDataURI = (raw: string): boolean => {
  // Only svg+xml data URIs are tolerated (placeholders); other data URIs are rejected.
  return /^data:image\/svg\+xml/i.test(raw);
};

const _isHttpURL = (raw: string): boolean => /^https?:\/\//i.test(raw);

const _isRelativeRealism = (raw: string): boolean => /^\/realism\//.test(raw);

const _isCloudinary = (raw: string): boolean =>
  /^https?:\/\/([a-z0-9-]+\.)?(res\.)?cloudinary\.com\//i.test(raw);

export function validateMediaURLShape(url: unknown): MediaURLShapeResult {
  return _safe<MediaURLShapeResult>(() => {
    const raw = _str(url);
    if (raw === "") {
      return _frozen({ ok: false, reason: "empty url" });
    }
    if (_isPlaceholderToken(raw)) {
      return _frozen({ ok: false, reason: "placeholder/TODO token" });
    }
    if (raw.toLowerCase().startsWith("data:")) {
      if (_isAcceptedDataURI(raw)) {
        return _frozen({ ok: true, reason: "svg placeholder data URI" });
      }
      return _frozen({ ok: false, reason: "rejected data URI" });
    }
    if (_isRelativeRealism(raw)) {
      return _frozen({ ok: true, reason: "relative realism path" });
    }
    if (_isCloudinary(raw)) {
      return _frozen({ ok: true, reason: "cloudinary url" });
    }
    if (_isHttpURL(raw)) {
      return _frozen({ ok: true, reason: "http(s) url" });
    }
    return _frozen({ ok: false, reason: "no http(s) scheme" });
  }, _frozen({ ok: false, reason: "validator threw" }));
}

export function validateMediaCatalog(
  media: unknown,
): MediaCatalogValidationResult {
  return _safe<MediaCatalogValidationResult>(() => {
    const list = _arr<MediaCatalogEntry>(media);
    const total = list.length;
    if (total === 0) {
      return _frozen({
        total: 0,
        valid: 0,
        broken: _frozen([]),
        reason: "Not enough data yet",
      });
    }
    let valid = 0;
    const broken: Array<{ index: number; url: string; reason: string }> = [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      const url = _isObj(entry) ? _str((entry as Record<string, unknown>).url) : "";
      const result = validateMediaURLShape(url);
      if (result.ok) {
        valid += 1;
      } else {
        broken.push(
          Object.freeze({
            index: i,
            url,
            reason: result.reason,
          }) as { index: number; url: string; reason: string },
        );
      }
    }
    return _frozen({
      total,
      valid,
      broken: _frozen(broken.slice()),
      reason: broken.length === 0 ? "all urls structurally valid" : "broken urls present",
    });
  }, _frozen({
    total: 0,
    valid: 0,
    broken: _frozen([]),
    reason: "validator threw",
  }));
}

export interface MediaValidatorSnapshot {
  readonly runtimeVersion: string;
  readonly validatorReady: true;
}

export function mediaValidatorSnapshot(): MediaValidatorSnapshot {
  return _safe<MediaValidatorSnapshot>(
    () =>
      _frozen({
        runtimeVersion: MEDIA_URL_VALIDATOR_VERSION,
        validatorReady: true as const,
      }),
    _frozen({
      runtimeVersion: MEDIA_URL_VALIDATOR_VERSION,
      validatorReady: true as const,
    }),
  );
}
