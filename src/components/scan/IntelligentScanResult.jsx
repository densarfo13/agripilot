/**
 * IntelligentScanResult.jsx — Phase 9 farmer-friendly scan result.
 *
 *   <IntelligentScanResult result={scanResultEnvelope} onRetake={...}
 *                          onChoose={...} onSaveForReview={...} />
 *
 * What this is
 * ────────────
 *   A composition layer that takes the existing /api/scan/analyze
 *   envelope (Plant.id-backed; UNCHANGED) and presents it as a
 *   farmer-friendly stacked-card layout:
 *
 *     1. Voice-play header (TTS via existing voiceService)
 *     2. Plant Identification    (name + scientific + confidence + category)
 *     3. Flower-specific block   (only when category is flower)
 *     4. Crop Health             (severity + confidence + affected area)
 *     5. Treatment Engine        (actions + organic + chemical +
 *                                 prevention + recovery time)
 *     6. Region Intelligence     (weather + season + crop hint)
 *     7. Soil Intelligence       (only when soil data present)
 *     8. Satellite Intelligence  (only when sentinel data present)
 *     9. Needs Review Actions    (only when confidence low)
 *
 *   Every section reads from the envelope and gracefully renders
 *   nothing when its data is absent. NO new API calls. NO Plant.id
 *   modification. NO offline-queue or persistence changes — the
 *   parent ScanPage owns those via scanPersistenceBridge.
 *
 * Strict-rule audit
 *   • Pure render. SSR-safe (every browser API guarded).
 *   • No direct API calls.
 *   • Voice routed through src/services/voiceService.js — never
 *     touches speechSynthesis directly.
 *   • All copy via tSafe with sensible English defaults.
 *   • Never surfaces raw JSON / API errors / confidence numbers
 *     without farmer-language framing (Phase 9 rule).
 */

import React, { useMemo, useState, useCallback } from 'react';
import { tSafe } from '../../i18n/tSafe.js';
import { useTranslation } from '../../i18n/index.js';
import ScanGuidanceCard from './ScanGuidanceCard.jsx';
// SCAN TYPE ROUTER — fruit/veg + insect get their own result cards, not
// the plant-only path. Direct imports (small, must render with the result).
import FruitVegResultCard from './FruitVegResultCard.jsx';
import InsectResultCard from './InsectResultCard.jsx';
import { evaluateScanTrust } from '../../runtime/scanTrust/ScanTrustGate';
import { evaluatePhotoQuality } from '../../runtime/scanQuality/PhotoQualityEngine';
import { explainPhotoQuality } from '../../runtime/scanQuality/PhotoQualityExplainer';
import {
  speakText, stop as voiceStop, isAvailable as voiceAvailable,
  isSpeaking as voiceIsSpeaking,
} from '../../runtime/services/voiceService.js';

const _safe = (fn, fb) => { try { return fn(); } catch { return fb; } };
const _isObj = (v) => v != null && typeof v === 'object';
const _str  = (v) => (typeof v === 'string' ? v : '');
const _num  = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const _arr  = (v) => (Array.isArray(v) ? v : []);
const _isFn = (v) => typeof v === 'function';

// ───────────────────────────────────────────────────────────
// Envelope extractors — read existing fields, never modify.
// ───────────────────────────────────────────────────────────

function _extractIdentification(r) {
  if (!_isObj(r)) return null;
  const plantName =
       _str(r.plantName)
    || _str(r.commonName)
    || _str(r.detectedName)
    || _str(r.identification && r.identification.commonName)
    || _str(r.identification && r.identification.detectedName)
    || _str(r.crop)
    || _str(r.cropName)
    || '';
  const scientificName =
       _str(r.scientificName)
    || _str(r.identification && r.identification.scientificName)
    || '';
  const category =
       _str(r.plantCategory)
    || _str(r.category)
    || _str(r.identification && r.identification.category)
    || '';
  // Confidence may be tone ('high'|'medium'|'low'), 0-1 number,
  // or 0-100 number. Normalize to a percent string for display.
  //
  // SCAN ROOT-CAUSE FIX — prefer `r.confidencePct` (numeric 0..100)
  // when present. scanDetectionEngine sets this alongside the legacy
  // banded `r.confidence` string; without this preference the
  // banded fallback would pin the UI to 25% even when the server
  // returned a real 87% match.
  const rawConf = (typeof r.confidencePct === 'number'
                   && Number.isFinite(r.confidencePct))
    ? r.confidencePct
    : (r.confidence != null ? r.confidence
        : r.identification && r.identification.confidence);
  let confidencePct = null;
  let confidenceTone = null;
  if (typeof rawConf === 'string') {
    const t = rawConf.toLowerCase();
    if (t === 'high')   { confidenceTone = 'high';   confidencePct = 85; }
    else if (t === 'medium' || t === 'medium_confidence') { confidenceTone = 'medium'; confidencePct = 55; }
    else if (t === 'low' || t === 'needs_review') { confidenceTone = 'low'; confidencePct = 25; }
  } else if (typeof rawConf === 'number') {
    const n = rawConf > 1.5 ? rawConf : rawConf * 100;
    confidencePct = Math.max(0, Math.min(100, Math.round(n)));
    confidenceTone = confidencePct >= 70 ? 'high'
                   : confidencePct >= 40 ? 'medium' : 'low';
  } else if (typeof r.confidenceTone === 'string') {
    confidenceTone = r.confidenceTone.toLowerCase();
  }
  if (!plantName) return null;
  return Object.freeze({
    plantName, scientificName, category, confidencePct, confidenceTone,
  });
}

