function isTyping(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

const GAME_KEYS =new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'e', 'q']);

/** Keyboard state. `pressed` holds keys that went down since the last frame. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  /** When false (e.g. a menu is open) movement keys are ignored by the world. */
  enabled = true;

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      // Typing into a text field must not walk the player or trigger shortcuts.
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
      if (GAME_KEYS.has(k)) e.preventDefault();
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
  }
}
