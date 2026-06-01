#!/usr/bin/env node
/**
 * scripts/check-camera-user-gesture.mjs — §3 camera flow lock.
 *
 * Fails if:
 *   • the safe shell (ScanCameraLikeShell) calls getUserMedia (it must be
 *     presentational — camera starts only from a user tap)
 *   • the gesture-driven LiveCameraScanner does not own getUserMedia, does
 *     not use iOS-safe inline video (playsinline), or has no user-gesture /
 *     request gate
 *   • stream cleanup (track stop) is not wired in the camera layer
 *
 * Read-only static analyzer.
 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = process.cwd();
const F = [], P = [];
const read = (f) => { try { return fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch { return ''; } };
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/(^|\s)\/\/.*$/gm, '');

const shell = strip(read('src/components/scan/ScanCameraLikeShell.jsx'));
if (!shell) F.push('ScanCameraLikeShell.jsx: missing (safe shell required)');
else if (/\.getUserMedia\s*\(/.test(shell))
  F.push('ScanCameraLikeShell must NOT call getUserMedia (camera starts only after a user tap)');
else P.push('safe shell never calls getUserMedia');

const live = read('src/components/scan/LiveCameraScanner.jsx');
if (!live) F.push('LiveCameraScanner.jsx: missing');
else {
  if (!/getUserMedia/.test(live))
    F.push('LiveCameraScanner must own the gesture-driven getUserMedia path');
  else P.push('LiveCameraScanner owns getUserMedia');
  if (!/playsinline|playsInline/i.test(live))
    F.push('LiveCameraScanner must use iOS-safe inline video (playsinline)');
  else P.push('LiveCameraScanner uses playsinline (iOS-safe)');
  if (!/cameraRequested|startCamera|requestCamera|onStart|handleStart|onClick/.test(live))
    F.push('LiveCameraScanner must gate the camera behind a user gesture');
  else P.push('camera is gated behind a user gesture');
}

// Stream cleanup wired somewhere in the camera layer (track stop).
const cameraLayer = read('src/core/camera/cameraRuntimeManager.js')
  + read('src/core/camera/cameraHealthEngine.js') + live;
if (!/getTracks|\.stop\s*\(|stopStream|stopCamera|cleanup/i.test(cameraLayer))
  F.push('camera layer must wire stream cleanup (track stop on close/unmount/retry)');
else P.push('stream cleanup wired in the camera layer');

if (F.length) {
  console.error('[check:camera-user-gesture] FAIL');
  for (const m of [...new Set(F)]) console.error('  ✗ ' + m);
  process.exit(1);
}
console.log('[check:camera-user-gesture] PASS — getUserMedia gesture-gated; playsinline; cleanup wired.');
for (const m of P) console.log('  ✓ ' + m);