function _isFlowerCategory(category) {
  const c = _str(category).toLowerCase();
  return c === 'flower' || c === 'ornamental' || c === 'flowering_plant';
}

function _extractHealth(r) {
  if (!_isObj(r)) return null;
  const severityRaw = _str(r.severity || r.urgency || r.hybridUrgency).toLowerCase();
  const severity = ['low', 'medium', 'high', 'moderate', 'serious', 'mild']
    .includes(severityRaw) ? severityRaw : null;
  const affectedAreaPct = _num(r.affectedAreaPct) != null
    ? _num(r.affectedAreaPct)
    : _num(r.affectedArea);
  const issue = _str(r.possibleIssue) || _str(r.diagnosis) || '';
  if (!severity && !affectedAreaPct && !issue) return null;
  return Object.freeze({ severity, affectedAreaPct, issue });
}

function _extractTreatment(r) {
  if (!_isObj(r)) return null;
  const actions   = _arr(r.recommendedActions
                       || (r.recommendation && r.recommendation.actions));
  const organic   = _arr(r.organicTreatment || r.organic);
  const chemical  = _arr(r.chemicalTreatment || r.chemical);
  const prevention = _arr(r.prevention || r.preventiveActions);
  const recovery  = _str(r.expectedRecoveryTime || r.recoveryTime);
  if (actions.length === 0 && organic.length === 0
      && chemical.length === 0 && prevention.length === 0
      && !recovery) return null;
  return Object.freeze({
    actions, organic, chemical, prevention, recovery,
  });
}

function _extractRegion(r) {
  if (!_isObj(r)) return null;
  const weatherNote = _str(r.weatherNote)
    || _str(r.hybridContext && r.hybridContext.weatherNote);
  const seasonNote  = _str(r.seasonNote);
  const locationNote = _str(r.locationNote);
  const cropHint    = _str(r.cropHint) || _str(r.hybridReason);
  const notes = [weatherNote, seasonNote, locationNote, cropHint]
    .filter(Boolean);
  if (notes.length === 0) return null;
  return Object.freeze({ weatherNote, seasonNote, locationNote, cropHint });
}

function _extractSoil(r) {
  if (!_isObj(r) || !_isObj(r.soil)) return null;
  const s = r.soil;
  const present = !!(s.type || s.ph || s.drainage || s.organicMatter || s.suitabilityScore);
  if (!present) return null;
  return Object.freeze({
    type:           _str(s.type),
    ph:             _num(s.ph),
    drainage:       _str(s.drainage),
    organicMatter:  _str(s.organicMatter),
    suitabilityScore: _num(s.suitabilityScore),
  });
}

function _extractSatellite(r) {
  if (!_isObj(r) || !_isObj(r.satellite)) return null;
  const s = r.satellite;
  const present = !!(s.vegetationHealth || s.moistureRisk || s.heatStress || s.growthTrend);
  if (!present) return null;
  return Object.freeze({
    vegetationHealth: _str(s.vegetationHealth),
    moistureRisk:     _str(s.moistureRisk),
    heatStress:       _str(s.heatStress),
    growthTrend:      _str(s.growthTrend),
  });
}

function _shouldShowNeedsReview(r) {
  if (!_isObj(r)) return false;
  if (r.suppressed === true) return true;
  if (typeof r.status === 'string'
      && ['needs_review', 'low_confidence', 'uncertain']
         .includes(r.status.toLowerCase())) return true;
  if (typeof r.confidenceTone === 'string'
      && ['low', 'needs_review'].includes(r.confidenceTone.toLowerCase())) return true;
  return false;
}

// ───────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────

