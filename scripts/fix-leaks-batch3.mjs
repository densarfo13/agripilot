// fix-leaks-batch3.mjs — third screenshot batch (My Farm status card, Farms/Gardens
// toggle, Activity empty state, Funding filters, buyer-visibility chip) + fixes the
// Hausa nav collision (Tasks and Activity both rendered "Ayyuka" → Activity="Tarihi").
import fs from 'node:fs';
const T = {
  'T-en': {
    'experienceTabs.aria': 'Switch between farms and gardens', 'experienceTabs.farms': 'Farms', 'experienceTabs.gardens': 'Gardens',
    'commandCenter.farmStatus': 'Farm status', 'commandCenter.crop': 'Crop', 'commandCenter.stage': 'Stage',
    'commandCenter.health': 'Health', 'commandCenter.risk': 'Risk', 'commandCenter.harvestWindow': 'Harvest window',
    'commandCenter.empty': 'Not enough data yet',
    'activity.empty.title': 'No activity yet', 'activity.empty.body': 'Scan or add your first plant to see your activity timeline.',
    'activity.empty.scan': 'Scan Plant', 'activity.empty.add': 'Add Plant',
    'funding.filter.all': 'All', 'funding.filter.farmer': 'Farmer', 'funding.filter.backyard': 'Backyard',
    'funding.filter.cropPlaceholder': 'Crop or keyword…', 'funding.filter.regionPlaceholder': 'Region or country…',
    'trust.buyerVisibility': 'Buyer visibility improves with complete listings',
  },
  'T-fr': {
    'experienceTabs.aria': 'Basculer entre fermes et jardins', 'experienceTabs.farms': 'Fermes', 'experienceTabs.gardens': 'Jardins',
    'commandCenter.farmStatus': 'État de la ferme', 'commandCenter.crop': 'Culture', 'commandCenter.stage': 'Stade',
    'commandCenter.health': 'Santé', 'commandCenter.risk': 'Risque', 'commandCenter.harvestWindow': 'Période de récolte',
    'commandCenter.empty': 'Pas encore assez de données',
    'activity.empty.title': "Aucune activité pour l'instant", 'activity.empty.body': 'Scannez ou ajoutez votre première plante pour voir votre historique.',
    'activity.empty.scan': 'Scanner une plante', 'activity.empty.add': 'Ajouter une plante',
    'funding.filter.all': 'Tout', 'funding.filter.farmer': 'Agriculteur', 'funding.filter.backyard': 'Jardin',
    'funding.filter.cropPlaceholder': 'Culture ou mot-clé…', 'funding.filter.regionPlaceholder': 'Région ou pays…',
    'trust.buyerVisibility': 'Des annonces complètes attirent plus d’acheteurs',
  },
  'T-sw': {
    'experienceTabs.aria': 'Badilisha kati ya mashamba na bustani', 'experienceTabs.farms': 'Mashamba', 'experienceTabs.gardens': 'Bustani',
    'commandCenter.farmStatus': 'Hali ya shamba', 'commandCenter.crop': 'Zao', 'commandCenter.stage': 'Hatua',
    'commandCenter.health': 'Afya', 'commandCenter.risk': 'Hatari', 'commandCenter.harvestWindow': 'Kipindi cha mavuno',
    'commandCenter.empty': 'Bado hakuna data ya kutosha',
    'activity.empty.title': 'Hakuna shughuli bado', 'activity.empty.body': 'Scan au ongeza mmea wako wa kwanza kuona historia ya shughuli.',
    'activity.empty.scan': 'Scan mmea', 'activity.empty.add': 'Ongeza mmea',
    'funding.filter.all': 'Zote', 'funding.filter.farmer': 'Mkulima', 'funding.filter.backyard': 'Bustani',
    'funding.filter.cropPlaceholder': 'Zao au neno…', 'funding.filter.regionPlaceholder': 'Eneo au nchi…',
    'trust.buyerVisibility': 'Orodha kamili huvutia wanunuzi zaidi',
  },
  'T-ha': {
    'experienceTabs.aria': 'Sauya tsakanin gonaki da lambuna', 'experienceTabs.farms': 'Gonaki', 'experienceTabs.gardens': 'Lambuna',
    'commandCenter.farmStatus': 'Halin gona', 'commandCenter.crop': 'Amfani', 'commandCenter.stage': 'Mataki',
    'commandCenter.health': 'Lafiya', 'commandCenter.risk': 'Hadari', 'commandCenter.harvestWindow': 'Lokacin girbi',
    'commandCenter.empty': 'Babu isassun bayanai tukuna',
    'activity.empty.title': 'Babu wani aiki tukuna', 'activity.empty.body': 'Yi scan ko kara shukarka ta farko don ganin tarihin ayyukanka.',
    'activity.empty.scan': 'Yi scan din shuka', 'activity.empty.add': 'Kara shuka',
    'funding.filter.all': 'Duka', 'funding.filter.farmer': 'Manomi', 'funding.filter.backyard': 'Lambu',
    'funding.filter.cropPlaceholder': 'Amfani ko kalma…', 'funding.filter.regionPlaceholder': 'Yanki ko kasa…',
    'trust.buyerVisibility': 'Cikakken jeri yana jan hankalin masu siye',
  },
  'T-tw': {
    'experienceTabs.aria': 'Sesa fi mfuo kɔ nturo', 'experienceTabs.farms': 'Mfuo', 'experienceTabs.gardens': 'Nturo',
    'commandCenter.farmStatus': 'Afuo no tebea', 'commandCenter.crop': 'Nnɔbae', 'commandCenter.stage': 'Ɛberɛ',
    'commandCenter.health': 'Apɔmuden', 'commandCenter.risk': 'Asiane', 'commandCenter.harvestWindow': 'Otwabere',
    'commandCenter.empty': 'Data nnɔɔso ɛ',
    'activity.empty.title': 'Dwumadie biara nni hɔ ɛ', 'activity.empty.body': 'Scan anaa fa wo afifide a edi kan ka ho na woahu wo dwumadie abakɔsɛm.',
    'activity.empty.scan': 'Scan afifide', 'activity.empty.add': 'Fa afifide ka ho',
    'funding.filter.all': 'Ne nyinaa', 'funding.filter.farmer': 'Okuafo', 'funding.filter.backyard': 'Turo',
    'funding.filter.cropPlaceholder': 'Nnɔbae anaa asɛmfua…', 'funding.filter.regionPlaceholder': 'Mpɔtam anaa ɔman…',
    'trust.buyerVisibility': 'Nsɛm a edi mu twetwe atɔfo pii',
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
    src = src.slice(0, idx) + '  // ── Visible-leak fix batch 3 (2026-07-01): My Farm status / tabs / activity / funding filters ──\n'
      + lines.join('\n') + '\n' + src.slice(idx);
  }
  // Hausa nav collision: Tasks + Activity both "Ayyuka" → Activity becomes "Tarihi".
  if (col === 'T-ha') src = src.replace('"nav.activity": "Ayyuka"', '"nav.activity": "Tarihi"');
  fs.writeFileSync(file, src);
  console.log(col + ': added ' + lines.length);
}
