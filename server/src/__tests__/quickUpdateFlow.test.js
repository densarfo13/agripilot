import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readFile(relPath) {
  return fs.readFileSync(path.resolve(relPath), 'utf-8');
}

// ─── QuickUpdateFlow Component ──────────────────────────

describe('QuickUpdateFlow — Component Structure', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('exports a default function component', () => {
    expect(code).toContain('export default function QuickUpdateFlow');
  });

  it('accepts required props: seasonId, farmerId, onComplete, onCancel, entries', () => {
    expect(code).toContain('seasonId');
    expect(code).toContain('farmerId');
    expect(code).toContain('onComplete');
    expect(code).toContain('onCancel');
    expect(code).toContain('entries');
  });

  it('has data-testid quick-update-flow on container', () => {
    expect(code).toContain('data-testid="quick-update-flow"');
  });

  it('accepts seasonStage prop for auto-suggest', () => {
    expect(code).toContain('seasonStage');
    expect(code).toContain('suggestActivity');
  });
});

describe('QuickUpdateFlow — Camera-First Flow', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('opens camera immediately on mount', () => {
    expect(code).toContain('fileInputRef.current');
    expect(code).toContain('.click()');
    // Uses useEffect to trigger camera on mount
    expect(code).toContain('useEffect');
  });

  it('starts on camera step', () => {
    expect(code).toContain("useState('camera')");
  });

  it('has camera capture input with accept and capture attributes', () => {
    expect(code).toContain('accept="image/*"');
    expect(code).toContain('capture="environment"');
  });

  it('transitions to review after photo capture', () => {
    expect(code).toContain("setStep('review')");
  });

  it('allows skipping camera to go to review', () => {
    expect(code).toContain("t('update.skipPhoto')");
    expect(code).toContain("setStep('review')");
  });
});

describe('QuickUpdateFlow — Activity Selection (Review Screen)', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has 5 activity options: progress, harvest, spray, issue, other', () => {
    expect(code).toContain("value: 'progress'");
    expect(code).toContain("value: 'harvest'");
    expect(code).toContain("value: 'spray'");
    expect(code).toContain("value: 'issue'");
    expect(code).toContain("value: 'other'");
  });

  it('activity options use localized labels', () => {
    expect(code).toContain("t('update.activity.progress')");
    expect(code).toContain("t('update.activity.harvest')");
    expect(code).toContain("t('update.activity.spray')");
    expect(code).toContain("t('update.activity.issue')");
    expect(code).toContain("t('update.activity.other')");
  });

  it('activity options have icons', () => {
    expect(code).toContain("icon: '🌱'");
    expect(code).toContain("icon: '🌾'");
    expect(code).toContain("icon: '💧'");
    expect(code).toContain("icon: '⚠️'");
    expect(code).toContain("icon: '📋'");
  });

  it('has activity-select test ID', () => {
    expect(code).toContain('data-testid="activity-select"');
  });

  it('shows "What happened?" label', () => {
    expect(code).toContain("t('update.whatHappened')");
  });

  it('auto-suggests most likely activity based on season stage', () => {
    expect(code).toContain('suggestActivity');
    expect(code).toContain('suggested');
    expect(code).toContain("t('update.suggested')");
  });

  it('renders activity buttons not dropdown', () => {
    expect(code).toContain('activityGrid');
    expect(code).toContain('activityBtn');
    // No select dropdown for activities
    expect(code).not.toContain('<select');
  });

  it('activity cards have tap-safe styling', () => {
    expect(code).toContain("WebkitTapHighlightColor: 'transparent'");
  });
});

describe('QuickUpdateFlow — Photo Preview', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has photo-input and capture-photo-btn test IDs', () => {
    expect(code).toContain('data-testid="photo-input"');
    expect(code).toContain('data-testid="capture-photo-btn"');
  });

  it('shows photo preview after capture', () => {
    expect(code).toContain('photoPreview');
    expect(code).toContain('previewImg');
  });

  it('has retake photo button', () => {
    expect(code).toContain('retakeBtn');
    expect(code).toContain('retakePhoto');
    expect(code).toContain("t('update.retake')");
  });

  it('has optional add photo button when no photo', () => {
    expect(code).toContain('addPhotoBtn');
    expect(code).toContain("t('update.addPhotoOptional')");
  });
});

