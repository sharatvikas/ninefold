// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEY } from '../game/progress';
import { App } from './app';

const $ = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`nothing matches ${sel}`);
  return el;
};
const all = (sel: string): HTMLElement[] => [...document.querySelectorAll<HTMLElement>(sel)];
const saved = (): { solved: Record<string, { nines: number }> } => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"solved":{}}');

function boot(seed?: object): App {
  document.body.innerHTML = '<div id="app"></div>';
  localStorage.clear();
  // Calm mode skips the pauses in animations, so the tests don't have to wait for them.
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, solved: {}, settings: { sound: false, calm: true }, ...seed }));
  return new App($('#app'));
}

describe('the game, end to end in a DOM', () => {
  beforeEach(() => vi.useRealTimers());

  it('opens on the title and walks a new player to the harbor', () => {
    boot();
    expect($('.title-word').textContent).toBe('Ninefold');
    $('.title .btn').click();
    expect($('.hub').dataset.mode).toBe('hub');
    expect($('.panel-title').textContent).toBe('Harbor');
    expect(all('.ticket-row')).toHaveLength(6);
    expect(all('.ticket-row.open')).toHaveLength(1);
    expect(all('.ticket-row:disabled')).toHaveLength(5);
    expect($('.uptime-num').textContent).toBe('90.0%');
    $('.back-link').click();
    expect(all('.pager-row')).toHaveLength(9);
  });

  it('plays Sinking Ships: find the cause, miss once, fix it, and saves the moment it is solved', async () => {
    boot();
    $('.title .btn').click();
    $('.ticket-row.open').click();
    expect($('.intro-title').textContent).toBe('Sinking Ships');
    $('.intro .btn.primary').click();
    expect(all('.steps li.now')[0].textContent).toContain('Find the cause');

    all('.log-line')[0].click();
    expect(all('.finding')).toHaveLength(0);
    all('.log-line')[2].click();
    expect($('.annot.key').textContent).toContain('ran out of space');
    expect(all('.finding')).toHaveLength(1);
    expect(all('.steps li.now')[0].textContent).toContain('Change');

    // Raise the hold by one: still sinks on the nine-crate voyage.
    const plus = () => all('.field')[0].querySelectorAll<HTMLElement>('.step-btn')[1].click();
    plus();
    expect($('.diffbox').textContent).toContain('+ hold_size: 8');
    $('.apply-row .btn').click();
    await vi.waitFor(() => expect($('.hintbox').textContent).toContain('busiest'));
    expect(all('.check.fail')).toHaveLength(1);
    expect(saved().solved['harbor-1']).toBeUndefined();

    plus();
    $('.apply-row .btn').click();
    // Saved by the time the click handler returns, before any animation or recap.
    expect(saved().solved['harbor-1']).toEqual({ nines: 2 });
    await vi.waitFor(() => expect($('.recap-headline').textContent).toContain('hold'));
    expect($('.grade-text').textContent).toContain('Two nines');
    expect(all('.status-tiles.ok')).toHaveLength(1);

    all('.recap .btn').find((b) => b.textContent === 'Back to town')!.click();
    expect(all('.desk')).toHaveLength(0);
    expect(all('.ticket-row.done')).toHaveLength(1);
    expect(all('.ticket-row.open')).toHaveLength(1);
  });

  it('plays a terminal ticket with tapped commands and the file editor', async () => {
    const app = boot({ solved: { 'post-1': { nines: 3 }, 'post-2': { nines: 3 }, 'post-3': { nines: 3 }, 'post-4': { nines: 3 } } });
    $('.title .btn').click();
    app.openTicket('post-5');
    $('.intro .btn.primary').click();
    const run = (cmd: string) => {
      const chip = all('.chip').find((c) => c.textContent === cmd);
      if (chip) chip.click();
      else $<HTMLInputElement>('.term-input').value = cmd;
      $('.term-run').click();
    };
    run('help');
    expect($('.term-out').textContent).toContain('Commands for this incident');
    run('nonsense');
    expect($('.term-out').textContent).toContain('command not found');
    run('edit lb.conf');
    const ta = $<HTMLTextAreaElement>('.editor-text');
    expect(ta.value).toContain('enabled  = false');
    all('.editor .btn').find((b) => b.textContent === 'Cancel')!.click();
    expect(all('.editor')).toHaveLength(0);
    expect(all('.chip').length).toBeGreaterThan(5);
    $('.desk-head .icon-btn').click();
    expect(all('.desk')).toHaveLength(0);
  });

  it('shows closed tickets in the runbook and can reset from settings', () => {
    boot({ solved: { 'harbor-1': { nines: 3 }, 'post-1': { nines: 2 } } });
    $('.title .btn').click();
    all('.hub-actions .icon-btn')[0].click();
    expect(all('details.rb-page')).toHaveLength(2);
    expect(all('.rb-page.locked')).toHaveLength(49);
    $('.modal-head .icon-btn').click();
    all('.hub-actions .icon-btn')[1].click();
    const reset = all('.settings .btn').find((b) => b.textContent === 'Reset progress')!;
    reset.click();
    expect(saved().solved['harbor-1']).toBeDefined();
    reset.click();
    expect(saved().solved).toEqual({});
  });

  it('carries a first-version save into the new game', () => {
    document.body.innerHTML = '<div id="app"></div>';
    localStorage.clear();
    localStorage.setItem('ninefold.save.v1', JSON.stringify({ version: 1, trust: 56, completed: { 'harbor-1': { trust: 6 } } }));
    new App($('#app'));
    expect($('.title .btn').textContent).toBe('Continue the shift');
    $('.title .btn').click();
    all('.pager-row').find((r) => r.textContent!.includes('Harbor'))!.click();
    expect(all('.ticket-row.done')).toHaveLength(1);
  });
});
