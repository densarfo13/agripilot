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
});

describe('QuickUpdateFlow — Action Selection (Step 1)', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has three action options: progress, photo, issue', () => {
    expect(code).toContain("value: 'progress'");
    expect(code).toContain("value: 'photo'");
    expect(code).toContain("value: 'issue'");
  });

  it('action options have icons and descriptions (localized)', () => {
    expect(code).toContain("t('quickUpdate.cropProgress')");
    expect(code).toContain("t('quickUpdate.uploadPhoto')");
    expect(code).toContain("t('quickUpdate.reportIssue')");
    expect(code).toContain("t('quickUpdate.logStageCondition')");
    expect(code).toContain("t('quickUpdate.takeAFarmPhoto')");
    expect(code).toContain("t('quickUpdate.pestDiseaseWeather')");
  });

  it('action cards have tap-safe styling', () => {
    expect(code).toContain("WebkitTapHighlightColor: 'transparent'");
  });

  it('has action-select test ID', () => {
    expect(code).toContain('data-testid="action-select"');
  });

  it('asks "What do you want to do?"', () => {
    expect(code).toContain("t('update.whatToDo')");
  });
});

describe('QuickUpdateFlow — Stage Selection (Step 2)', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has four stage options: planting, vegetative, flowering, harvest (localized)', () => {
    expect(code).toContain("value: 'planting'");
    expect(code).toContain("t('quickUpdate.planting')");
    expect(code).toContain("value: 'vegetative'");
    expect(code).toContain("t('quickUpdate.growing')");
    expect(code).toContain("value: 'flowering'");
    expect(code).toContain("t('quickUpdate.flowering')");
    expect(code).toContain("value: 'harvest'");
    expect(code).toContain("t('quickUpdate.harvesting')");
  });

  it('stage options have large icons', () => {
    const stageIcons = ['🌱', '🌿', '🌼', '🌾'];
    for (const icon of stageIcons) {
      expect(code).toContain(icon);
    }
  });

  it('uses a 2x2 grid layout for stages', () => {
    expect(code).toContain('stageGrid');
    expect(code).toContain("gridTemplateColumns: '1fr 1fr'");
  });

  it('has stage-select test ID', () => {
    expect(code).toContain('data-testid="stage-select"');
  });

  it('stage cards have 100px+ minHeight', () => {
    expect(code).toContain("minHeight: '100px'");
  });

  it('asks "What stage is your crop?"', () => {
    expect(code).toContain("t('update.whatStage')");
  });
});

describe('QuickUpdateFlow — Condition (Step 3)', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has three condition options: good, average, poor', () => {
    expect(code).toContain("value: 'good'");
    expect(code).toContain("t('quickUpdate.good')");
    expect(code).toContain("value: 'average'");
    expect(code).toContain("t('quickUpdate.okay')");
    expect(code).toContain("value: 'poor'");
    expect(code).toContain("t('quickUpdate.problem')");
  });

  it('condition options have thumb icons', () => {
    expect(code).toContain("icon: '👍'");
    expect(code).toContain("icon: '👌'");
    expect(code).toContain("icon: '👎'");
  });

  it('condition options have color coding', () => {
    expect(code).toContain("color: '#22C55E'"); // good
    expect(code).toContain("color: '#F59E0B'"); // okay
    expect(code).toContain("color: '#EF4444'"); // problem
  });

  it('has condition-select test ID', () => {
    expect(code).toContain('data-testid="condition-select"');
  });

  it('condition cards have 120px+ minHeight', () => {
    expect(code).toContain("minHeight: '120px'");
  });

  it('asks "How does your crop look?"', () => {
    expect(code).toContain("t('update.howLook')");
  });
});

describe('QuickUpdateFlow — Photo Step', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has camera capture input with accept and capture attributes', () => {
    expect(code).toContain('accept="image/*"');
    expect(code).toContain('capture="environment"');
  });

  it('has photo-input and capture-photo-btn test IDs', () => {
    expect(code).toContain('data-testid="photo-input"');
    expect(code).toContain('data-testid="capture-photo-btn"');
  });

  it('shows photo preview after capture', () => {
    expect(code).toContain('photoPreview');
    expect(code).toContain('previewImg');
  });

  it('has remove photo button', () => {
    expect(code).toContain('removePhotoBtn');
    expect(code).toContain('clearPhoto');
  });

  it('has skip photo option for non-photo actions', () => {
    expect(code).toContain('skip-photo-btn');
    expect(code).toContain("t('update.skipPhoto')");
  });

  it('submit button adapts label: Save Photo / Submit with Photo / Submit Update', () => {
    expect(code).toContain("t('update.savePhoto')");
    expect(code).toContain("t('update.submitWithPhoto')");
    expect(code).toContain("t('update.submitUpdate')");
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

  it('falls back to original if compression fails', () => {
    expect(code).toContain('If compression fails, use original');
  });
});

