/**
 * Progressive enhancement helpers for native <dialog> elements per modern-web-guidance:
 * 1. Light-dismiss fallback when `closedBy` is unsupported (Safari).
 * 2. Top-layer exit animation fallback when `overlay` or discrete `display` transition is unsupported (Firefox/Safari).
 * 3. Reset `dialog.returnValue = ''` after reading on close so stale values never leak.
 */

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  void getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return Boolean(window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());
}

export async function closeDialogSmoothly(
  dialog: HTMLDialogElement,
  returnValue?: string,
): Promise<void> {
  if (!dialog.open) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise<void>((resolve) => window.setTimeout(resolve, 1000)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }

  dialog.close(returnValue);
}

export function enhanceModalDialog(dialog: HTMLDialogElement): void {
  // Route cancel (Esc / native close request) through smooth exit when needed.
  dialog.addEventListener('cancel', (event) => {
    if (!supportsTopLayerExit()) {
      event.preventDefault();
      void closeDialogSmoothly(dialog);
    }
  });

  // Fallback light-dismiss for browsers without native `closedby="any"` support.
  if (dialog.getAttribute('closedby') === 'any' && !('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (e: PointerEvent): boolean => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };

    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = isOutside(e);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && isOutside(e)) {
        void closeDialogSmoothly(dialog);
      }
      pressedOutside = false;
    });
  }
}

export function openConfirmDialog(
  dialog: HTMLDialogElement,
  options: { title: string; message: string; confirmLabel: string },
): Promise<boolean> {
  const titleEl = dialog.querySelector<HTMLElement>('#confirm-dialog-title');
  const msgEl = dialog.querySelector<HTMLElement>('#confirm-dialog-message');
  const confirmBtn = dialog.querySelector<HTMLButtonElement>('button[value="confirm"]');

  if (titleEl) titleEl.textContent = options.title;
  if (msgEl) msgEl.textContent = options.message;
  if (confirmBtn) confirmBtn.textContent = options.confirmLabel;

  return new Promise<boolean>((resolve) => {
    const handleClose = () => {
      const confirmed = dialog.returnValue === 'confirm';
      // Mandatory reset: prevent stale returnValue leaking across dismissals.
      dialog.returnValue = '';
      dialog.removeEventListener('close', handleClose);
      resolve(confirmed);
    };
    dialog.addEventListener('close', handleClose);
    dialog.showModal();
  });
}
