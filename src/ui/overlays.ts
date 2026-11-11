/** The runbook (everything learned so far) and settings. */
import { DISTRICTS, LEVELS, levelsIn } from '../curriculum/catalog';
import { ALL_SPECS } from '../curriculum/content';
import { MEANS } from '../curriculum/glossary';
import { decodeSave, encodeSave } from '../game/progress';
import type { App } from './app';
import { button, h, icon, nineLamps } from './dom';
import { codeBlock } from './recap';

function modal(app: App, title: string, cls: string, body: HTMLElement): { close: () => void; el: HTMLElement } {
  const close = () => {
    el.remove();
    window.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const el = h('div', { class: `sheet modal ${cls}`, role: 'dialog', 'aria-label': title },
    h('div', 'sheet-card dark', h('header', 'modal-head', h('h2', '', title), button('icon-btn', icon('close'), () => close(), { 'aria-label': 'Close' })), body));
  el.addEventListener('click', (e) => e.target === el && close());
  window.addEventListener('keydown', onKey);
  document.getElementById('app')!.append(el);
  app.sound.play('tap');
  return { close, el };
}

export function openRunbook(app: App): void {
  const p = app.progress;
  const done = Object.keys(p.solved).length;
  const body = h('div', 'runbook', h('p', 'modal-sub', done ? `${done} of ${LEVELS.length} pages written. Each closed ticket adds one: the idea, why the fix worked, and how it looks with real tools.` : 'Empty for now. Every ticket you close writes a page here: the idea, why the fix worked, and how it looks with real tools.'));
  for (const d of DISTRICTS) {
    const sec = h('section', 'rb-sec', h('h3', '', d.name, h('span', 'dim', d.topic)));
    for (const l of levelsIn(d.id)) {
      const s = p.solved[l.id];
      if (!s) {
        sec.append(h('div', 'rb-page locked', icon('lock', 14), h('span', '', `Close “${l.title}” to write this page.`)));
        continue;
      }
      const spec = ALL_SPECS.find((x) => x.id === l.id)!;
      const real = typeof spec.recap.real === 'string' ? spec.recap.real : undefined;
      const det = h('details', 'rb-page',
        h('summary', '', h('span', 'rb-concept', l.concept), h('span', 'rb-from', l.title), nineLamps(s.nines)),
        h('p', 'rb-means', MEANS[l.id] ?? ''),
        h('p', 'rb-why', spec.recap.why),
        real ? codeBlock(real) : null,
        h('div', 'rb-actions', button('link', [icon('redo', 14), 'Replay this ticket'], () => {
          m.close();
          app.openTicket(l.id);
        })),
      );
      sec.append(det);
    }
    body.append(sec);
  }
  const m = modal(app, 'Runbook', 'wide', body);
}

export function openSettings(app: App): void {
  const s = app.progress.settings;
  const sw = (label: string, sub: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = button(`toggle ${get() ? 'on' : ''}`, [h('span', 'toggle-knob')], () => {
      set(!get());
      b.classList.toggle('on', get());
      b.setAttribute('aria-checked', String(get()));
      app.save();
      app.applySettings();
    }, { role: 'switch', 'aria-checked': String(get()), 'aria-label': label });
    return h('div', 'set-row', h('div', '', h('b', '', label), h('p', 'dim', sub)), b);
  };
  const code = h('textarea', { class: 'field-input mono code-box', rows: '3', spellcheck: 'false', 'aria-label': 'Save code', placeholder: 'Paste a save code (NF2-… or NF1-…) here' });
  const msg = h('p', { class: 'dim', role: 'status' });
  let armed = false;
  const reset = button('btn ghost danger', 'Reset progress', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Tap again to erase every closed ticket';
      return;
    }
    app.replaceProgress(app.blank());
    m.close();
  });
  const body = h('div', 'settings',
    sw('Sound', 'Soft blips for pins, checks and the pager.', () => s.sound, (v) => (s.sound = v)),
    sw('Calm mode', 'Stills the water, smoke and pulsing lights. On by itself if your device asks for reduced motion.', () => s.calm, (v) => (s.calm = v)),
    h('div', 'set-block',
      h('b', '', 'Move your progress'),
      h('p', 'dim', 'Progress lives only in this browser. A save code carries it to another browser or device. It holds your closed tickets and nothing else.'),
      code,
      h('div', 'sheet-actions',
        button('btn', 'Show my code', () => {
          code.value = encodeSave(app.progress);
          code.select();
          void navigator.clipboard?.writeText(code.value).then(() => (msg.textContent = 'Copied to the clipboard.'), () => (msg.textContent = 'Select and copy the code above.'));
        }),
        button('btn', 'Load pasted code', () => {
          const p = decodeSave(code.value);
          if (!p) {
            msg.textContent = 'That doesn\'t look like a Ninefold save code.';
            return;
          }
          app.replaceProgress({ ...p, settings: { ...s } });
          msg.textContent = `Loaded: ${Object.keys(p.solved).length} closed tickets.`;
        }),
      ),
      msg,
    ),
    h('div', 'set-block', h('b', '', 'Start over'), h('p', 'dim', 'Reopens every ticket. Settings stay.'), reset),
    h('p', 'dim about', 'Ninefold is free and open source. Nothing you do here touches a real system, and no account or personal data is involved. ',
      h('a', { class: 'link', href: 'https://github.com/sharatvikas/ninefold', target: '_blank', rel: 'noopener' }, 'Source on GitHub')),
  );
  const m = modal(app, 'Settings', '', body);
}
