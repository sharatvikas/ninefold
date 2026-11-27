function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

function isControl(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && !!t.closest('button, a[href], [role="button"]');
}

const GAME_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'e', 'q']);

/** Keyboard state. `pressed` holds keys that went down since the last frame. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  /** When false (e.g. a menu is open) movement keys are ignored by the world. */
  enabled = true;
  /** A tap or press on the game picture this frame, in view pixels. */
  tapAt: { x: number; y: number } | undefined;
  /** Where a finger or mouse is held down on the game picture, in view pixels (follow it while held). */
  holdAt: { x: number; y: number } | undefined;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      // Typing into a text field must not walk the player or trigger shortcuts.
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      // Space on a focused button or link must still press it (keyboard-only players).
      if (GAME_KEYS.has(k) && !(k === ' ' && isControl(e.target))) e.preventDefault();
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    target.addEventListener('blur', () => this.down.clear());
  }

  isDown(...keys: string[]): boolean {
    return keys.some((k) => this.down.has(k));
  }

  wasPressed(...keys: string[]): boolean {
    return keys.some((k) => this.pressed.has(k));
  }

  /** Simulate a key tap (used by on-screen buttons). */
  tap(key: string): void {
    this.pressed.add(key);
  }

  hold(key: string, on: boolean): void {
    if (on) this.down.add(key);
    else this.down.delete(key);
  }

  endFrame(): void {
    this.pressed.clear();
    this.tapAt = undefined;
  }

  /**
   * Tap-to-move: listen for taps, clicks and drags on the game picture.
   * `toView` turns a pointer event into view pixels.
   */
  watchPointer(el: HTMLElement, toView: (e: PointerEvent) => { x: number; y: number }): void {
    let id: number | undefined;
    let down: { x: number; y: number } | undefined;
    let dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      id = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.tapAt = toView(e);
      down = this.tapAt;
      dragging = false;
      this.holdAt = undefined;
    });
    // Fingers wobble during a tap; only a real drag (8+ game pixels) turns into steering.
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || !down) return;
      const at = toView(e);
      if (!dragging && Math.hypot(at.x - down.x, at.y - down.y) < 8) return;
      dragging = true;
      this.holdAt = at;
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = undefined;
      down = undefined;
      dragging = false;
      this.holdAt = undefined;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // A long press must not pop up the phone's own menu or start selecting text.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
}
