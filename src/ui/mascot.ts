/**
 * The app's mascot: an original, friendly cartoon bald eagle drawn for Civics 128.
 * Three poses: "wave" to greet, "stand" for calm moments, "flag" to celebrate.
 * Decorative only (aria-hidden); always pair it with real text.
 */
export type MascotPose = 'wave' | 'stand' | 'flag';

const POSES: Record<MascotPose, string> = {
  stand: `<ellipse cx="80" cy="151" rx="38" ry="5" fill="#000" opacity=".08"/>
  <path d="M62 126l-8 20 12-6 6 12 8-11 8 11 6-12 12 6-8-20z" fill="#fff" stroke="#ddd6cb" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M40 92c0-24 18-40 40-40s40 16 40 40c0 24-16 42-40 42S40 116 40 92z" fill="#5a3722"/>
  <path d="M58 98c0-14 10-24 22-24s22 10 22 24-10 28-22 28-22-14-22-28z" fill="#6b432a"/>
  <path d="M66 92q4 3 8 0M78 100q4 3 8 0M70 108q4 3 8 0M84 88q4 3 8 0" stroke="#7d5133" stroke-width="2" fill="none" stroke-linecap="round"/>

  <path d="M42 80c-12 6-18 22-14 40 2 6 8 10 14 8l8-6c-6-12-6-28-8-42z" fill="#462a18"/>
  <path d="M118 80c12 6 18 22 14 40-2 6-8 10-14 8l-8-6c6-12 6-28 8-42z" fill="#462a18"/>
  <path d="M30 108c4 2 8 2 12 0M31 116c4 2 8 2 12 0M118 108c4 2 8 2 12 0M117 116c4 2 8 2 12 0" stroke="#5e3b24" stroke-width="2" fill="none" stroke-linecap="round"/>

  <g fill="#f5b400" stroke="#d99700" stroke-width="1.2">
    <path d="M62 128c-2 6-6 10-10 12h20c-2-2-4-6-4-12z"/>
    <path d="M86 128c0 6-2 10-4 12h20c-4-2-8-6-10-12z"/>
  </g>
  <path d="M53 140l-2 4M60 140l-1 4M67 140l0 4M86 140l0 4M93 140l1 4M100 140l2 4" stroke="#3a3a3a" stroke-width="2.2" stroke-linecap="round"/>

  <path d="M46 52c0-20 15-34 34-34s34 14 34 34c0 8-3 14-7 18l-6 6-5-5-6 6-5-6-5 6-6-6-5 5-6-6c-5-4-8-10-8-18z" fill="#fff" stroke="#e6e0d6" stroke-width="1.5"/>
  <path d="M108 30c4-2 9-1 12 2-4 0-6 2-7 4" fill="#fff" stroke="#e6e0d6" stroke-width="1.2"/>
  <path d="M56 41q9-5 18-1M86 40q9-4 18 1" stroke="#a89f92" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="65" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <ellipse cx="95" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <circle cx="66" cy="49" r="5.4" fill="#2a1d12"/><circle cx="94" cy="49" r="5.4" fill="#2a1d12"/>
  <circle cx="68" cy="46.5" r="2" fill="#fff"/><circle cx="96" cy="46.5" r="2" fill="#fff"/>
  <circle cx="56" cy="60" r="4" fill="#ff9aa2" opacity=".45"/><circle cx="104" cy="60" r="4" fill="#ff9aa2" opacity=".45"/>
  <!-- hooked beak -->
  <path d="M68 58c2-6 22-6 24 0 2 7-1 15-7 19-2 1.4-3.6.2-3-1.8.6-2.2-.4-3.4-2.4-3.4H74c-5 0-8-7-6-13.8z" fill="#ffc21a" stroke="#d99200" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M70 58.5c4-2.5 16-2.5 20 0" stroke="#ffe08a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M71 67q7 4 14 1" stroke="#b97a00" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="61" r="1.1" fill="#b97a00"/><circle cx="85" cy="61" r="1.1" fill="#b97a00"/>`,
  wave: `<ellipse cx="80" cy="151" rx="38" ry="5" fill="#000" opacity=".08"/>
  <path d="M62 126l-8 20 12-6 6 12 8-11 8 11 6-12 12 6-8-20z" fill="#fff" stroke="#ddd6cb" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M40 92c0-24 18-40 40-40s40 16 40 40c0 24-16 42-40 42S40 116 40 92z" fill="#5a3722"/>
  <path d="M58 98c0-14 10-24 22-24s22 10 22 24-10 28-22 28-22-14-22-28z" fill="#6b432a"/>
  <path d="M66 92q4 3 8 0M78 100q4 3 8 0M70 108q4 3 8 0M84 88q4 3 8 0" stroke="#7d5133" stroke-width="2" fill="none" stroke-linecap="round"/>

  <path d="M42 80c-12 6-18 22-14 40 2 6 8 10 14 8l8-6c-6-12-6-28-8-42z" fill="#462a18"/>
  <path d="M30 108c4 2 8 2 12 0M31 116c4 2 8 2 12 0" stroke="#5e3b24" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M114 82c10-8 16-22 26-30 4-3 9 0 8 5-2 4-5 6-4 9 4-2 8 1 6 5-1 3-5 4-5 6 3 0 5 4 2 7-6 6-16 14-26 16z" fill="#462a18"/>
  <path d="M136 58l6 1M137 66l6 2M134 74l5 3" stroke="#5e3b24" stroke-width="2" stroke-linecap="round"/>

  <g fill="#f5b400" stroke="#d99700" stroke-width="1.2">
    <path d="M62 128c-2 6-6 10-10 12h20c-2-2-4-6-4-12z"/>
    <path d="M86 128c0 6-2 10-4 12h20c-4-2-8-6-10-12z"/>
  </g>
  <path d="M53 140l-2 4M60 140l-1 4M67 140l0 4M86 140l0 4M93 140l1 4M100 140l2 4" stroke="#3a3a3a" stroke-width="2.2" stroke-linecap="round"/>

  <path d="M46 52c0-20 15-34 34-34s34 14 34 34c0 8-3 14-7 18l-6 6-5-5-6 6-5-6-5 6-6-6-5 5-6-6c-5-4-8-10-8-18z" fill="#fff" stroke="#e6e0d6" stroke-width="1.5"/>
  <path d="M108 30c4-2 9-1 12 2-4 0-6 2-7 4" fill="#fff" stroke="#e6e0d6" stroke-width="1.2"/>
  <path d="M56 41q9-5 18-1M86 40q9-4 18 1" stroke="#a89f92" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="65" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <ellipse cx="95" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <circle cx="66" cy="49" r="5.4" fill="#2a1d12"/><circle cx="94" cy="49" r="5.4" fill="#2a1d12"/>
  <circle cx="68" cy="46.5" r="2" fill="#fff"/><circle cx="96" cy="46.5" r="2" fill="#fff"/>
  <circle cx="56" cy="60" r="4" fill="#ff9aa2" opacity=".45"/><circle cx="104" cy="60" r="4" fill="#ff9aa2" opacity=".45"/>
  <!-- hooked beak -->
  <path d="M68 58c2-6 22-6 24 0 2 7-1 15-7 19-2 1.4-3.6.2-3-1.8.6-2.2-.4-3.4-2.4-3.4H74c-5 0-8-7-6-13.8z" fill="#ffc21a" stroke="#d99200" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M70 58.5c4-2.5 16-2.5 20 0" stroke="#ffe08a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M71 67q7 4 14 1" stroke="#b97a00" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="61" r="1.1" fill="#b97a00"/><circle cx="85" cy="61" r="1.1" fill="#b97a00"/>`,
  flag: `<ellipse cx="80" cy="151" rx="38" ry="5" fill="#000" opacity=".08"/>
  <path d="M62 126l-8 20 12-6 6 12 8-11 8 11 6-12 12 6-8-20z" fill="#fff" stroke="#ddd6cb" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M40 92c0-24 18-40 40-40s40 16 40 40c0 24-16 42-40 42S40 116 40 92z" fill="#5a3722"/>
  <path d="M58 98c0-14 10-24 22-24s22 10 22 24-10 28-22 28-22-14-22-28z" fill="#6b432a"/>
  <path d="M66 92q4 3 8 0M78 100q4 3 8 0M70 108q4 3 8 0M84 88q4 3 8 0" stroke="#7d5133" stroke-width="2" fill="none" stroke-linecap="round"/>

  <path d="M42 80c-12 6-18 22-14 40 2 6 8 10 14 8l8-6c-6-12-6-28-8-42z" fill="#462a18"/>
  <path d="M118 80c12 6 18 22 14 40-2 6-8 10-14 8l-8-6c6-12 6-28 8-42z" fill="#462a18"/>
  <path d="M30 108c4 2 8 2 12 0M31 116c4 2 8 2 12 0M118 108c4 2 8 2 12 0M117 116c4 2 8 2 12 0" stroke="#5e3b24" stroke-width="2" fill="none" stroke-linecap="round"/>

  <g fill="#f5b400" stroke="#d99700" stroke-width="1.2">
    <path d="M62 128c-2 6-6 10-10 12h20c-2-2-4-6-4-12z"/>
    <path d="M86 128c0 6-2 10-4 12h20c-4-2-8-6-10-12z"/>
  </g>
  <path d="M53 140l-2 4M60 140l-1 4M67 140l0 4M86 140l0 4M93 140l1 4M100 140l2 4" stroke="#3a3a3a" stroke-width="2.2" stroke-linecap="round"/>

  <path d="M46 52c0-20 15-34 34-34s34 14 34 34c0 8-3 14-7 18l-6 6-5-5-6 6-5-6-5 6-6-6-5 5-6-6c-5-4-8-10-8-18z" fill="#fff" stroke="#e6e0d6" stroke-width="1.5"/>
  <path d="M108 30c4-2 9-1 12 2-4 0-6 2-7 4" fill="#fff" stroke="#e6e0d6" stroke-width="1.2"/>
  <path d="M56 41q9-5 18-1M86 40q9-4 18 1" stroke="#a89f92" stroke-width="3.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="65" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <ellipse cx="95" cy="48" rx="7.5" ry="8.5" fill="#fff" stroke="#e6e0d6"/>
  <circle cx="66" cy="49" r="5.4" fill="#2a1d12"/><circle cx="94" cy="49" r="5.4" fill="#2a1d12"/>
  <circle cx="68" cy="46.5" r="2" fill="#fff"/><circle cx="96" cy="46.5" r="2" fill="#fff"/>
  <circle cx="56" cy="60" r="4" fill="#ff9aa2" opacity=".45"/><circle cx="104" cy="60" r="4" fill="#ff9aa2" opacity=".45"/>
  <!-- hooked beak -->
  <path d="M68 58c2-6 22-6 24 0 2 7-1 15-7 19-2 1.4-3.6.2-3-1.8.6-2.2-.4-3.4-2.4-3.4H74c-5 0-8-7-6-13.8z" fill="#ffc21a" stroke="#d99200" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M70 58.5c4-2.5 16-2.5 20 0" stroke="#ffe08a" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path d="M71 67q7 4 14 1" stroke="#b97a00" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="75" cy="61" r="1.1" fill="#b97a00"/><circle cx="85" cy="61" r="1.1" fill="#b97a00"/>

  <g transform="rotate(-12 34 96)">
    <rect x="31" y="70" width="3" height="52" rx="1.5" fill="#8a6a4a"/>
    <rect x="34" y="70" width="26" height="17" rx="2" fill="#fff" stroke="#e0dbd2"/>
    <rect x="34" y="70" width="11" height="9" fill="#3a6df0"/>
    <path d="M45 72.5h15M45 77h15M34 81.5h26M34 86h26" stroke="#e5546e" stroke-width="2"/>
  </g>`,
};

export function mascotSvg(pose: MascotPose = 'stand', size = 112): string {
  return `<svg class="mascot mascot--${pose}" aria-hidden="true" focusable="false" width="${size}" height="${size}" viewBox="0 0 160 160">${POSES[pose]}</svg>`;
}