describe('QuickUpdateFlow — Photo Compression', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has compressPhoto function', () => {
    expect(code).toContain('function compressPhoto');
  });

  it('limits to 1200px max dimension', () => {
    expect(code).toContain('MAX_PHOTO_DIMENSION = 1200');
  });

  it('compresses to 0.7 JPEG quality', () => {
    expect(code).toContain('PHOTO_QUALITY = 0.7');
  });

  it('uses canvas for compression', () => {
    expect(code).toContain("document.createElement('canvas')");
    expect(code).toContain('toBlob');
  });
});

describe('QuickUpdateFlow — Submit & Offline Handling', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has submit guard via useGuaranteedAction', () => {
    expect(code).toContain('useGuaranteedAction');
    expect(code).toContain('submitAction.run');
  });

  it('submits activity to /seasons/{id}/progress', () => {
    expect(code).toContain('/seasons/${seasonId}/progress');
  });

  it('submits condition to /seasons/{id}/condition', () => {
    expect(code).toContain('/seasons/${seasonId}/condition');
  });

  it('auto-sets condition based on activity type', () => {
    expect(code).toContain('ACTIVITY_CONDITION_MAP');
  });

  it('queues to offline queue on network failure', () => {
    expect(code).toContain('enqueue(offlinePayload)');
    expect(code).toContain("from '../utils/offlineQueue.js'");
  });

  it('checks online status via guaranteed action offline handler', () => {
    expect(code).toContain('onOffline');
    expect(code).toContain('enqueue(offlinePayload)');
  });

  it('tracks quick_update_completed event', () => {
    expect(code).toContain("'quick_update_completed'");
  });

  it('tracks quick_update_offline event', () => {
    expect(code).toContain("'quick_update_offline'");
  });

  it('tracks update failure via error step', () => {
    expect(code).toContain("setStep('error')");
    expect(code).toContain('submitAction.isRetryable');
  });

  it('tracks first_update_submitted for new farmers', () => {
    expect(code).toContain("'first_update_submitted'");
  });

  it('maps activity values to API activityType', () => {
    expect(code).toContain('ACTIVITY_API_MAP');
  });
});

describe('QuickUpdateFlow — Success & Offline States', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has success screen with checkmark', () => {
    expect(code).toContain('successScreen');
    expect(code).toContain("t('update.updateSavedCheck')");
  });

  it('has offline screen with sync message', () => {
    expect(code).toContain('offlineScreen');
    expect(code).toContain("t('update.savedOfflineMsg')");
    expect(code).toContain("t('update.willSyncReconnect')");
  });

  it('has error feedback with retry', () => {
    expect(code).toContain('ACTION_STATE.RETRYABLE');
    expect(code).toContain('ACTION_STATE.ERROR');
    expect(code).toContain('onRetry={handleSubmit}');
  });

  it('has submitting spinner state', () => {
    expect(code).toContain("t('update.savingUpdate')");
    expect(code).toContain('ACTION_STATE.LOADING');
  });

  it('auto-returns to home after success', () => {
    expect(code).toContain('AUTO_RETURN_MS');
    expect(code).toContain('scheduleAutoReturn');
    expect(code).toContain('onComplete?.()');
  });

  it('done button calls onComplete', () => {
    expect(code).toContain('onComplete?.()');
  });
});

describe('QuickUpdateFlow — Single-Screen Flow', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('camera-first: camera → review → submit → done', () => {
    expect(code).toContain("step === 'camera'");
    expect(code).toContain("step === 'review'");
    expect(code).toContain("step === 'submitting'");
    expect(code).toContain("step === 'done'");
  });

  it('review screen shows photo + activity + submit on single screen', () => {
    // Review step has photo section, activity grid, and submit button together
    expect(code).toContain('photoSection');
    expect(code).toContain('activityGrid');
    expect(code).toContain('submitBtn');
  });

  it('no multi-step forms — no step indicator dots', () => {
    // Old flow had stepDot/stepIndicator — new flow is single-screen
    expect(code).not.toContain('stepDot');
    expect(code).not.toContain('stepIndicator');
  });

  it('has close button on review (not back)', () => {
    expect(code).toContain('closeBtn');
    expect(code).toContain('aria-label="Close"');
  });
});

