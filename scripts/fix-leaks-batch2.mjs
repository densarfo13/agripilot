// fix-leaks-batch2.mjs — second screenshot-verified leak batch: greeting role labels,
// nav Activity tab, weather condition fallbacks. 6 keys × en/fr/sw/ha/tw. Idempotent.
import fs from 'node:fs';
const T = {
  'T-en': {
    'role.farmer': 'Farmer', 'gardenMode.userLabel': 'Gardener', 'nav.activity': 'Activity',
    'home.weather.hotDay': 'Hot day', 'home.weather.dryDay': 'Dry day', 'home.weather.mostlyClear': 'Mostly clear',
  },
  'T-fr': {
    'role.farmer': 'Agriculteur', 'gardenMode.userLabel': 'Jardinier', 'nav.activity': 'Activité',
    'home.weather.hotDay': 'Journée chaude', 'home.weather.dryDay': 'Journée sèche', 'home.weather.mostlyClear': 'Plutôt dégagé',
  },
  'T-sw': {
    'role.farmer': 'Mkulima', 'gardenMode.userLabel': 'Mtunza bustani', 'nav.activity': 'Shughuli',
    'home.weather.hotDay': 'Siku ya joto', 'home.weather.dryDay': 'Siku kavu', 'home.weather.mostlyClear': 'Anga wazi kwa kiasi',
  },
  'T-ha': {
    'role.farmer': 'Manomi', 'gardenMode.userLabel': 'Mai lambu', 'nav.activity': 'Ayyuka',
    'home.weather.hotDay': 'Ranar zafi', 'home.weather.dryDay': 'Ranar rani', 'home.weather.mostlyClear': 'Sararin sama a sarari',
  },
  'T-tw': {
    'role.farmer': 'Okuafo', 'gardenMode.userLabel': 'Turo hwɛfo', 'nav.activity': 'Dwumadie',
    'home.weather.hotDay': 'Ɔhyew da', 'home.weather.dryDay': 'Ɔpɛ da', 'home.weather.mostlyClear': 'Ewim tew kakra',
  },
};
for (const [col, table] of Object.entries(T)) {
  const file = 'src/i18n/columns/' + col + '.js';
  let src = fs.readFileSync(file, 'utf8');
  const lines = [];
  for (const [k, v] of Object.entries(table)) {
    if (src.includes('"' + k + '"')) continue;
    lines.push('  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',');
  }
  if (lines.length) {
    const idx = src.lastIndexOf('};');
    src = src.slice(0, idx) + '  // ── Visible-leak fix batch 2 (2026-07-01): greeting roles + nav + weather fallbacks ──\n'
      + lines.join('\n') + '\n' + src.slice(idx);
    fs.writeFileSync(file, src);
  }
  console.log(col + ': added ' + lines.length);
}
