/** Funnel audio — a cinematic, restrained Web Audio palette, ported from the
 *  brand intro (`public/nullshift-intro.html`) so the /start funnel sounds like
 *  a continuation of it: a spatial reverb send, a deep clean sub, airy swells,
 *  near-silent ticks and warm bell tones. No melodies, no 8-bit.
 *
 *  SSR-safe (every method no-ops without `window`). The AudioContext can only
 *  start after a user gesture (browser autoplay policy) — call `unlock()` from
 *  the first tap. Sounds are no-ops until then.
 */

const PREF_KEY = "ns_funnel_muted";

class FunnelAudio {
  private actx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private _muted = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        this._muted = localStorage.getItem(PREF_KEY) === "1";
      } catch {
        /* ignore */
      }
    }
  }

  get muted() {
    return this._muted;
  }

  /** Create (once) and resume the audio graph. Safe to call repeatedly. */
  unlock() {
    if (typeof window === "undefined") return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.actx) {
      try {
        const actx = new AC();
        const master = actx.createGain();
        master.gain.value = this._muted ? 0 : 0.5;

        const comp = actx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 26;
        comp.ratio.value = 3;
        comp.attack.value = 0.006;
        comp.release.value = 0.25;

        const conv = actx.createConvolver();
        conv.buffer = this.makeIR(actx, 2.8, 3.2);
        const revReturn = actx.createGain();
        revReturn.gain.value = 0.9;
        const reverbSend = actx.createGain();
        reverbSend.gain.value = 0.42;
        reverbSend.connect(conv);
        conv.connect(revReturn);
        revReturn.connect(comp);

        master.connect(comp);
        comp.connect(actx.destination);

        const len = Math.floor(actx.sampleRate * 1.6);
        const noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
        const nd = noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) nd[i] = Math.random() * 2 - 1;

        this.actx = actx;
        this.master = master;
        this.reverbSend = reverbSend;
        this.noiseBuf = noiseBuf;
      } catch {
        this.actx = null;
      }
    }
    if (this.actx && this.actx.state === "suspended") void this.actx.resume();
  }

  setMuted(m: boolean) {
    this._muted = m;
    try {
      localStorage.setItem(PREF_KEY, m ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (this.master && this.actx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.now(), 0.05);
  }

  /* ── Internals ── */
  private makeIR(actx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const rate = actx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = actx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  private now() {
    return this.actx ? this.actx.currentTime : 0;
  }
  private env(g: GainNode, at: number, peak: number, dur: number, atk = 0.02) {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  private wet(node: AudioNode, amt = 0.5) {
    if (!this.actx || !this.master) return;
    node.connect(this.master);
    if (this.reverbSend) {
      const w = this.actx.createGain();
      w.gain.value = amt;
      node.connect(w);
      w.connect(this.reverbSend);
    }
  }

  /* ── Voices (mirror the intro) ── */
  private subPulse(at: number, freq = 56, gain = 0.4, dur = 0.9) {
    const actx = this.actx;
    if (!actx) return;
    const o = actx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, at);
    const sub = actx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq / 2, at);
    const f = actx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 5;
    f.Q.value = 0.6;
    const g = actx.createGain();
    const gs = actx.createGain();
    this.env(g, at, gain, dur, 0.03);
    this.env(gs, at, gain * 0.5, dur * 1.15, 0.05);
    o.connect(g);
    sub.connect(gs);
    g.connect(f);
    gs.connect(f);
    this.wet(f, 0.18);
    [o, sub].forEach((x) => {
      x.start(at);
      x.stop(at + dur + 0.15);
    });
  }
  private airSwell(at: number, dur = 1.3, gain = 0.07) {
    const actx = this.actx;
    if (!actx || !this.noiseBuf) return;
    const src = actx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = actx.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(500, at);
    f.frequency.exponentialRampToValueAtTime(2600, at + dur);
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    this.wet(g, 0.75);
    src.start(at);
    src.stop(at + dur + 0.1);
  }
  private tick(at: number, gain = 0.016) {
    const actx = this.actx;
    if (!actx) return;
    const o = actx.createOscillator();
    o.type = "sine";
    o.frequency.value = 2300;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(g);
    this.wet(g, 0.6);
    o.start(at);
    o.stop(at + 0.06);
  }
  private tone(at: number, freq = 330, gain = 0.09, dur = 1.3) {
    const actx = this.actx;
    if (!actx) return;
    const o = actx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const o2 = actx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const g = actx.createGain();
    const g2 = actx.createGain();
    this.env(g, at, gain, dur, 0.04);
    this.env(g2, at, gain * 0.16, dur * 0.7, 0.05);
    o.connect(g);
    o2.connect(g2);
    this.wet(g, 0.8);
    this.wet(g2, 0.8);
    [o, o2].forEach((x) => {
      x.start(at);
      x.stop(at + dur + 0.1);
    });
  }
  private twoNote(at: number, root: number) {
    this.tone(at, root, 0.085, 1.4);
    this.tone(at + 0.2, root * 1.5, 0.06, 1.6);
  }

  /* ── Semantic events used by the funnel ── */

  /** A question is answered. Pitch drifts gently upward as the visitor
   *  progresses, building a subtle sense of momentum (as in the intro). */
  answer(stepIndex = 0, total = 5) {
    const t = this.now();
    const freq = 56 + (stepIndex / Math.max(1, total - 1)) * 26;
    this.subPulse(t, freq, 0.2, 0.6);
    this.tick(t, 0.012);
    this.airSwell(t, 0.7, 0.04);
  }
  back() {
    this.tick(this.now(), 0.012);
  }
  /** Entering the "hold" analysing screen. */
  holdEnter() {
    this.airSwell(this.now(), 1.5, 0.07);
  }
  /** Each status line tick during the hold. */
  holdBeat(i = 0) {
    const t = this.now();
    this.subPulse(t, 58 + i * 8, 0.13, 0.45);
    this.tick(t, 0.008);
  }
  /** Resolve into the result page. */
  resolve(qualified: boolean) {
    const t = this.now();
    if (qualified) {
      this.twoNote(t, 262);
      this.subPulse(t + 0.02, 52, 0.34, 1.1);
    } else {
      this.tone(t, 294, 0.08, 1.5);
      this.subPulse(t + 0.02, 58, 0.26, 1.0);
    }
  }
}

export const funnelSound = new FunnelAudio();