const STYLES = {
  page: {
    background: '#F6F1E7',
    padding:    '16px 14px 96px',
    maxWidth:   720,
    margin:     '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    background:    '#FFFFFF',
    borderRadius:  14,
    padding:       '14px 16px',
    marginBottom:  12,
    border:        '1px solid rgba(31,41,51,0.06)',
    boxShadow:     '0 1px 2px rgba(31,41,51,0.03)',
  },
  cardTitle: {
    margin:        '0 0 8px',
    fontSize:      11,
    fontWeight:    700,
    color:         '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  primaryRow: {
    display:       'flex',
    alignItems:    'center',
    gap:           10,
  },
  plantName: {
    fontSize:      20,
    fontWeight:    800,
    color:         '#1F2933',
    margin:        0,
  },
  scientific: {
    fontSize:      13,
    fontStyle:     'italic',
    color:         '#64748B',
    marginTop:     2,
  },
  metaRow: {
    display:       'flex',
    gap:           6,
    flexWrap:      'wrap',
    marginTop:     10,
  },
  pill: {
    fontSize:      11,
    fontWeight:    600,
    padding:       '4px 9px',
    borderRadius:  999,
    background:    '#F1F5F9',
    color:         '#475569',
    border:        '1px solid rgba(31,41,51,0.06)',
  },
  confPill: (tone) => ({
    fontSize:      11,
    fontWeight:    700,
    padding:       '4px 9px',
    borderRadius:  999,
    background:    tone === 'high'   ? 'rgba(16,185,129,0.12)'
                 : tone === 'medium' ? 'rgba(245,158,11,0.12)'
                 : 'rgba(239,68,68,0.12)',
    color:         tone === 'high'   ? '#047857'
                 : tone === 'medium' ? '#92400E'
                 : '#991B1B',
    border:        '1px solid rgba(31,41,51,0.06)',
  }),
  voiceBtn: {
    appearance:    'none',
    border:        '1.5px solid rgba(31,41,51,0.18)',
    background:    '#FFFFFF',
    color:         '#1F2933',
    fontWeight:    600,
    fontSize:      13,
    padding:       '8px 14px',
    borderRadius:  10,
    cursor:        'pointer',
    fontFamily:    'inherit',
  },
  list: {
    margin:        '6px 0 0',
    paddingLeft:   18,
    fontSize:      13,
    color:         '#1F2933',
    lineHeight:    1.55,
  },
  subhead: {
    fontSize:      12,
    fontWeight:    700,
    color:         '#475569',
    margin:        '12px 0 4px',
  },
  body: {
    margin:        0,
    fontSize:      13,
    color:         '#475569',
    lineHeight:    1.5,
  },
  severityBar: (tone) => ({
    display:       'inline-block',
    width:         52,
    height:        8,
    borderRadius:  999,
    background:    tone === 'high'   ? '#EF4444'
                 : tone === 'medium' ? '#F59E0B'
                 : '#10B981',
    marginRight:   8,
    verticalAlign: 'middle',
  }),
};

function _toneFromSeverity(sev) {
  const s = _str(sev).toLowerCase();
  if (s === 'high' || s === 'serious') return 'high';
  if (s === 'medium' || s === 'moderate') return 'medium';
  return 'low';
}

function _humanCategory(c) {
  const k = _str(c).toLowerCase();
  if (k === 'flower' || k === 'flowering_plant' || k === 'ornamental') return 'flower';
  if (k === 'crop')   return 'crop';
  if (k === 'weed')   return 'weed';
  if (k === 'garden') return 'garden plant';
  return c;
}

// ───────────────────────────────────────────────────────────
// Sub-cards
// ───────────────────────────────────────────────────────────

