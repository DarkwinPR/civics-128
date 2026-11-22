let politeTimer: number | undefined;
let assertiveTimer: number | undefined;

export function announce(message: string, urgency: 'polite' | 'assertive' = 'polite'): void {
  const id = urgency === 'assertive' ? 'live-assertive' : 'live-polite';
  const region = document.getElementById(id);
  if (!region) return;

  if (urgency === 'assertive') {
    window.clearTimeout(assertiveTimer);
  } else {
    window.clearTimeout(politeTimer);
  }

  // Clear first and delay slightly so repeated announcements and focus moves do not collide.
  region.textContent = '';
  const timer = window.setTimeout(() => {
    region.textContent = message;
  }, 60);

  if (urgency === 'assertive') {
    assertiveTimer = timer;
  } else {
    politeTimer = timer;
  }
}
