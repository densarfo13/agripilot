// Generates per-crop illustration SVGs in /public/crops/.
// Shared canvas + palette; distinct silhouettes per crop.
// Throw-away script; not imported by the app.
import fs from 'fs';
import path from 'path';

function svg(label, silhouette) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="70%">
      <stop offset="0%" stop-color="#1B3A2A"/>
      <stop offset="70%" stop-color="#0F2133"/>
      <stop offset="100%" stop-color="#0B1D34"/>
    </radialGradient>
    <linearGradient id="crop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#CDEF4A"/>
      <stop offset="50%" stop-color="#8AD648"/>
      <stop offset="100%" stop-color="#45B845"/>
    </linearGradient>
    <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#F59E0B"/>
    </linearGradient>
    <linearGradient id="red" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FCA5A5"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
    <linearGradient id="brown" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#D6A77A"/>
      <stop offset="100%" stop-color="#8B5E3C"/>
    </linearGradient>
  </defs>
  <rect width="240" height="240" fill="url(#bg)"/>
  ${silhouette}
</svg>
`;
}

const CROPS = [
  ['cassava', 'Cassava', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M100 115 Q 70 90 55 105 Q 75 125 100 120 Z" fill="url(#crop)"/>
      <path d="M140 115 Q 170 90 185 105 Q 165 125 140 120 Z" fill="url(#crop)"/>
      <path d="M120 95 Q 110 60 120 40 Q 130 60 120 95 Z" fill="url(#crop)"/>
      <path d="M120 130 Q 90 140 95 175 Q 105 205 120 210 Q 135 205 145 175 Q 150 140 120 130 Z" fill="url(#brown)"/>
    </g>`],
  ['maize', 'Maize', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M95 90 Q 70 80 55 105 Q 80 95 95 115 Z" fill="url(#crop)"/>
      <path d="M145 90 Q 170 80 185 105 Q 160 95 145 115 Z" fill="url(#crop)"/>
      <path d="M120 70 L 150 100 L 148 200 Q 140 215 120 215 Q 100 215 92 200 L 90 100 Z" fill="url(#warm)"/>
      <g fill="#F59E0B" opacity="0.6">
        <circle cx="108" cy="130" r="5"/><circle cx="120" cy="130" r="5"/><circle cx="132" cy="130" r="5"/>
        <circle cx="108" cy="150" r="5"/><circle cx="120" cy="150" r="5"/><circle cx="132" cy="150" r="5"/>
        <circle cx="108" cy="170" r="5"/><circle cx="120" cy="170" r="5"/><circle cx="132" cy="170" r="5"/>
        <circle cx="108" cy="190" r="5"/><circle cx="120" cy="190" r="5"/><circle cx="132" cy="190" r="5"/>
      </g>
    </g>`],
  ['rice', 'Rice', `
    <g>
      <path d="M120 210 L 120 70" stroke="#45B845" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M120 70 Q 80 55 60 85" stroke="#CDEF4A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M120 70 Q 160 55 180 85" stroke="#CDEF4A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M120 85 Q 95 75 80 100" stroke="#CDEF4A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <path d="M120 85 Q 145 75 160 100" stroke="#CDEF4A" stroke-width="3" stroke-linecap="round" fill="none"/>
      <g fill="url(#warm)" stroke="#0a2015" stroke-width="1">
        <ellipse cx="60" cy="85" rx="7" ry="4" transform="rotate(-25 60 85)"/>
        <ellipse cx="180" cy="85" rx="7" ry="4" transform="rotate(25 180 85)"/>
        <ellipse cx="80" cy="100" rx="7" ry="4" transform="rotate(-25 80 100)"/>
        <ellipse cx="160" cy="100" rx="7" ry="4" transform="rotate(25 160 100)"/>
        <ellipse cx="90" cy="65" rx="6" ry="4" transform="rotate(-25 90 65)"/>
        <ellipse cx="150" cy="65" rx="6" ry="4" transform="rotate(25 150 65)"/>
      </g>
    </g>`],
  ['tomato', 'Tomato', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <circle cx="120" cy="140" r="60" fill="url(#red)"/>
      <path d="M120 80 L 105 60 L 95 75 L 85 60 L 90 80 L 75 85 L 95 95 L 85 105 L 105 100 L 110 115 L 120 100 L 130 115 L 135 100 L 155 105 L 145 95 L 165 85 L 150 80 L 155 60 L 145 75 L 135 60 Z" fill="url(#crop)"/>
      <path d="M120 95 L 120 80" stroke="#45B845" stroke-width="4" stroke-linecap="round"/>
    </g>`],
  ['onion', 'Onion', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M120 70 Q 110 30 100 20" fill="none" stroke="#45B845" stroke-width="5" stroke-linecap="round"/>
      <path d="M120 70 Q 120 35 115 15" fill="none" stroke="#45B845" stroke-width="5" stroke-linecap="round"/>
      <path d="M120 70 Q 130 30 140 20" fill="none" stroke="#45B845" stroke-width="5" stroke-linecap="round"/>
      <path d="M70 120 Q 75 90 120 85 Q 165 90 170 120 Q 170 195 120 210 Q 70 195 70 120 Z" fill="url(#warm)"/>
      <path d="M95 100 Q 110 180 105 205" fill="none" stroke="#D6A77A" stroke-width="2" opacity="0.6"/>
      <path d="M145 100 Q 130 180 135 205" fill="none" stroke="#D6A77A" stroke-width="2" opacity="0.6"/>
    </g>`],
  ['pepper', 'Pepper', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M100 60 L 120 50 L 140 60 L 135 80" fill="url(#crop)"/>
      <path d="M125 75 Q 80 100 85 160 Q 95 215 140 210 Q 175 195 170 155 Q 165 95 125 75 Z" fill="url(#red)"/>
      <path d="M130 100 Q 105 130 105 165" fill="none" stroke="#fff" stroke-width="3" opacity="0.2"/>
    </g>`],
  ['okra', 'Okra', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M100 50 L 120 40 L 140 50 L 135 75" fill="url(#crop)"/>
      <path d="M135 75 Q 145 110 148 150 Q 145 190 125 215 Q 110 215 105 180 Q 105 130 115 75 Z" fill="url(#crop)"/>
      <path d="M120 90 L 120 200" fill="none" stroke="#0a2015" stroke-width="1.5" opacity="0.4"/>
      <path d="M110 100 Q 105 140 115 190" fill="none" stroke="#0a2015" stroke-width="1" opacity="0.3"/>
      <path d="M130 100 Q 135 140 130 190" fill="none" stroke="#0a2015" stroke-width="1" opacity="0.3"/>
    </g>`],
  ['potato', 'Potato', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M90 80 Q 80 70 90 55 Q 100 55 100 70" fill="url(#crop)"/>
      <path d="M110 65 Q 110 50 120 45 Q 130 50 125 70" fill="url(#crop)"/>
      <ellipse cx="120" cy="135" rx="70" ry="60" fill="url(#brown)"/>
      <g fill="#8B5E3C">
        <circle cx="95" cy="120" r="4"/>
        <circle cx="130" cy="110" r="4"/>
        <circle cx="150" cy="140" r="4"/>
        <circle cx="100" cy="160" r="4"/>
        <circle cx="140" cy="170" r="4"/>
      </g>
    </g>`],
  ['sweet-potato', 'Sweet potato', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M70 90 Q 60 60 90 50 Q 100 80 80 95 Z" fill="url(#crop)"/>
      <path d="M110 55 Q 120 30 140 45 Q 130 75 115 75 Z" fill="url(#crop)"/>
      <path d="M55 165 Q 45 130 75 120 Q 115 100 155 115 Q 200 130 195 165 Q 185 205 150 215 Q 100 215 65 200 Q 50 185 55 165 Z" fill="#C07858"/>
      <path d="M80 140 Q 120 155 180 145" fill="none" stroke="#8B5E3C" stroke-width="1.5" opacity="0.5"/>
      <path d="M70 175 Q 120 190 175 175" fill="none" stroke="#8B5E3C" stroke-width="1.5" opacity="0.5"/>
    </g>`],
  ['banana', 'Banana', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M60 170 Q 70 90 150 60 Q 175 55 185 65 Q 185 80 160 85 Q 95 110 90 170 Q 85 195 70 195 Q 55 195 60 170 Z" fill="url(#warm)"/>
      <path d="M165 60 L 175 50 L 180 60" fill="#45B845"/>
    </g>`],
  ['plantain', 'Plantain', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M55 180 Q 65 80 150 50 Q 180 45 195 60 Q 190 80 160 85 Q 85 110 85 180 Q 80 205 65 205 Q 50 205 55 180 Z" fill="url(#crop)"/>
      <path d="M170 50 L 180 40 L 190 55" fill="#45B845"/>
      <path d="M80 140 Q 100 130 130 115" fill="none" stroke="#0a2015" stroke-width="1.5" opacity="0.4"/>
    </g>`],
  ['cocoa', 'Cocoa', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M90 80 Q 100 60 120 65 Q 140 60 150 80 Q 170 130 155 185 Q 140 215 120 215 Q 100 215 85 185 Q 70 130 90 80 Z" fill="#B45309"/>
      <path d="M105 90 Q 110 130 105 180" fill="none" stroke="#78350F" stroke-width="2" opacity="0.7"/>
      <path d="M120 85 Q 120 130 120 195" fill="none" stroke="#78350F" stroke-width="2" opacity="0.7"/>
      <path d="M135 90 Q 130 130 135 180" fill="none" stroke="#78350F" stroke-width="2" opacity="0.7"/>
      <path d="M120 65 L 120 45 L 105 35 M120 45 L 135 35" fill="none" stroke="#45B845" stroke-width="4" stroke-linecap="round"/>
    </g>`],
  ['mango', 'Mango', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M120 70 Q 180 80 195 140 Q 180 200 120 210 Q 70 200 65 145 Q 70 90 120 70 Z" fill="url(#warm)"/>
      <path d="M120 70 L 110 55 Q 90 45 70 55 Q 85 75 115 75" fill="#45B845"/>
      <circle cx="150" cy="110" r="12" fill="#FFF" opacity="0.25"/>
    </g>`],
  ['groundnut', 'Groundnut', `
    <g stroke="#0a2015" stroke-width="2" stroke-linejoin="round">
      <path d="M110 95 Q 105 75 90 75 Q 85 85 95 95" fill="url(#crop)"/>
      <path d="M130 95 Q 135 75 150 75 Q 155 85 145 95" fill="url(#crop)"/>
      <path d="M75 140 Q 70 110 95 100 Q 115 100 120 120 Q 125 100 145 100 Q 170 110 165 140 Q 170 170 150 185 Q 120 175 120 155 Q 120 175 90 185 Q 70 170 75 140 Z" fill="url(#brown)"/>
      <circle cx="100" cy="135" r="4" fill="#8B5E3C"/>
      <circle cx="140" cy="135" r="4" fill="#8B5E3C"/>
      <circle cx="100" cy="165" r="4" fill="#8B5E3C"/>
      <circle cx="140" cy="165" r="4" fill="#8B5E3C"/>
    </g>`],
];

const outDir = 'public/crops';
let written = 0;
for (const [key, label, silhouette] of CROPS) {
  const file = path.join(outDir, `${key}.svg`);
  fs.writeFileSync(file, svg(label, silhouette));
  written += 1;
}
console.log(`Wrote ${written} crop SVGs to ${outDir}`);
