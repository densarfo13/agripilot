/**
 * communityTranslations.js — i18n overlay for the community / grow-share
 * surface. Same `key → { locale: value }` shape as the other overlays.
 *
 * English-only base. Other locales (tw / ha / fr / sw / hi) fall back at
 * render time via tSafe and are flagged for translator review — we do NOT
 * invent agricultural terms in those languages.
 */

const en = (s) => Object.freeze({ en: s });

export const COMMUNITY_TRANSLATION_NAMESPACES = Object.freeze(['community']);

export const COMMUNITY_TRANSLATIONS = Object.freeze({
  // ── page chrome ─────────────────────────────────────────────
  'community.title': en('Community'),
  'community.subtitle': en('See grow updates from other gardeners and farmers. Private by default — your posts are only shared when you choose.'),
  'community.empty': en('No posts yet. Share a grow update from a plant profile or the journal to start the conversation.'),
  'community.footnote': en('Precise GPS, phone, email and farm address are never shared. Buyer accounts cannot see private grower data.'),
  'community.filters': en('Filters'),
  'community.anonAuthor': en('Anonymous gardener'),
  'community.showMore': en('Show more'),
  'community.shareUpdate': en('Share Update'),
  'community.shareProgress': en('Share Progress'),

  // ── share modal ─────────────────────────────────────────────
  'community.close': en('Close'),
  'community.cancel': en('Cancel'),
  'community.share': en('Share'),
  'community.sharing': en('Sharing…'),
  'community.postType': en('Type'),
  'community.title.label': en('Title (optional)'),
  'community.notes': en('Notes'),
  'community.include': en('Include'),
  'community.includeGrowthStage': en('Growth stage'),
  'community.includeHealthStatus': en('Health status'),
  'community.includeScanResult': en('Scan result summary'),
  'community.noScan': en('no recent scan'),
  'community.visibility': en('Who can see this'),
  'community.confirmPublic': en('I understand this post will be available via a public link.'),
  'community.confirmPublic.required': en('Public posts need a confirmation. Tick the box below to confirm.'),

  // ── visibility levels (§2) ─────────────────────────────────
  'community.visibility.private': en('Only me'),
  'community.visibility.organization': en('My organization'),
  'community.visibility.community': en('Farroway community'),
  'community.visibility.public': en('Public link'),

  // ── post types ─────────────────────────────────────────────
  'community.type.plant_update': en('Progress update'),
  'community.type.before_after': en('Before and After'),
  'community.type.harvest': en('Harvest'),
  'community.type.milestone': en('Milestone'),
  'community.type.question': en('Question'),

  // ── feed actions ───────────────────────────────────────────
  'community.like': en('Like'),
  'community.comment': en('Comment'),
  'community.report': en('Report'),
  'community.hide': en('Hide'),
  'community.reportPrompt': en('Why are you reporting this post?'),

  // ── feed filter chips ──────────────────────────────────────
  'community.filter.all': en('All'),
  'community.filter.vegetables': en('Vegetables'),
  'community.filter.flowers': en('Flowers'),
  'community.filter.herbs': en('Herbs'),
  'community.filter.fruit': en('Fruit'),
  'community.filter.field_crops': en('Field Crops'),
  'community.filter.questions': en('Questions'),
  'community.filter.harvests': en('Harvests'),
});