describe('QuickUpdateFlow — Mobile UX', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('submit button is 56px minHeight', () => {
    const submitIdx = code.indexOf('submitBtn:');
    const chunk = code.slice(submitIdx, submitIdx + 300);
    expect(chunk).toContain("minHeight: '56px'");
  });

  it('close button is 44px tap target', () => {
    const closeIdx = code.indexOf('closeBtn:');
    const chunk = code.slice(closeIdx, closeIdx + 400);
    expect(chunk).toContain("minHeight: '44px'");
    expect(chunk).toContain("width: '44px'");
    expect(chunk).toContain("height: '44px'");
  });

  it('done button is 52px minHeight', () => {
    const doneIdx = code.indexOf('doneBtn:');
    const chunk = code.slice(doneIdx, doneIdx + 400);
    expect(chunk).toContain("minHeight: '52px'");
  });

  it('activity buttons are 44px minHeight', () => {
    const idx = code.indexOf('activityBtn:');
    const chunk = code.slice(idx, idx + 400);
    expect(chunk).toContain("minHeight: '44px'");
  });

  it('interactive elements have WebkitTapHighlightColor transparent', () => {
    const matches = (code.match(/WebkitTapHighlightColor:\s*'transparent'/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(5);
  });
});

// ─── FarmerProgressTab Integration ──────────────────────

describe('QuickUpdateFlow — FarmerProgressTab Integration', () => {
  const code = readFile('src/pages/FarmerProgressTab.jsx');

  it('imports QuickUpdateFlow', () => {
    expect(code).toContain("import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx'");
  });

  it('has showQuickUpdate state', () => {
    expect(code).toContain('showQuickUpdate');
    expect(code).toContain('setShowQuickUpdate');
  });

  it('has big "Add Update" CTA button with gradient', () => {
    expect(code).toContain('quick-update-cta');
    expect(code).toContain('linear-gradient');
    expect(code).toContain("t('progress.addUpdate')");
  });

  it('CTA button is 56px minHeight', () => {
    const ctaIdx = code.indexOf('quick-update-cta');
    const chunk = code.slice(Math.max(0, ctaIdx - 800), ctaIdx);
    expect(chunk).toContain("minHeight: '56px'");
  });

  it('renders QuickUpdateFlow when showQuickUpdate is true', () => {
    expect(code).toContain('<QuickUpdateFlow');
    expect(code).toContain('showQuickUpdate && activeSeason');
  });

  it('passes correct props to QuickUpdateFlow', () => {
    expect(code).toContain('seasonId={activeSeason.id}');
    expect(code).toContain('farmerId={farmerId}');
    expect(code).toContain('entries={entries}');
    expect(code).toContain('seasonStage={activeSeason.stage}');
    expect(code).toContain('onComplete=');
    expect(code).toContain('onCancel=');
  });

  it('onComplete reloads seasons and shows success', () => {
    expect(code).toContain('setShowQuickUpdate(false)');
    expect(code).toContain('loadSeasons()');
  });

  it('preserves existing detailed action buttons as secondary', () => {
    expect(code).toContain("t('progress.logActivity')");
    expect(code).toContain("t('progress.updateCondition')");
    expect(code).toContain("t('progress.addPhoto')");
    expect(code).toContain("t('progress.submitHarvestReport')");
  });
});

// ─── Dashboard Integration ─────────────────────────────

describe('QuickUpdateFlow — Dashboard Integration', () => {
  const code = readFile('src/pages/Dashboard.jsx');

  it('imports QuickUpdateFlow', () => {
    expect(code).toContain("import QuickUpdateFlow from '../components/QuickUpdateFlow.jsx'");
  });

  it('has Add Update button on dashboard', () => {
    expect(code).toContain('data-testid="add-update-btn"');
    expect(code).toContain("t('update.addUpdate')");
  });

  it('Add Update button has large green gradient style', () => {
    expect(code).toContain('addUpdateBtn');
    expect(code).toContain('linear-gradient');
  });

  it('shows QuickUpdateFlow in modal overlay', () => {
    expect(code).toContain('modalOverlay');
    expect(code).toContain('modalContent');
    expect(code).toContain('<QuickUpdateFlow');
  });

  it('passes seasonId and seasonStage to QuickUpdateFlow', () => {
    expect(code).toContain('seasonId={season?.id}');
    expect(code).toContain('seasonStage={season?.stage}');
  });

  it('refreshes season on complete', () => {
    expect(code).toContain('refreshSeason()');
  });

  it('only shows button when setup complete and season active', () => {
    expect(code).toContain('setupComplete && season');
  });
});

// ─── Image Stage Mapping ────────────────────────────────

describe('QuickUpdateFlow — Image Stage Mapping', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('maps activities to image stages for progress-image API', () => {
    expect(code).toContain('IMAGE_STAGE_MAP');
    expect(code).toContain("planting: 'early_growth'");
    expect(code).toContain("growing: 'mid_stage'");
    expect(code).toContain("flowering: 'pre_harvest'");
    expect(code).toContain("harvest: 'harvest'");
  });
});
