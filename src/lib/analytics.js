import { trackEvent } from './api.js';

export function safeTrackEvent(event, metadata) {
  try {
    trackEvent(event, metadata).catch(() => {});
  } catch {
    // Analytics should never block the UI
  }
}
