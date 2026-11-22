/**
 * Lightweight red/white/blue confetti burst (no dependencies).
 * Skipped entirely when the user prefers reduced motion.
 */
const COLORS = ['#d1123f', '#2343d1', '#ffffff', '#f5b301', '#4f6bff', '#ff5a7a'];

export function launchConfetti(pieces = 120): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < pieces; i += 1) {
    const piece = document.createElement('span');
    const isStar = Math.random() < 0.25;
    piece.className = isStar ? 'confetti-piece confetti-piece--star' : 'confetti-piece';
    if (isStar) piece.textContent = '★';
    const color = COLORS[i % COLORS.length] ?? '#2343d1';
    piece.style.setProperty('--x', `${Math.random() * 100}vw`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 30}vw`);
    piece.style.setProperty('--rot', `${Math.random() * 900 - 450}deg`);
    piece.style.setProperty('--delay', `${Math.random() * 0.6}s`);
    piece.style.setProperty('--dur', `${2.4 + Math.random() * 1.8}s`);
    piece.style.setProperty('--c', color);
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 5200);
}
