/**
 * Centralized Task Presentation Layer
 *
 * Maps task types to icons, labels, voice prompts, action buttons, and colors.
 * Used by mode-aware components to render tasks consistently across basic/standard modes.
 *
 * Basic mode:  icon-first, voice-primary, minimal text
 * Standard mode: icon + short text, quick actions
 */

// ─── Task Icon Map ─────────────────────────────────────────
// Large emoji icons for each task type. Basic mode shows these BIG.
export const taskIconMap = {
  watering:    '💧',
  planting:    '🌱',
  spraying:    '💨',
  fertilizing: '🧪',
  weeding:     '🌿',
  harvest:     '🌾',
  pruning:     '✂️',
  mulching:    '🍂',
  scouting:    '🔍',
  soil_test:   '🧫',
  irrigation:  '🚿',
  storage:     '📦',
  selling:     '💰',
  default:     '🎯',
};

/**
 * Get the icon for a task. Falls back to default.
 * @param {object} task - Task object (may have actionType, category, or title)
 * @returns {string} emoji
 */
export function getTaskIcon(task) {
  if (!task) return taskIconMap.default;
  // Try actionType first
  if (task.actionType && taskIconMap[task.actionType]) {
    return taskIconMap[task.actionType];
  }
  // Try to infer from title keywords
  const title = (task.title || '').toLowerCase();
  if (title.includes('water') || title.includes('irrigat')) return taskIconMap.watering;
  if (title.includes('plant') || title.includes('sow') || title.includes('seed')) return taskIconMap.planting;
  if (title.includes('spray')) return taskIconMap.spraying;
  if (title.includes('fertiliz') || title.includes('fertilis') || title.includes('manure')) return taskIconMap.fertilizing;
  if (title.includes('weed')) return taskIconMap.weeding;
  if (title.includes('harvest') || title.includes('pick') || title.includes('reap')) return taskIconMap.harvest;
  if (title.includes('prun') || title.includes('trim') || title.includes('cut')) return taskIconMap.pruning;
  if (title.includes('mulch')) return taskIconMap.mulching;
  if (title.includes('scout') || title.includes('check') || title.includes('inspect')) return taskIconMap.scouting;
  if (title.includes('soil') || title.includes('test')) return taskIconMap.soil_test;
  if (title.includes('stor')) return taskIconMap.storage;
  if (title.includes('sell') || title.includes('market')) return taskIconMap.selling;
  return taskIconMap.default;
}

// ─── Task Label Map (translation keys) ────────────────────
// Short action-first labels. Standard mode shows icon + label.
export const taskLabelKeys = {
  watering:    'task.label.watering',
  planting:    'task.label.planting',
  spraying:    'task.label.spraying',
  fertilizing: 'task.label.fertilizing',
  weeding:     'task.label.weeding',
  harvest:     'task.label.harvest',
  pruning:     'task.label.pruning',
  mulching:    'task.label.mulching',
  scouting:    'task.label.scouting',
  soil_test:   'task.label.soilTest',
  irrigation:  'task.label.irrigation',
  storage:     'task.label.storage',
  selling:     'task.label.selling',
  default:     'task.label.farmTask',
};

/**
 * Get the translation key for a task label.
 */
export function getTaskLabelKey(task) {
  if (task?.actionType && taskLabelKeys[task.actionType]) {
    return taskLabelKeys[task.actionType];
  }
  return taskLabelKeys.default;
}

// ─── Task Voice Map (prompt IDs for voiceService) ─────────
// Maps task types to voicePrompts IDs. Use with voiceService.speakPrompt().
// Legacy i18n keys (task.voice.*) are bridged in voicePrompts.js KEY_TO_PROMPT.
export const taskVoiceKeys = {
  watering:    'task.water',
  planting:    'task.plant',
  spraying:    'task.spray',
  fertilizing: 'task.fertilize',
  weeding:     'task.weed',
  harvest:     'task.harvest',
  pruning:     'task.prune',
  scouting:    'task.scout',
  default:     'task.default',
};

/**
 * Get the voice prompt ID for a task.
 * Returns a prompt ID usable with voiceService.speakPrompt().
 */
export function getTaskVoiceKey(task) {
  if (task?.actionType && taskVoiceKeys[task.actionType]) {
    return taskVoiceKeys[task.actionType];
  }
  return taskVoiceKeys.default;
}

// ─── Task Action Button Map (translation keys) ───────────
// CTA text when completing a task.
export const taskActionKeys = {
  watering:    'taskAction.iWatered',
  planting:    'taskAction.iPlanted',
  spraying:    'taskAction.iSprayed',
  harvest:     'taskAction.iHarvested',
  default:     'taskAction.markDone',
};

/**
 * Get the action button translation key.
 */
export function getTaskActionKey(task) {
  if (task?.actionType && taskActionKeys[task.actionType]) {
    return taskActionKeys[task.actionType];
  }
  return taskActionKeys.default;
}

// ─── Task Color Map ────────────────────────────────────────
// Priority-based colors for badges and accents.
// High uses amber — red is reserved for block/danger states only.
export const priorityColors = {
  high:   { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.2)' },
  medium: { text: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.15)' },
  low:    { text: '#6B7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.15)' },
};

/**
 * Get priority color set.
 */
export function getPriorityColors(priority) {
  return priorityColors[priority] || priorityColors.low;
}

// ─── Task action type colors (for icon backgrounds) ───────
export const actionTypeColors = {
  watering:    'rgba(59,130,246,0.15)',
  planting:    'rgba(34,197,94,0.15)',
  spraying:    'rgba(168,85,247,0.15)',
  fertilizing: 'rgba(245,158,11,0.15)',
  weeding:     'rgba(16,185,129,0.15)',
  harvest:     'rgba(251,191,36,0.15)',
  pruning:     'rgba(239,68,68,0.15)',
  scouting:    'rgba(99,102,241,0.15)',
  default:     'rgba(34,197,94,0.12)',
};

/**
 * Get icon background color for a task.
 */
export function getTaskIconBg(task) {
  if (task?.actionType && actionTypeColors[task.actionType]) {
    return actionTypeColors[task.actionType];
  }
  return actionTypeColors.default;
}
