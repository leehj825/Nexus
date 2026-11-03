// Nexus - dialogue portraits: a small head and shoulders for each speaker, drawn as SVG. The face follows the line's mood (talk, worry,
// firm, think, alert, nod, wipe). These are simple stand-ins for finished art: the drawing is all in one place, so it can be swapped.
const Portraits = (() => {
  const LOOK = {
    jin: { skin: '#d9a987', hair: '#2a2420', style: 'short', beard: true, acc: '#ffffff', coat: '#2e3a46' },
    ruen: { skin: '#e8c2a0', hair: '#6b4a32', style: 'bob', acc: '#c9a0ff', coat: '#23313a' },
    kyle: { skin: '#c99273', hair: '#3a3a40', style: 'buzz', acc: '#ffd27a', coat: '#3a3426' },
    yuna: { skin: '#e6b893', hair: '#8a5a3a', style: 'ponytail', acc: '#7ff7ff', coat: '#2b2d33' },
  };
  const HAIR = {
    short: 'M26 46 Q26 22 48 20 Q70 22 70 46 Q66 34 48 32 Q32 34 26 46 Z',
    buzz: 'M27 42 Q28 26 48 25 Q68 26 69 42 Q64 32 48 31 Q32 32 27 42 Z',
    bob: 'M24 62 Q22 24 48 20 Q74 24 72 62 L70 66 Q66 40 48 36 Q30 40 26 66 Z',
    ponytail: 'M26 46 Q26 22 48 20 Q70 22 70 46 Q66 34 48 32 Q32 34 26 46 Z',
  };
  // Eyebrows and mouth for each mood
  const BROWS = {
    worry: ['M34 39 L42 35', 'M62 39 L54 35'], firm: ['M34 35 L42 40', 'M62 35 L54 40'], think: ['M34 40 L42 40', 'M54 37 L62 34'],
    alert: ['M34 34 L42 33', 'M54 33 L62 34'],
  };
  const MOUTH = {
    talk: '<ellipse cx="48" cy="67" rx="5" ry="3.5" fill="#4a2424"/>', worry: '<path d="M41 69 Q48 65 55 69" />', firm: '<path d="M42 67 L54 67" />',
    think: '<path d="M44 67 Q49 66 53 68" />', alert: '<ellipse cx="48" cy="67" rx="3" ry="4" fill="#4a2424"/>',
    nod: '<path d="M40 65 Q48 73 56 65" />', wipe: '<path d="M42 66 Q48 69 54 66" />',
  };
  const svg = (who, mood = 'talk') => {
    const L = LOOK[who]; if (!L) return '';
    const m = MOUTH[mood] ? mood : 'talk', brows = BROWS[mood] || ['M34 38 L42 38', 'M54 38 L62 38'];
    const eyeRy = mood === 'alert' ? 4 : 3, eyes = mood === 'wipe'
      ? '<rect x="35" y="45" width="6" height="1.8" fill="#1b1b22"/><rect x="55" y="45" width="6" height="1.8" fill="#1b1b22"/>'
      : mood === 'nod' ? '<path d="M35 46 Q38 43 41 46" fill="none" stroke="#1b1b22" stroke-width="1.6"/><path d="M55 46 Q58 43 61 46" fill="none" stroke="#1b1b22" stroke-width="1.6"/>'
      : `<ellipse cx="38" cy="46" rx="2.6" ry="${eyeRy}" fill="#1b1b22"/><ellipse cx="58" cy="46" rx="2.6" ry="${eyeRy}" fill="#1b1b22"/>`;
    const tail = L.style === 'ponytail' ? `<path d="M66 30 Q90 36 84 64 Q80 52 70 44 Z" fill="${L.hair}"/>` : '';
    const beard = L.beard ? `<path d="M34 62 Q48 86 62 62 Q56 75 48 76 Q40 75 34 62 Z" fill="${L.hair}" opacity="0.85"/>` : '';
    return `<svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${who}">
      <rect width="96" height="96" fill="#0b0f1a"/>
      <path d="M20 96 Q24 78 48 76 Q72 78 76 96 Z" fill="${L.coat}"/>
      <path d="M44 74 L48 82 L52 74" fill="none" stroke="${L.acc}" stroke-width="1.6"/>
      <rect x="42" y="62" width="12" height="14" fill="${L.skin}"/>
      <ellipse cx="48" cy="48" rx="21" ry="25" fill="${L.skin}"/>
      ${tail}<path d="${HAIR[L.style]}" fill="${L.hair}"/>${beard}${eyes}
      ${brows.map(d => `<path d="${d}" stroke="${L.hair}" stroke-width="2.4" stroke-linecap="round" fill="none"/>`).join('')}
      <g stroke="#3a2418" stroke-width="2.2" stroke-linecap="round" fill="${m === 'talk' || m === 'alert' ? '#4a2424' : 'none'}">${MOUTH[m].replace(/<(ellipse|path)/g, '<$1')}</g>
      <rect x="6" y="6" width="84" height="84" fill="none" stroke="${L.acc}" stroke-opacity="0.5" stroke-width="1.5"/>
    </svg>`;
  };
  return { svg };
})();
