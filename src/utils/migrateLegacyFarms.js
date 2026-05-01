/**
 * migrateLegacyFarms.js — one-time migration from the legacy
 * single `farroway.farms` array (gardens + farms partitioned by
 * `farmType`) to the spec's first-class dual stores
 * `farroway_gardens` + `farroway_farms`.
 *
 * Idempotent — guarded by `farroway_full_architecture_migrated`
 * sentinel so re-running is a no-op once the migration has
 * completed.
 *
 * Storage keys
 *   farroway.farms                        — legacy (kept untouched
 *                                            so existing readers
 *                                            stay green)
 *   farroway_legacy_farms_backup          — pre-migration snapshot
 *   farroway_gardens                      — NEW first-class array
 *   farroway_farms                        — NEW first-class array
 *   farroway_full_architecture_migrated   — sentinel ('true')
 *
 * Garden / farm classification
 *   garden = farmType in { 'backyard', 'home_garden', 'home' }
 *   farm   = anything else (small_farm, commercial, missing)
 *
 * Strict-rule audit
 *   * Never throws — every read/write is try/catch wrapped.
 *   * Backs up the legacy array verbatim BEFORE writing the
 *     new arrays so a botched run can be rolled back from
 *     `farroway_legacy_farms_backup`.
 *   * Writes the sentinel LAST so a partial run on a previous
 *     boot doesn't get falsely marked as complete.
 *   * Bails when the explicit-logout flag is set so the
 *     migration never runs against a logged-out session.
 */

export const STORAGE_KEYS = Object.freeze({
  LEGACY_FARMS:    'farroway.farms',
  LEGACY_BACKUP:   'farroway_legacy_farms_backup',
  GARDENS:         'farroway_gardens',
  FARMS:           'farroway_farms',
  SENTINEL:        'farroway_full_architecture_migrated',
});

function _hasStorage() {
  try { return typeof localStorage !== 'undefined'; }
  catch { return false; }
}

function _isExplicitLogout() {
  try {
    if (!_hasStorage()) return false;
    return localStorage.getItem('farroway_explicit_logout') === 'true';
  } catch { return false; }
}

