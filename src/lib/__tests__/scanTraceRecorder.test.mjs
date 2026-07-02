/**
 * scanTraceRecorder.test — locks the debug-harness pure helpers: telemetry→step mapping,
 * trace summary (finds the failing step), and the export bundle shape.
 * Self-running: `node src/lib/__tests__/scanTraceRecorder.test.mjs`.
 */
import { STEPS, mapTelemetryToStep, deriveTraceSummary, buildScanDebugBundle } from '../scanTraceRecorder.js';

let passed = 0;
function ok(c, m) { if (!c) { console.error('  ✗ ' + m); process.exit(1); } passed++; }

// 15 canonical steps present + in order
ok(STEPS.length === 15, '15 canonical steps');
ok(STEPS[0] === 'camera_opened' && STEPS[14] === 'result_render_completed', 'first/last step correct');

// telemetry → step mapping
ok(mapTelemetryToStep('image_upload_started') === 'upload_started', 'upload_started maps');
ok(mapTelemetryToStep('scan_provider_completed') === 'provider_response_received', 'provider completed maps');
ok(mapTelemetryToStep('scan_component_error') === 'result_render_started', 'render crash maps to render step');
ok(mapTelemetryToStep('totally_unrelated') === null, 'unknown event → null');
ok(mapTelemetryToStep(null) === null, 'null event → null, never throws');

// summary: explicit fail wins
const t1 = [{ step: 'camera_opened', status: 'ok' }, { step: 'upload_started', status: 'ok' },
  { step: 'provider_called', status: 'fail' }];
ok(deriveTraceSummary(t1).failingStep === 'provider_called', 'explicit fail is the failing step');

// summary: pipeline stopped → failing step is the next one
const t2 = [{ step: 'camera_opened', status: 'ok' }, { step: 'photo_selected', status: 'ok' }];
ok(deriveTraceSummary(t2).failingStep === 'image_type_detected', 'stopped pipeline → next step is failing');
ok(deriveTraceSummary(t2).lastReachedStep === 'photo_selected', 'last reached step');

// summary: completed → no failing step
const t3 = STEPS.map((s) => ({ step: s, status: 'ok' }));
ok(deriveTraceSummary(t3).failingStep === null, 'fully completed → no failing step');
ok(deriveTraceSummary([]).failingStep === null, 'empty trace → no failing step, never throws');

// export bundle shape
const b = buildScanDebugBundle({
  trace: t1, crash: { message: 'boom', correlationId: 'scan-x' }, correlationId: 'scan-x',
  nav: { userAgent: 'iPhone Safari', platform: 'iPhone', language: 'en' },
  screen: { width: 390, height: 844, devicePixelRatio: 3, touch: true }, timestamp: '2026-07-01T00:00:00Z',
});
ok(b.correlationId === 'scan-x' && b.failingStep === 'provider_called', 'bundle has correlationId + failing step');
ok(b.browser.userAgent === 'iPhone Safari' && b.device.width === 390, 'bundle captures browser + device');
ok(b.crash && b.crash.message === 'boom', 'bundle includes crash');
ok(JSON.stringify(b).length > 0, 'bundle is JSON-serialisable');

console.log('[scanTraceRecorder] PASS — ' + passed + ' assertions. 15-step trace, failing-step detection, '
  + 'and export bundle all correct; pure helpers never throw.');
