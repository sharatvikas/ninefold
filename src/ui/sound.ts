/** A handful of soft synthesised sounds. No audio files; silent until the first tap, and easy to turn off. */

type Voice = { f: number; at: number; len: number; type?: OscillatorType; gain?: number; to?: number };

const TUNES: Record<string, Voice[]> = {
  tap: [{ f: 520, at: 0, len: 0.05, type: 'triangle', gain: 0.05 }],
  pin: [{ f: 660, at: 0, len: 0.09, type: 'triangle' }, { f: 990, at: 0.07, len: 0.16, type: 'triangle' }],
  page: [{ f: 880, at: 0, len: 0.11, type: 'square', gain: 0.035 }, { f: 880, at: 0.18, len: 0.11, type: 'square', gain: 0.035 }, { f: 660, at: 0.36, len: 0.2, type: 'square', gain: 0.035 }],
  pass: [{ f: 784, at: 0, len: 0.08, type: 'sine' }],
  fail: [{ f: 220, at: 0, len: 0.22, type: 'sawtooth', gain: 0.04, to: 150 }],
  solved: [{ f: 523, at: 0, len: 0.14 }, { f: 659, at: 0.12, len: 0.14 }, { f: 784, at: 0.24, len: 0.14 }, { f: 1047, at: 0.36, len: 0.5 }],
  lamp: [{ f: 1319, at: 0, len: 0.3, type: 'sine', gain: 0.05 }],
};

export class Sound {
  private ctx: AudioContext | undefined;
  enabled = true;

  play(name: keyof typeof TUNES | string): void {
    if (!this.enabled) return;
    const tune = TUNES[name];
    if (!tune) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx ??= new AC();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      const now = this.ctx.currentTime + 0.01;
      for (const v of tune) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = v.type ?? 'sine';
        o.frequency.setValueAtTime(v.f, now + v.at);
        if (v.to) o.frequency.exponentialRampToValueAtTime(v.to, now + v.at + v.len);
        const peak = v.gain ?? 0.07;
        g.gain.setValueAtTime(0, now + v.at);
        g.gain.linearRampToValueAtTime(peak, now + v.at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + v.at + v.len);
        o.connect(g).connect(this.ctx.destination);
        o.start(now + v.at);
        o.stop(now + v.at + v.len + 0.03);
      }
    } catch {
      // Sound is a nicety. If the browser refuses, play on in silence.
    }
  }
}