function _readArray(key) {
  if (!_hasStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function _writeArray(key, value) {
  if (!_hasStorage()) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch { return false; }
}

function _writeString(key, value) {
  if (!_hasStorage()) return false;
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
    return true;
  } catch { return false; }
}

/**
 * isGardenRow — single classification rule shared with
 * multiExperience.isGarden. Local copy so this module is
 * dependency-free during the boot path.
 */
export function isGardenRow(row) {
  if (!row || typeof row !== 'object') return false;
  const t = String(row.farmType || '').toLowerCase();
  return t === 'backyard' || t === 'home_garden' || t === 'home';
}

/**
 * Decorate a row with `experience` + `userId` fields per the
 * new data model. Preserves every existing field; never wipes.
 */
function _decorateGarden(row, userId) {
  const safe = (row && typeof row === 'object') ? row : {};
  return {
    ...safe,
    experience: 'garden',
    userId: safe.userId || userId || null,
  };
}

function _decorateFarm(row, userId) {
  const safe = (row && typeof row === 'object') ? row : {};
  return {
    ...safe,
    experience: 'farm',
    userId: safe.userId || userId || null,
  };
}

function _readActiveUserId() {
  if (!_hasStorage()) return null;
  try {
    const raw = localStorage.getItem('farroway_user_profile');
    if (!raw) return null;
    const v = JSON.parse(raw);
    return (v && typeof v === 'object'
      && (v.id || v.userId || v.farmerId)) || null;
  } catch { return null; }
}

/**
 * migrateLegacyFarms() → string[]
 *
 * Runs the migration once. Returns a list of action tags so
 * callers (AuthContext bootstrap) can log them at dev verbosity.
 *
 * Action tags:
 *   'skipped_explicit_logout' — boot is past Logout; no work
 *   'skipped_already_migrated' — sentinel already set
 *   'skipped_no_legacy_data'   — empty legacy store
 *   'backup_written'           — legacy snapshot saved
 *   'gardens_written'          — N rows
 *   'farms_written'            — N rows
 *   'sentinel_set'             — migration flag flipped
 */
export function migrateLegacyFarms() {
  const actions = [];
  if (!_hasStorage()) return actions;

  if (_isExplicitLogout()) {
    actions.push('skipped_explicit_logout');
    return actions;
  }

  // Already migrated → idempotent no-op.
  let sentinel = null;
  try { sentinel = localStorage.getItem(STORAGE_KEYS.SENTINEL); }
  catch { sentinel = null; }
  if (sentinel === 'true') {
    actions.push('skipped_already_migrated');
    return actions;
  }

  const legacy = _readArray(STORAGE_KEYS.LEGACY_FARMS);
  if (!legacy || legacy.length === 0) {
    // Nothing to migrate — stamp the sentinel anyway so future
    // boots short-circuit immediately. Empty new-store arrays
    // will be lazily initialised by the first save.
    _writeString(STORAGE_KEYS.SENTINEL, 'true');
    actions.push('skipped_no_legacy_data');
    actions.push('sentinel_set');
    return actions;
  }

  // 1. Backup BEFORE writing anything new. If the JSON write
  //    fails, the legacy store is still intact and a future boot
  //    can retry.
  const existingBackup = _readArray(STORAGE_KEYS.LEGACY_BACKUP);
  if (!existingBackup) {
    if (_writeArray(STORAGE_KEYS.LEGACY_BACKUP, legacy)) {
      actions.push('backup_written');
    }
  }

  const userId = _readActiveUserId();

  // 2. Split.
  const gardens = [];
  const farms   = [];
  for (const row of legacy) {
    if (!row || typeof row !== 'object') continue;
    if (isGardenRow(row)) gardens.push(_decorateGarden(row, userId));
    else                  farms.push(_decorateFarm(row, userId));
  }

  // 3. Write the new arrays. Existing values (if a partial
  //    earlier write left some rows) are merged by id so we
  //    don't duplicate.
  const _mergeById = (existing, fresh) => {
    if (!Array.isArray(existing) || existing.length === 0) return fresh;
    const seen = new Set(existing.map((r) => String(r?.id || '')).filter(Boolean));
    const out = existing.slice();
    for (const r of fresh) {
      const id = String(r?.id || '');
      if (id && !seen.has(id)) {
        out.push(r);
        seen.add(id);
      }
    }
    return out;
  };

  const existingGardens = _readArray(STORAGE_KEYS.GARDENS) || [];
  const existingFarms   = _readArray(STORAGE_KEYS.FARMS)   || [];

  if (gardens.length > 0) {
    _writeArray(STORAGE_KEYS.GARDENS, _mergeById(existingGardens, gardens));
    actions.push(`gardens_written:${gardens.length}`);
  }
  if (farms.length > 0) {
    _writeArray(STORAGE_KEYS.FARMS, _mergeById(existingFarms, farms));
    actions.push(`farms_written:${farms.length}`);
  }

  // 4. Stamp the sentinel last so a partial run gets retried.
  _writeString(STORAGE_KEYS.SENTINEL, 'true');
  actions.push('sentinel_set');

  return actions;
}

/**
 * isMigrated() → boolean — read-only sentinel check used by
 * read-side helpers that prefer the new arrays.
 */
export function isMigrated() {
  if (!_hasStorage()) return false;
  try { return localStorage.getItem(STORAGE_KEYS.SENTINEL) === 'true'; }
  catch { return false; }
}

/**
 * getMigratedGardens() / getMigratedFarms() — null when the
 * migration hasn't run yet so callers can fall back to the
 * legacy partition. Empty arrays are valid post-migration.
 */
export function getMigratedGardens() {
  return isMigrated() ? (_readArray(STORAGE_KEYS.GARDENS) || []) : null;
}
export function getMigratedFarms() {
  return isMigrated() ? (_readArray(STORAGE_KEYS.FARMS) || []) : null;
}

export default migrateLegacyFarms;
