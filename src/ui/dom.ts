/** Tiny DOM helpers. The whole interface is plain elements; there is no framework. */

type Child = Node | string | false | null | undefined;
type Props = Record<string, string | number | boolean | undefined | ((e: Event) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | Props, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (typeof cls === 'string') {
    if (cls) el.className = cls;
  } else if (cls) {
    for (const [k, v] of Object.entries(cls)) {
      if (v === undefined || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  for (const kid of kids) if (kid !== false && kid !== null && kid !== undefined) el.append(kid);
  return el;
}

export function button(cls: string, label: Child | Child[], onClick: (e: MouseEvent) => void, attrs: Props = {}): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', ...attrs }, ...(Array.isArray(label) ? label : [label]));
  b.addEventListener('click', onClick);
  return b;
}

const PATHS: Record<string, string> = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  book: '<path d="M5 4h9a4 4 0 014 4v12H9a4 4 0 01-4-4z"/><path d="M5 16a4 4 0 014-4h9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 016 0v3"/>',
  pin: '<path d="M12 21v-7"/><path d="M8 4h8l-1 6 3 4H6l3-4z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M7 7l10 10M17 7L7 17"/>',
  up: '<path d="M6 14l6-6 6 6"/>',
  down: '<path d="M6 10l6 6 6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  bell: '<path d="M6 17V11a6 6 0 0112 0v6l2 2H4z"/><path d="M10 21h4"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 010 6"/>',
  mute: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9.5l4 5M21 9.5l-4 5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
  redo: '<path d="M5 12a7 7 0 1112 5"/><path d="M5 6v6h6"/>',
};

export function icon(name: keyof typeof PATHS | string, size = 18): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
  return t.content.firstChild as SVGSVGElement;
}

/** Up to three small lamps: how cleanly a ticket was closed. */
export function nineLamps(n: number, total = 3): HTMLElement {
  const el = h('span', { class: 'lamps', role: 'img', 'aria-label': `${n} of ${total} nines` });
  for (let i = 0; i < total; i++) el.append(h('i', i < n ? 'on' : ''));
  return el;
}

export const coarse = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
export const prefersCalm = (): boolean => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Replace an element's children, skipping anything null or false. */
export function put(el: Element, ...kids: Child[]): void {
  el.replaceChildren(...kids.filter((k): k is Node | string => k !== false && k !== null && k !== undefined));
}