describe('QuickUpdateFlow — Submit & Offline Handling', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has submit guard to prevent double-submit', () => {
    // Guard now lives inside useGuaranteedAction hook
    expect(code).toContain('useGuaranteedAction');
    expect(code).toContain('submitAction.run');
  });

  it('submits activity to /seasons/{id}/progress', () => {
    expect(code).toContain('/seasons/${seasonId}/progress');
  });

  it('submits condition to /seasons/{id}/condition', () => {
    expect(code).toContain('/seasons/${seasonId}/condition');
  });

  it('submits stage confirmation to /seasons/{id}/stage-confirmation', () => {
    expect(code).toContain('/seasons/${seasonId}/stage-confirmation');
  });

  it('queues to offline queue on network failure', () => {
    expect(code).toContain('enqueue(offlinePayload)');
    expect(code).toContain("from '../utils/offlineQueue.js'");
  });

  it('checks online status via guaranteed action offline handler', () => {
    // Online check is now handled by useGuaranteedAction's onOffline callback
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
    // Error tracking now handled by ActionFeedback + useGuaranteedAction
    expect(code).toContain("setStep('error')");
    expect(code).toContain('submitAction.isRetryable');
  });

  it('tracks first_update_submitted for new farmers', () => {
    expect(code).toContain("'first_update_submitted'");
  });
});

describe('QuickUpdateFlow — Feedback States', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('has success feedback with completion time', () => {
    // Now uses ActionFeedback component
    expect(code).toContain('ACTION_STATE.SUCCESS');
    expect(code).toContain("t('update.updateSaved')");
    expect(code).toContain("t('update.completedIn'");
  });

  it('has offline feedback', () => {
    expect(code).toContain('ACTION_STATE.SAVED_OFFLINE');
    expect(code).toContain("t('update.savedOffline')");
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

  it('done button calls onComplete', () => {
    expect(code).toContain('onDone=');
    expect(code).toContain('onComplete?.()');
  });
});

describe('QuickUpdateFlow — Flow Paths', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('progress path: action → stage → condition → photo', () => {
    expect(code).toContain("if (val === 'progress')");
    expect(code).toContain("goToStep('stage')");
    expect(code).toContain("goToStep('condition')");
    expect(code).toContain("goToStep('photo')");
  });

  it('photo path: action → photo directly', () => {
    expect(code).toContain("if (val === 'photo')");
  });

  it('issue path: action → condition pre-set to poor → photo', () => {
    expect(code).toContain("if (val === 'issue')");
    expect(code).toContain("setCondition('poor')");
  });

  it('has step indicator dots', () => {
    expect(code).toContain('quick-step-indicator');
    expect(code).toContain('stepDot');
  });

  it('has back navigation on all steps', () => {
    expect(code).toContain('aria-label="Back"');
    expect(code).toContain('aria-label="Close"');
  });
});

describe('QuickUpdateFlow — Mobile UX', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('submit button is 56px minHeight', () => {
    // Count 56px in submit button
    const submitIdx = code.indexOf('submitBtn:');
    const chunk = code.slice(submitIdx, submitIdx + 300);
    expect(chunk).toContain("minHeight: '56px'");
  });

  it('back buttons are 44px tap targets', () => {
    const backIdx = code.indexOf('backBtn:');
    const chunk = code.slice(backIdx, backIdx + 400);
    expect(chunk).toContain("minHeight: '44px'");
    expect(chunk).toContain("width: '44px'");
    expect(chunk).toContain("height: '44px'");
  });

  it('done/retry buttons are 52px minHeight', () => {
    const doneIdx = code.indexOf('doneBtn:');
    const chunk = code.slice(doneIdx, doneIdx + 200);
    expect(chunk).toContain("minHeight: '52px'");
  });

  it('all interactive elements have WebkitTapHighlightColor transparent', () => {
    const matches = (code.match(/WebkitTapHighlightColor:\s*'transparent'/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(8);
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

// ─── Image Stage Mapping ────────────────────────────────

describe('QuickUpdateFlow — Image Stage Mapping', () => {
  const code = readFile('src/components/QuickUpdateFlow.jsx');

  it('maps stages to image stages for progress-image API', () => {
    expect(code).toContain('IMAGE_STAGE_MAP');
    expect(code).toContain("planting: 'early_growth'");
    expect(code).toContain("vegetative: 'mid_stage'");
    expect(code).toContain("flowering: 'pre_harvest'");
    expect(code).toContain("harvest: 'harvest'");
  });
});
