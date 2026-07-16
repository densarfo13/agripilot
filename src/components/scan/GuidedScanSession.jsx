/**
 * GuidedScanSession.jsx — the guided multi-view diagnostic UI (PR-C).
 *
 * Consumes the live scan-session API. The SERVER is the single source of truth:
 * this component renders `state`, `photoProgress`, `nextView`, `identification`,
 * `health`, and `allowedActions` verbatim and NEVER derives them (no confidence
 * inspection, no client-side next-view choice). One active card, mobile-first,
 * safe-area aware. Feature-flag gated so it ships without touching the working
 * single-photo flow. Reuses registered result/health strings; the next-view
 * instruction is rendered from the SERVER-provided key (never a client default).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import {
  createScanSession, addScanSessionPhoto, getScanSession,
  completeScanSession, escalateScanSession,
  emitScanUiEvent, rememberSessionId, recallSessionId, forgetSessionId,
} from '../../runtime/scanSession/scanSessionClient.js';
import { confirmScanPlant } from '../../runtime/scanTrust/confirmPlantRuntime.js';

// Action → label. Reuses already-registered keys where they exist; only 3 are new.
const ACTION_LABEL = {
  ADD_REQUESTED_PHOTO:        ['scan.gs.takeNext', 'Take the next photo'],
  CONFIRM_PLANT:             ['scan.guidance.confirmYes', 'Yes, this is correct'],
  SELECT_ALTERNATE:          ['scan.guidance.chooseGallery', 'Choose from Gallery'],
  FINISH_WITH_CURRENT_RESULT:['scan.gs.finish', 'Finish with this result'],
  ESCALATE:                  ['scan.guidance.askAgronomist', 'Ask an Agronomist'],
  RETRY_PROVIDER:            ['scan.gs.retry', 'Try again'],
  START_NEW_SESSION:         ['scan.gs.startOver', 'Start over'],
};

const C = { bg: '#FFFFFF', ink: '#1C2B22', sub: '#5B6B60', line: '#E3E9E4', brand: '#1F6A3A', brandInk: '#fff', soft: '#F4F7F4', warn: '#9A3412' };
const S = {
  wrap: { maxWidth: 520, margin: '0 auto', padding: 'max(12px, env(safe-area-inset-top)) 16px calc(84px + env(safe-area-inset-bottom))', color: C.ink },
  card: { background: C.bg, border: '1px solid ' + C.line, borderRadius: 18, padding: 18, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  progress: { fontSize: 13, fontWeight: 700, color: C.sub, letterSpacing: 0.3 },
  h: { fontSize: 20, fontWeight: 800, margin: '10px 0 4px', lineHeight: 1.25 },
  sub: { fontSize: 14, color: C.sub, lineHeight: 1.5, margin: 0 },
  block: { marginTop: 14, padding: 14, background: C.soft, borderRadius: 14 },
  label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, color: C.sub },
  val: { fontSize: 16, fontWeight: 700, marginTop: 2 },
  btnP: { display: 'block', width: '100%', minHeight: 52, marginTop: 12, border: 'none', borderRadius: 999, background: C.brand, color: C.brandInk, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
  btnS: { display: 'block', width: '100%', minHeight: 48, marginTop: 8, border: '1px solid ' + C.line, borderRadius: 999, background: 'transparent', color: C.ink, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  note: { fontSize: 13, color: C.warn, marginTop: 10 },
};

function _fileToBase64(file) {
  return new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => resolve('');
      r.readAsDataURL(file);
    } catch { resolve(''); }
  });
}

export default function GuidedScanSession({ cropName, onExit }) {
  const [session, setSession] = useState(null);   // the server response (source of truth)
  const [phase, setPhase] = useState('starting'); // starting | ready | working | error
  const [note, setNote] = useState('');
  const [dbg, setDbg] = useState({ api: '—', provider: '—', decision: '—' }); // §5 admin debug
  const startedRef = useRef(false);
  const fileRef = useRef(null);

  const _apply = useCallback((resp, statusNote) => {
    if (resp) { setSession(resp); if (resp.sessionId) rememberSessionId(resp.sessionId); }
    if (statusNote !== undefined) setNote(statusNote);
    setPhase('ready');
  }, []);

  const _start = useCallback(async () => {
    setPhase('starting'); setNote('');
    const priorId = recallSessionId();                 // §1/§19 recover an active session — server is authoritative
    if (priorId) {
      const got = await getScanSession(priorId);
      if (got.ok && got.data && got.data.sessionId) { emitScanUiEvent('scan_ui_session_started', got.data.sessionId, got.data.state); _apply(got.data, ''); return; }
      forgetSessionId();
    }
    emitScanUiEvent('scan_session_create_started', null, null);
    emitScanUiEvent('guided_scan_session_create_started', null, null);
    const created = await createScanSession({ cropName: cropName || undefined });
    setDbg((d) => ({ ...d, api: 'POST /sessions ' + (created.status || 0) }));
    if (created.ok && created.data && created.data.sessionId) {
      emitScanUiEvent('scan_session_create_success', created.data.sessionId, created.data.state);
      emitScanUiEvent('guided_scan_session_created', created.data.sessionId, created.data.state);
      emitScanUiEvent('scan_ui_session_started', created.data.sessionId, created.data.state);
      _apply(created.data, ''); return;
    }
    // Clear 401/403 vs network failure so the farmer sees why (§4).
    emitScanUiEvent('guided_scan_session_create_failed', null, 'status_' + (created.status || 0));
    emitScanUiEvent('scan_ui_error', null, 'create_failed');
    setNote(tSafe('scan.gs.startFailed', "We couldn't start the scan."));
    setPhase('error');
  }, [cropName, _apply]);

  useEffect(() => { if (!startedRef.current) { startedRef.current = true; emitScanUiEvent('guided_scan_loaded', null, null); emitScanUiEvent('guided_scan_route_loaded', null, null); _start(); } }, [_start]);

  const submitPhoto = useCallback(async (file) => {
    if (!file || !session || !session.sessionId) return;
    setPhase('working'); setNote('');
    emitScanUiEvent('scan_ui_photo_submitted', session.sessionId, session.state);
    const b64 = await _fileToBase64(file);
    if (!b64) { setPhase('ready'); setNote(tSafe('scan.gs.retryNote', "We couldn't read that photo. Try again.")); return; }
    const viewType = (session.nextView && session.nextView.viewType) || 'WHOLE_PLANT';
    const idem = 'p-' + (session.photoProgress ? session.photoProgress.received : 0) + '-' + b64.length;
    emitScanUiEvent('scan_photo_upload_started', session.sessionId, viewType);
    emitScanUiEvent('scan_provider_started', session.sessionId, viewType);
    const out = await addScanSessionPhoto(session.sessionId, { imageBase64: b64, viewType, idempotencyKey: idem });
    setDbg((d) => ({
      ...d,
      api: 'POST /photos ' + (out.status || 0),
      provider: (out.data && out.data.identification && out.data.identification.state) || d.provider,
      decision: (out.data && out.data.state) || d.decision,
    }));
    emitScanUiEvent('scan_result_received', session.sessionId, out.data && out.data.state);
    if (out.ok && out.data) emitScanUiEvent('scan_photo_upload_success', session.sessionId, out.data.state);
    if (out.status === 409 && out.data && out.data.error === 'session_expired') { emitScanUiEvent('scan_ui_error', session.sessionId, 'expired'); _apply(out.data, tSafe('scan.gs.expired', 'This scan expired. Start a new one.')); return; }
    if (!out.ok && !out.data) { emitScanUiEvent('scan_ui_error', session.sessionId, 'upload_failed'); setPhase('ready'); setNote(tSafe('scan.gs.retryNote', "That didn't go through. Try again.")); return; }
    if (out.data && out.data.deduplicated) { emitScanUiEvent('scan_ui_photo_submitted', session.sessionId, out.data.state); _apply(out.data, tSafe('scan.gs.duplicate', "That's the same photo — showing the previous result.")); return; }
    emitScanUiEvent('scan_ui_next_view_rendered', session.sessionId, out.data && out.data.state);
    _apply(out.data || session, '');
  }, [session, _apply]);

  const onPick = useCallback((e) => {
    const f = e && e.target && e.target.files && e.target.files[0];
    try { e.target.value = ''; } catch { /* ignore */ }
    if (f) submitPhoto(f);
  }, [submitPhoto]);
  const openCapture = useCallback(() => { emitScanUiEvent('scan_ui_photo_capture_opened', session && session.sessionId, session && session.state); if (fileRef.current) fileRef.current.click(); }, [session]);

  const doAction = useCallback(async (action) => {
    if (!session || !session.sessionId) return;
    const id = session.sessionId;
    if (action === 'ADD_REQUESTED_PHOTO' || action === 'RETRY_PROVIDER' || action === 'SELECT_ALTERNATE') return openCapture();
    if (action === 'START_NEW_SESSION') { forgetSessionId(); startedRef.current = false; setSession(null); return _start(); }
    setPhase('working');
    if (action === 'CONFIRM_PLANT') {
      const top = session.identification && session.identification.candidates && session.identification.candidates[0];
      if (top && top.taxonId) { await confirmScanPlant(id, top.taxonId); emitScanUiEvent('scan_ui_candidate_confirmed', id, session.state); }
      const got = await getScanSession(id); _apply(got.data || session, ''); return;
    }
    if (action === 'FINISH_WITH_CURRENT_RESULT') { const out = await completeScanSession(id); emitScanUiEvent('scan_ui_session_completed', id, out.data && out.data.state); _apply(out.data || session, tSafe('scan.gs.completed', 'Diagnosis saved.')); return; }
    if (action === 'ESCALATE') { const out = await escalateScanSession(id); emitScanUiEvent('scan_ui_session_escalated', id, out.data && out.data.state); _apply(out.data || session, tSafe('scan.gs.escalated', 'Sent to an agronomist for review.')); return; }
    setPhase('ready');
  }, [session, openCapture, _start, _apply]);

  const actions = useMemo(() => (session && Array.isArray(session.allowedActions)) ? session.allowedActions : [], [session]);

  if (phase === 'starting' || phase === 'working') {
    return (
      <main style={S.wrap} data-testid="guided-scan-session">
        <section style={S.card} aria-busy="true">
          <p style={S.progress}>{tSafe('scan.gs.starting', 'Working…')}</p>
          <p style={S.sub} data-testid="gs-loading">{tSafe('scan.gs.guidance', 'Daylight · fill the frame · hold steady')}</p>
        </section>
      </main>
    );
  }
  if (phase === 'error') {
    return (
      <main style={S.wrap} data-testid="guided-scan-session">
        <section style={S.card}>
          <h2 style={S.h}>{tSafe('scan.gs.startFailed', "We couldn't start the scan.")}</h2>
          <button type="button" style={S.btnP} data-testid="gs-retry" onClick={() => { startedRef.current = false; _start(); }}>{tSafe('scan.gs.retry', 'Try again')}</button>
        </section>
      </main>
    );
  }

  const s = session || {};
  const prog = s.photoProgress || { received: 0, maximum: 3 };
  const nv = s.nextView || null;
  const idState = (s.identification && s.identification.state) || 'NOT_RUN';
  const healthState = (s.health && s.health.state) || 'NOT_RUN';
  const isFirst = prog.received === 0;

  return (
    <main style={S.wrap} data-testid="guided-scan-session">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: 'none' }} data-testid="gs-file" />
      <section style={S.card} data-state={s.state} data-idstate={idState}>
        <p style={S.progress} data-testid="gs-progress">
          {tSafe('scan.gs.progress', '{received} of {maximum} photos')
            .replace('{received}', String(prog.received)).replace('{maximum}', String(prog.maximum))}
        </p>

        {isFirst ? (
          <>
            <h2 style={S.h}>{tSafe('scan.gs.takeFirst', 'Photograph the affected plant')}</h2>
            <p style={S.sub}>{tSafe('scan.gs.guidance', 'Daylight · fill the frame · hold steady')}</p>
          </>
        ) : null}

        {/* Server-requested next view (§3) — instruction rendered from the SERVER key, never a generic "Scan Again" */}
        {nv && nv.viewType ? (
          <div style={S.block} data-testid="gs-next-view" data-view={nv.viewType}>
            <div style={S.label}>{tSafe('scan.gs.nextPhoto', 'Next photo')}</div>
            {nv.instruction || nv.instructionKey
              ? <div style={S.val} data-testid="gs-next-instruction">{tSafe(nv.instructionKey, nv.instruction || '')}</div>
              : null}
          </div>
        ) : null}

        {/* Identification — server state only (§6). Reuses registered result strings. */}
        {idState !== 'NOT_RUN' ? (
          <div style={S.block} data-testid="gs-identification">
            <div style={S.label}>{tSafe('scan.gs.identification', 'Identification')}</div>
            <div style={S.val} data-testid="gs-id-state">
              {idState === 'CONFIRMED' ? tSafe('scan.prow.ok.id', 'Plant identified')
                : idState === 'PROVISIONAL' ? tSafe('scan.prow.prov.id', 'Possible plant found')
                : idState === 'NOT_A_PLANT' ? tSafe('scan.guidance.notPlant.title', "This doesn't look like a plant.")
                : tSafe('scan.prow.low.id', 'Several possibilities found')}
            </div>
            {(s.identification && s.identification.candidates && s.identification.candidates[0])
              ? <p style={{ ...S.sub, marginTop: 4 }} data-testid="gs-top-candidate">{String(s.identification.candidates[0].commonName || s.identification.candidates[0].scientificName || '')}</p>
              : null}
          </div>
        ) : null}

        {/* Health — server state only (§7); never invents disease names. Registered strings. */}
        {healthState !== 'NOT_RUN' ? (
          <div style={S.block} data-testid="gs-health">
            <div style={S.label}>{tSafe('scan.health.title', 'Health check')}</div>
            <div style={S.val}>
              {healthState === 'HEALTHY' ? tSafe('scan.health.noDisease', 'No obvious disease detected')
                : healthState === 'ISSUE_POSSIBLE' ? tSafe('scan.health.issue', 'Possible issue found')
                : healthState === 'PROVIDER_ERROR' ? tSafe('scan.health.error', 'Health check unavailable')
                : tSafe('scan.health.uncertain', 'Health not certain yet')}
            </div>
          </div>
        ) : null}

        {note ? <p style={S.note} data-testid="gs-note">{note}</p> : null}

        {/* Only server-authorized actions (§8) */}
        <div style={{ marginTop: 16 }} data-testid="gs-actions">
          {actions.map((a, i) => {
            const pair = ACTION_LABEL[a] || ['scan.gs.finish', 'Finish with this result'];
            return (
              <button key={a} type="button" data-testid={'gs-action-' + a}
                style={i === 0 ? S.btnP : S.btnS} onClick={() => doAction(a)}>
                {tSafe(pair[0], pair[1])}
              </button>
            );
          })}
          {typeof onExit === 'function'
            ? <button type="button" style={S.btnS} data-testid="gs-exit" onClick={onExit}>{tSafe('scan.gs.exit', 'Close')}</button>
            : null}
        </div>

        {/* §5 diagnostic — the whole component renders only behind the admin/pilot
            gate, so this is never farmer-visible. Technical tokens only (no PII). */}
        <div data-testid="gs-debug"
          style={{ marginTop: 14, padding: 8, borderRadius: 8, background: '#0B1F17', color: '#8FE3B4', fontSize: 11, fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
          {'sid=' + (s.sessionId || '-') + ' | api=' + dbg.api + ' | provider=' + dbg.provider + ' | decision=' + dbg.decision}
        </div>
      </section>
    </main>
  );
}