function VoiceHeader({ result }) {
  const { lang } = useTranslation();
  const available = _safe(() => voiceAvailable(), false);
  const [speaking, setSpeaking] = useState(false);
  const onListen = useCallback(() => {
    const text = _buildSpokenSummary(result);
    if (!text || !available) return;
    if (speaking) {
      _safe(() => voiceStop(), null);
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    _safe(() => speakText(text, lang || 'en'), null);
    // Best-effort speaking-end detector via interval.
    let tick = 0;
    const t = setInterval(() => {
      tick += 1;
      const still = _safe(() => voiceIsSpeaking(), false);
      if (!still || tick > 60) {
        clearInterval(t);
        setSpeaking(false);
      }
    }, 500);
  }, [result, lang, available, speaking]);
  if (!available) return null;
  return (
    <div style={{ ...STYLES.card, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between' }}
      data-testid="scan-voice-header"
    >
      <div style={{ ...STYLES.cardTitle, margin: 0 }}>
        {tSafe('scan.intel.voice.label', 'Voice')}
      </div>
      <button
        type="button"
        style={STYLES.voiceBtn}
        onClick={onListen}
        data-testid="scan-voice-listen"
      >
        {speaking
          ? '⏹ ' + tSafe('scan.intel.voice.stop', 'Stop')
          : '🔊 ' + tSafe('scan.intel.voice.listen', 'Listen')}
      </button>
    </div>
  );
}

function PlantIdentificationSection({ identification }) {
  if (!identification) return null;
  const { plantName, scientificName, category, confidencePct, confidenceTone }
    = identification;
  return (
    <section style={STYLES.card} data-testid="scan-intel-plant">
      <h4 style={STYLES.cardTitle}>
        {tSafe('scan.intel.plant.title', 'Plant identification')}
      </h4>
      <p style={STYLES.plantName}>{plantName}</p>
      {scientificName ? <div style={STYLES.scientific}>{scientificName}</div> : null}
      <div style={STYLES.metaRow}>
        {category ? (
          <span style={STYLES.pill} data-testid="scan-intel-plant-category">
            {_humanCategory(category)}
          </span>
        ) : null}
        {confidencePct != null ? (
          <span
            style={STYLES.confPill(confidenceTone || 'low')}
            data-testid="scan-intel-plant-confidence"
          >
            {confidencePct}% {tSafe('scan.intel.plant.confidence', 'sure')}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function FlowerSection({ identification, result }) {
  if (!identification || !_isFlowerCategory(identification.category)) return null;
  const flowerType = _str(result && result.flowerType)
    || _str(result && result.subCategory);
  const growingTips = _arr(result && result.growingTips);
  return (
    <section style={STYLES.card} data-testid="scan-intel-flower">
      <h4 style={STYLES.cardTitle}>
        🌸 {tSafe('scan.intel.flower.title', 'Flower details')}
      </h4>
      <p style={{ ...STYLES.body, fontWeight: 700, color: '#1F2933' }}>
        {identification.plantName}
      </p>
      {flowerType ? (
        <div style={STYLES.subhead}>
          {tSafe('scan.intel.flower.type', 'Type')}: {flowerType}
        </div>
      ) : null}
      {growingTips.length > 0 ? (
        <>
          <div style={STYLES.subhead}>
            {tSafe('scan.intel.flower.growingTips', 'Growing tips')}
          </div>
          <ul style={STYLES.list}>
            {growingTips.slice(0, 5).map((tip, i) => (
              <li key={'tip-' + i}>{_str(tip)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function CropHealthSection({ health }) {
  if (!health) return null;
  const tone = _toneFromSeverity(health.severity);
  const sevLabelKey = `scan.intel.health.severity.${tone}`;
  const sevLabel = { high: 'High', medium: 'Medium', low: 'Low' }[tone];
  return (
    <section style={STYLES.card} data-testid="scan-intel-health">
      <h4 style={STYLES.cardTitle}>
        {tSafe('scan.intel.health.title', 'Crop health')}
      </h4>
      {health.issue ? (
        <p style={{ ...STYLES.body, fontWeight: 600, color: '#1F2933' }}>
          {health.issue}
        </p>
      ) : null}
      {health.severity ? (
        <div style={{ marginTop: 8 }}>
          <span style={STYLES.severityBar(tone)} aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1F2933' }}>
            {tSafe('scan.intel.health.severityLabel', 'Severity')}
            {': '}
            {tSafe(sevLabelKey, sevLabel)}
          </span>
        </div>
      ) : null}
      {health.affectedAreaPct != null ? (
        <div style={{ ...STYLES.body, marginTop: 6 }}>
          {tSafe('scan.intel.health.affected', 'Affected area')}
          {': '}
          <strong>{health.affectedAreaPct}%</strong>
        </div>
      ) : null}
    </section>
  );
}

function TreatmentSection({ treatment }) {
  if (!treatment) return null;
  const Renderable = ({ titleKey, titleDefault, items, testId }) => {
    if (!items || items.length === 0) return null;
    return (
      <div data-testid={testId}>
        <div style={STYLES.subhead}>{tSafe(titleKey, titleDefault)}</div>
        <ul style={STYLES.list}>
          {items.slice(0, 5).map((it, i) => (
            <li key={testId + '-' + i}>
              {_isObj(it) ? (_str(it.title) || _str(it.text) || _str(it.label)) : _str(it)}
            </li>
          ))}
        </ul>
      </div>
    );
  };
  return (
    <section style={STYLES.card} data-testid="scan-intel-treatment">
      <h4 style={STYLES.cardTitle}>
        {tSafe('scan.intel.treatment.title', 'Treatment')}
      </h4>
      <Renderable
        titleKey="scan.intel.treatment.actions"
        titleDefault="Recommended actions"
        items={treatment.actions}
        testId="scan-intel-treatment-actions"
      />
      <Renderable
        titleKey="scan.intel.treatment.organic"
        titleDefault="Organic treatment"
        items={treatment.organic}
        testId="scan-intel-treatment-organic"
      />
      <Renderable
        titleKey="scan.intel.treatment.chemical"
        titleDefault="Chemical treatment"
        items={treatment.chemical}
        testId="scan-intel-treatment-chemical"
      />
      <Renderable
        titleKey="scan.intel.treatment.prevention"
        titleDefault="Prevention"
        items={treatment.prevention}
        testId="scan-intel-treatment-prevention"
      />
      {treatment.recovery ? (
        <div data-testid="scan-intel-treatment-recovery"
          style={{ marginTop: 10 }}>
          <div style={STYLES.subhead}>
            {tSafe('scan.intel.treatment.recovery', 'Expected recovery time')}
          </div>
          <p style={STYLES.body}>{treatment.recovery}</p>
        </div>
      ) : null}
    </section>
  );
}

function RegionSection({ region }) {
  if (!region) return null;
  return (
    <section style={STYLES.card} data-testid="scan-intel-region">
      <h4 style={STYLES.cardTitle}>
        🌦 {tSafe('scan.intel.region.title', 'Region intelligence')}
      </h4>
      <ul style={STYLES.list}>
        {region.weatherNote   ? <li>{region.weatherNote}</li>   : null}
        {region.seasonNote    ? <li>{region.seasonNote}</li>    : null}
        {region.locationNote  ? <li>{region.locationNote}</li>  : null}
        {region.cropHint      ? <li>{region.cropHint}</li>      : null}
      </ul>
    </section>
  );
}

function SoilSection({ soil }) {
  if (!soil) return null;
  return (
    <section style={STYLES.card} data-testid="scan-intel-soil">
      <h4 style={STYLES.cardTitle}>
        🌍 {tSafe('scan.intel.soil.title', 'Soil intelligence')}
      </h4>
      {soil.type ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.soil.type', 'Type')}:</strong> {soil.type}
      </div> : null}
      {soil.ph != null ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.soil.ph', 'pH')}:</strong> {soil.ph}
      </div> : null}
      {soil.drainage ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.soil.drainage', 'Drainage')}:</strong> {soil.drainage}
      </div> : null}
      {soil.organicMatter ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.soil.organic', 'Organic matter')}:</strong> {soil.organicMatter}
      </div> : null}
      {soil.suitabilityScore != null ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.soil.suitability', 'Suitability')}:</strong> {soil.suitabilityScore}/100
      </div> : null}
    </section>
  );
}

function SatelliteSection({ satellite }) {
  if (!satellite) return null;
  return (
    <section style={STYLES.card} data-testid="scan-intel-satellite">
      <h4 style={STYLES.cardTitle}>
        🛰 {tSafe('scan.intel.satellite.title', 'Field view')}
      </h4>
      {satellite.vegetationHealth ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.satellite.veg', 'Vegetation health')}:</strong> {satellite.vegetationHealth}
      </div> : null}
      {satellite.moistureRisk ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.satellite.moisture', 'Moisture risk')}:</strong> {satellite.moistureRisk}
      </div> : null}
      {satellite.heatStress ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.satellite.heat', 'Heat stress')}:</strong> {satellite.heatStress}
      </div> : null}
      {satellite.growthTrend ? <div style={STYLES.body}>
        <strong>{tSafe('scan.intel.satellite.trend', 'Growth trend')}:</strong> {satellite.growthTrend}
      </div> : null}
    </section>
  );
}

// ───────────────────────────────────────────────────────────
// Spoken summary — composed in farmer language for TTS.
// ───────────────────────────────────────────────────────────

function _buildSpokenSummary(result) {
  if (!_isObj(result)) return '';
  const ident = _extractIdentification(result);
  const health = _extractHealth(result);
  const treatment = _extractTreatment(result);
  const parts = [];
  if (ident) {
    parts.push(
      tSafe('scan.intel.voice.identified',
        'This looks like') + ' ' + ident.plantName + '.');
  }
  if (health) {
    if (health.severity) {
      parts.push(
        tSafe('scan.intel.voice.severity', 'Severity') + ': '
        + (health.severity) + '.');
    }
    if (health.issue) parts.push(health.issue + '.');
  }
  if (treatment && treatment.actions.length > 0) {
    const first = treatment.actions[0];
    const t = _isObj(first) ? (_str(first.title) || _str(first.text)) : _str(first);
    if (t) parts.push(
      tSafe('scan.intel.voice.tryAction', 'Suggested action') + ': ' + t + '.');
  }
  return parts.join(' ');
}

// ───────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────

export default function IntelligentScanResult({
  result,
  onRetake,
  onChoose,
  onSaveForReview,
  onSavePlant,
}) {
  const identification = useMemo(() => _extractIdentification(result), [result]);
  const health         = useMemo(() => _extractHealth(result),         [result]);
  const treatment      = useMemo(() => _extractTreatment(result),      [result]);
  const region         = useMemo(() => _extractRegion(result),         [result]);
  const soil           = useMemo(() => _extractSoil(result),           [result]);
  const satellite      = useMemo(() => _extractSatellite(result),      [result]);
  const needsReview    = useMemo(() => _shouldShowNeedsReview(result), [result]);

  // Permanent Detection Fix (v5) — pull the new envelope fields
  // off the result. These render UNCONDITIONALLY when present so
  // the UI never dead-ends to "Plant: —" while candidates exist.
  const _topCandidates  = _arr(result && result.topCandidates);
  const _whatWeNoticed  = _str(result && result.whatWeNoticed);
  const _whyItMatters   = _str(result && result.whyItMatters);
  const _nextActionTxt  = _str(result && result.nextAction);
  const _confidenceLabel = _str(result && result.confidenceLabel);
  const _imageQuality   = result && result.imageQuality;
  const _retakeMsg      = _imageQuality && _imageQuality.retakeGuidance;

  // Sprint #201 — Mythos trust card: when the composer produced a
  // decision, surface its multi-reason "why" + "limitations" lists
  // (these carry the farm-context rationale the single-sentence
  // whatWeNoticed can't). Additive; renders nothing when absent so
  // the gate-locked card below is unaffected.
  const _mythos        = result && result.mythosDecision;
  const _mythosWhy     = _arr(_mythos && _mythos.why);
  const _mythosLimits  = _arr(_mythos && _mythos.limitations);

  // Sprint #206 — two-sided evidence fusion. The supporting list
  // overlaps the why list (kept there); the NEW value is the
  // contradicting list — honest "what argues against this guess".
  // Renders nothing when absent so the gate-locked card is unaffected.
  const _fusion        = result && result.evidenceFusion;
  const _fusionAgainst = _arr(_fusion && _fusion.contradictingObservations);

  // Sprint #214 — trust gate. A low-confidence / poor-quality scan
  // may NOT create a plant or a task; it shows the photo coach card +
  // a Save-for-Review path instead. Pure derivation from real fields.
  const _photoQuality = _safe(() => evaluatePhotoQuality({
    imageQuality: result && result.imageQuality, objectType: result && result.objectType,
  }), null);
  const _trust = _safe(() => evaluateScanTrust({
    confidencePct: result && result.confidencePct,
    confidence: result && result.confidence,
    topCandidates: result && result.topCandidates,
    plantName: result && result.plantName,
    issueType: result && result.issueType,
    status: result && result.status,
    nextAction: result && (result.nextAction || (_mythos && _mythos.nextAction)),
    hasPhoto: !!(result && (result.imageUrl || result.scanId)),
    photoQuality: _photoQuality,
  }), null);
  const _trustBlocked = !!(_trust && !_trust.allowPlantCreation);
  // UX sprint 2026-07-05 — ONE low-confidence surface. When the trust gate blocks or the
  // result needs review, ScanGuidanceCard (directly beneath the header) is the single
  // guidance + CTA surface; the old photo-guidance card, coach card, and NeedsReviewActions
  // no longer stack on top of each other. Treatment/Region hide behind the same signal.
  const _showGuidance = _trustBlocked || needsReview;
  const _coach = _showGuidance ? _safe(() => explainPhotoQuality(_photoQuality), null) : null;

  // Sprint #207 — honest numeric confidence breakdown. Only the two
  // real contributors (image base + farm-history boost) that summed to
  // the displayed confidence. NO satellite slice (frozen → would
  // fabricate). Mirrors ScanConfidenceExplainer.buildConfidenceBreakdown.
  const _mythosConf  = _num(_mythos && _mythos.confidence);
  const _mythosBoost = _num(_mythos && _mythos.farmContextBoost);
  const _confBreakdown = (() => {
    const total = (typeof _mythosConf === 'number') ? Math.max(0, Math.min(100, _mythosConf)) : 0;
    const boost = (typeof _mythosBoost === 'number') ? Math.max(0, Math.min(total, _mythosBoost)) : 0;
    const image = Math.max(0, total - boost);
    const out = [];
    if (image > 0) out.push({ k: 'scan.evidence.image', label: 'Image evidence', points: image });
    if (boost > 0) out.push({ k: 'scan.evidence.farmHistory', label: 'Farm history', points: boost });
    return out;
  })();

  // Universal Scan (v6) — sprint #178. objectType labels the scan as
  // one of 11 categories (fruit/vegetable/leaf/crop/flower/herb/tree/
  // weed/soil_surface/seedling/unknown); issueType labels the issue
  // as one of 18 categories OR 'no_visible_issue'. Rendered as a
  // Type chip + issue chip on the identification card.
  const _objectType = _str(result && result.objectType);
  const _issueType  = _str(result && result.issueType);
  const _humanObjectType = (t) => {
    if (!t || t === 'unknown') return '';
    if (t === 'soil_surface') return 'soil surface';
    return t.replace(/_/g, ' ');
  };
  const _humanIssueType = (t) => {
    if (!t || t === 'no_visible_issue') return '';
    return t.replace(/_/g, ' ');
  };

  // SCAN TYPE ROUTER — route to the right result card. A fruit/vegetable
  // scan gets the quality card; an insect scan gets the pest card. Neither
  // renders the plant-only path (so "Unknown plant" / crop-health-only is
  // impossible here). All hooks above already ran, so this early return is
  // rules-of-hooks safe.
  const _scanType = _str(result && result.scanType);
  if (_scanType === 'fruit' || _scanType === 'vegetable') {
    return <FruitVegResultCard result={result} />;
  }
  if (_scanType === 'insect') {
    return <InsectResultCard result={result} />;
  }

  return (
    <main style={STYLES.page} data-testid="intelligent-scan-result">
      {/* Voice renders only when there IS a real result to narrate — hidden on the
          low-confidence guidance view (no diagnosis to speak) so the unified Result
          Card is the only thing on screen. VoiceHeader still self-hides when TTS is
          unavailable. */}
      {!_showGuidance ? <VoiceHeader result={result} /> : null}
      {/* THE single low-confidence surface — directly beneath the header so the next
          action is the first thing the farmer sees. Owns the Retake / Upload / Save
          CTAs and the treatment-locked note. */}
      {_showGuidance ? (
        <ScanGuidanceCard
          reasons={_coach ? _coach.whatWentWrong : null}
          confidencePct={_num(result && result.confidencePct)}
          showTreatmentLockedNote={!!(treatment || region)}
          onRetake={_isFn(onRetake) ? onRetake : undefined}
          onUpload={_isFn(onChoose) ? onChoose : undefined}
          onSaveForReview={_isFn(onSaveForReview) ? onSaveForReview : undefined}
        />
      ) : null}
      {/* Photo quality guidance — non-blocking medium-confidence case only (the
          guidance card above owns the low-confidence message). */}
      {!_showGuidance && _retakeMsg ? (
        <section style={STYLES.card} data-testid="scan-intel-quality">
          <h4 style={STYLES.cardTitle}>
            {tSafe('scan.intel.quality.title', 'Photo guidance')}
          </h4>
          <p style={STYLES.body}>{_retakeMsg}</p>
        </section>
      ) : null}
      <PlantIdentificationSection identification={identification} />
      {/* Universal Scan Type chip — labels what was scanned. Always
          renders when an objectType is present so the user sees the
          category (fruit / vegetable / leaf / crop / flower / herb /
          tree / weed / seedling / soil_surface). */}
      {_objectType && _objectType !== 'unknown' ? (
        <section style={{ ...STYLES.card, padding: '10px 14px' }}
          data-testid="scan-intel-type-chip">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap',
              alignItems: 'center' }}>
            <span style={STYLES.cardTitle}>
              {tSafe('scan.intel.type.label', 'Type')}
            </span>
            <span style={STYLES.pill}
              data-testid="scan-intel-type-chip-value">
              {_humanObjectType(_objectType)}
            </span>
            {_issueType && _issueType !== 'no_visible_issue' ? (
              <span style={STYLES.confPill('medium')}
                data-testid="scan-intel-issue-chip">
                {_humanIssueType(_issueType)}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
      {/* Permanent Top Matches — renders whenever there are
          candidates so the UI never reads "Unknown Plant" / dead-end. */}
      {_topCandidates.length > 0 ? (
        <section style={STYLES.card} data-testid="scan-intel-top-matches">
          <h4 style={{ ...STYLES.cardTitle, display: 'flex', alignItems: 'center',
              gap: 8, flexWrap: 'wrap' }}>
            {tSafe('scan.intel.topMatches.title', 'Top matches')}
            {/* Confidence badge — renders the REAL confidence band beside the title.
                Bands from confidencePct (≥70 high / ≥40 medium / else low); the
                server's own confidenceLabel wins as the text when present. */}
            {(() => {
              const pct = _num(result && result.confidencePct);
              if (pct == null && !_confidenceLabel) return null;
              const band = pct == null ? 'low' : (pct >= 70 ? 'high' : (pct >= 40 ? 'medium' : 'low'));
              const palette = band === 'high'
                ? { bg: '#ECFDF5', ink: '#065F46', line: '#A7F3D0' }
                : band === 'medium'
                  ? { bg: '#FFFBEB', ink: '#92400E', line: '#FDE68A' }
                  : { bg: '#FEF2F2', ink: '#991B1B', line: '#FECACA' };
              const text = _confidenceLabel
                || (band === 'high' ? tSafe('scan.confidence.high', 'High confidence')
                  : band === 'medium' ? tSafe('scan.confidence.medium', 'Medium confidence')
                    : tSafe('scan.confidence.low', 'Low confidence'));
              return (
                <span data-testid="scan-confidence-badge"
                  aria-label={text}
                  style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px',
                    borderRadius: 999, background: palette.bg, color: palette.ink,
                    border: '1px solid ' + palette.line, whiteSpace: 'nowrap' }}>
                  {text}
                </span>
              );
            })()}
          </h4>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {_topCandidates.slice(0, 5).map((c, i) => {
              const name  = _str(c && c.commonName) || _str(c && c.scientificName) || _str(c && c.name) || '—';
              const sci   = _str(c && c.scientificName);
              const score = _num(c && c.score);
              return (
                <li key={i} style={{ fontSize: 14, color: '#1F2933',
                    lineHeight: 1.5 }}
                  data-testid={'scan-intel-top-match-' + i}>
                  <strong>{name}</strong>
                  {sci && sci !== name ? <em style={{ color: '#64748B', fontStyle: 'italic',
                      marginLeft: 6 }}>{sci}</em> : null}
                  {score != null ? <span style={{ color: '#94A3B8',
                      marginLeft: 6 }}>· {Math.round(score * 100)}%</span> : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
      {/* What we noticed / Why it matters — narrative bridge */}
      {(_whatWeNoticed || _whyItMatters) ? (
        <section style={STYLES.card} data-testid="scan-intel-noticed">
          {_whatWeNoticed ? (
            <>
              <h4 style={STYLES.cardTitle}>
                {tSafe('scan.intel.noticed.title', 'What we noticed')}
              </h4>
              <p style={STYLES.body} data-testid="scan-intel-noticed-text">
                {_whatWeNoticed}
              </p>
            </>
          ) : null}
          {_whyItMatters ? (
            <p style={{ ...STYLES.body, marginTop: 8, color: '#64748B' }}
              data-testid="scan-intel-why">
              {_whyItMatters}
            </p>
          ) : null}
        </section>
      ) : null}
      {/* Sprint #201 — Mythos "Why we think this" + "Good to know".
          Multi-reason explainability incl. farm-context rationale. */}
      {(_mythosWhy.length > 0 || _mythosLimits.length > 0) ? (
        <section style={STYLES.card} data-testid="scan-intel-mythos-why">
          {_mythosWhy.length > 0 ? (
            <>
              <h4 style={STYLES.cardTitle}>
                {tSafe('scan.why', 'Why we think this')}
              </h4>
              <ul style={STYLES.list} data-testid="scan-intel-mythos-why-list">
                {_mythosWhy.slice(0, 5).map((w, i) => (
                  <li key={'mw-' + i}>{_str(w)}</li>
                ))}
              </ul>
            </>
          ) : null}
          {/* Sprint #207 — honest confidence breakdown (real
              contributors only; no fabricated satellite slice). */}
          {_confBreakdown.length > 0 ? (
            <>
              <div style={STYLES.subhead}>
                {tSafe('scan.evidence.breakdown', 'How sure we are')}
              </div>
              <ul style={STYLES.list} data-testid="scan-intel-confidence-breakdown">
                {_confBreakdown.map((b, i) => (
                  <li key={'cb-' + i}>
                    {tSafe(b.k, b.label)}: {b.points}%
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {_mythosLimits.length > 0 ? (
            <>
              <div style={STYLES.subhead}>
                {tSafe('scan.limitations', 'Good to know')}
              </div>
              <ul style={STYLES.list} data-testid="scan-intel-mythos-limits-list">
                {_mythosLimits.slice(0, 4).map((l, i) => (
                  <li key={'ml-' + i} style={{ color: '#64748B' }}>{_str(l)}</li>
                ))}
              </ul>
            </>
          ) : null}
          {/* Sprint #206 — contradicting observations (honest doubts). */}
          {_fusionAgainst.length > 0 ? (
            <>
              <div style={STYLES.subhead}>
                {tSafe('scan.evidence.against', 'What could change this')}
              </div>
              <ul style={STYLES.list} data-testid="scan-intel-evidence-against-list">
                {_fusionAgainst.slice(0, 4).map((c, i) => (
                  <li key={'ea-' + i} style={{ color: '#92400E' }}>{_str(c)}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : (_fusionAgainst.length > 0 ? (
        <section style={STYLES.card} data-testid="scan-intel-evidence-against">
          <div style={STYLES.subhead}>
            {tSafe('scan.evidence.against', 'What could change this')}
          </div>
          <ul style={STYLES.list} data-testid="scan-intel-evidence-against-list">
            {_fusionAgainst.slice(0, 4).map((c, i) => (
              <li key={'ea2-' + i} style={{ color: '#92400E' }}>{_str(c)}</li>
            ))}
          </ul>
        </section>
      ) : null)}
      <FlowerSection identification={identification} result={result} />
      <CropHealthSection health={health} />
      {/* Treatment + Region hide on low confidence — the guidance card explains why
          ("Once we can clearly identify the plant…"). Never advice on a shaky ID. */}
      {!_showGuidance ? <TreatmentSection treatment={treatment} /> : null}
      {!_showGuidance ? <RegionSection region={region} /> : null}
      <SoilSection soil={soil} />
      <SatelliteSection satellite={satellite} />
      {/* Permanent Action Row — Create task / Scan again / Save for review. Present
          after every CONFIDENT result so the user never dead-ends. On low confidence
          the ScanGuidanceCard beneath the header owns the CTAs (UX sprint 2026-07-05 —
          the old coach card that duplicated them here is gone). */}
      {!_showGuidance ? (
      <section style={STYLES.card} data-testid="scan-intel-actions">
        {_nextActionTxt ? (
          <p style={{ ...STYLES.body, fontWeight: 700,
              marginBottom: 12, color: '#1F2933' }}
            data-testid="scan-intel-next-action">
            {tSafe('scan.intel.next.title', 'Do this next')}: {_nextActionTxt}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Create task — gated by the trust gate (#214). Hidden when
              the scan is unclear / low-confidence. */}
          {_trust && _trust.allowTaskCreation ? (
            <button type="button"
              style={STYLES.confPill('high')}
              data-testid="scan-intel-create-task"
              onClick={() => { /* hook for future task-creation; renders link */ }}>
              {tSafe('scan.intel.action.task', 'Create task')}
            </button>
          ) : null}
          <button type="button"
            style={STYLES.pill}
            data-testid="scan-intel-scan-again"
            onClick={_isFn(onRetake) ? onRetake : undefined}>
            {tSafe('scan.intel.action.again', 'Scan again')}
          </button>
          <button type="button"
            style={STYLES.pill}
            data-testid="scan-intel-save-review"
            onClick={_isFn(onSaveForReview) ? onSaveForReview : undefined}>
            {tSafe('scan.intel.action.review', 'Save for review')}
          </button>
          {/* Universal Scan §7 — Save plant. Adds the identified
              plant to the grower's "My Plants" log. Sprint #214: also
              requires the trust gate to allow plant creation. */}
          {_objectType && _objectType !== 'unknown' && _trust && _trust.allowPlantCreation ? (
            <button type="button"
              style={STYLES.pill}
              data-testid="scan-intel-save-plant"
              onClick={_isFn(onSavePlant) ? onSavePlant : undefined}>
              {tSafe('scan.intel.action.savePlant', 'Save plant')}
            </button>
          ) : null}
        </div>
      </section>
      ) : null}
      {/* NeedsReviewActions removed (UX sprint 2026-07-05) — ScanGuidanceCard beneath
          the header is the single needs-review surface; no more stacked duplicates. */}
    </main>
  );
}
