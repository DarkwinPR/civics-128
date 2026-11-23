/**
 * The app's mascot: a friendly, original cartoon eagle drawn for Civics 128.
 * Decorative only (aria-hidden); always pair it with real text.
 */
export type MascotMood = 'happy' | 'cheer' | 'think';

export function mascotSvg(mood: MascotMood = 'happy', size = 112): string {
  const brows =
    mood === 'think'
      ? '<path d="M43 26q7 2 13 0M64 28q6-5 13-2" stroke="#1d2433" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : '<path d="M43 27q7-4 13 0M64 27q6-4 13 0" stroke="#1d2433" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
  const wings =
    mood === 'cheer'
      ? '<path d="M30 62c-12-6-16-20-12-30 8 4 14 14 16 22z" fill="#5e3820"/><path d="M90 62c12-6 16-20 12-30-8 4-14 14-16 22z" fill="#5e3820"/>'
      : '<path d="M28 66c-10 4-14 16-10 26 8-2 14-10 16-18z" fill="#5e3820"/><path d="M92 66c10 4 14 16 10 26-8-2-14-10-16-18z" fill="#5e3820"/>';
  return `<svg class="mascot mascot--${mood}" aria-hidden="true" focusable="false" width="${size}" height="${size}" viewBox="0 0 120 120">
  <ellipse cx="60" cy="112" rx="30" ry="5" fill="#000" opacity=".08"/>
  <path d="M28 70c0-22 14-34 32-34s32 12 32 34c0 22-14 38-32 38S28 92 28 70z" fill="#7a4b2f"/>
  <path d="M42 78c0-10 8-16 18-16s18 6 18 16-8 24-18 24-18-14-18-24z" fill="#f4e3c7"/>
  ${wings}
  <circle cx="60" cy="38" r="26" fill="#fff"/>
  <path d="M40 22c4-10 14-14 20-12-2 3-2 6 0 8 4-6 12-8 18-5-4 2-5 5-4 8" fill="#fff"/>
  <circle cx="50" cy="36" r="6.5" fill="#1d2433"/><circle cx="70" cy="36" r="6.5" fill="#1d2433"/>
  <circle cx="52" cy="34" r="2.2" fill="#fff"/><circle cx="72" cy="34" r="2.2" fill="#fff"/>
  ${brows}
  <path d="M53 44h14c0 6-3 11-7 13-4-2-7-7-7-13z" fill="#f6a623"/>
  <path d="M53 44h14c-2 3-5 4-7 4s-5-1-7-4z" fill="#e08b0b"/>
  <circle cx="42" cy="46" r="4" fill="#ff9aa2" opacity=".55"/><circle cx="78" cy="46" r="4" fill="#ff9aa2" opacity=".55"/>
  <path d="M48 106l-4 6M52 106v7M56 106l4 6M64 106l-4 6M68 106v7M72 106l4 6" stroke="#f6a623" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}
