/**
 * All sound is synthesized with the Web Audio API: there are no audio files.
 *
 * The music is a choir that grows with the game. Each recovered verse adds a
 * voice, and the hub sings with one voice per rescued page: "die Engel singen".
 * Voices are sawtooth oscillators shaped by vowel formants and a shared reverb.
 */

export type AudioSettings = { volume: number; music: number; effects: number; muted: boolean };

export const DEFAULT_AUDIO: AudioSettings = { volume: 0.8, music: 0.7, effects: 0.9, muted: false };

type Vowel = "a" | "o" | "u" | "e";

const FORMANTS: Record<Vowel, [number, number, number][]> = {
  a: [
    [800, 80, 1],
    [1150, 90, 0.5],
    [2900, 120, 0.25],
  ],
  o: [
    [450, 70, 1],
    [800, 80, 0.35],
    [2830, 100, 0.1],
  ],
  u: [
    [325, 50, 1],
    [700, 60, 0.25],
    [2530, 170, 0.08],
  ],
  e: [
    [400, 60, 1],
    [1620, 80, 0.4],
    [2400, 100, 0.2],
  ],
};

/** Scales as semitone offsets. */
export const MODES = {
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

export type Key = { root: number; mode: number[]; progression: number[] };

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

type Voice = { stop: (when: number) => void };

export class AudioEngine {
  settings: AudioSettings = DEFAULT_AUDIO;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private fxBus!: GainNode;
  private choirBus!: GainNode;
  private reverbIn!: GainNode;
  private noise!: AudioBuffer;
  private key: Key = { root: 50, mode: MODES.aeolian, progression: [0, 5, 3, 4] };
  private voices = 1;
  private chordStep = 0;
  private chordTimer: ReturnType<typeof setInterval> | null = null;
  private held: Voice[] = [];
  private battle: { nodes: AudioNode[]; timer: ReturnType<typeof setInterval> } | null = null;
  private rain: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Must be called from a user gesture: browsers only allow audio after one. */
  wake() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.fxBus = ctx.createGain();
      this.choirBus = ctx.createGain();
      this.choirBus.connect(this.musicBus);
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 3;
      this.musicBus.connect(this.master);
      this.fxBus.connect(this.master);
      this.master.connect(compressor).connect(ctx.destination);

      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse(3.6);
      this.reverbIn = ctx.createGain();
      const wet = ctx.createGain();
      wet.gain.value = 0.55;
      this.reverbIn.connect(reverb).connect(wet).connect(this.master);

      const length = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.apply(this.settings);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  suspend() {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  apply(settings: AudioSettings) {
    this.settings = settings;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.music, t, 0.05);
    this.fxBus.gain.setTargetAtTime(settings.effects, t, 0.05);
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3.2;
    }
    return buffer;
  }

  private get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // ----- Choir -------------------------------------------------------------

  private sing(midi: number, start: number, duration: number, gain: number, vowel: Vowel, bus: AudioNode, attack = 1.6, release = 2.4): Voice {
    const ctx = this.ctx!;
    const f = hz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(gain, start + attack);
    env.gain.setValueAtTime(gain, start + Math.max(attack, duration - release));
    env.gain.linearRampToValueAtTime(0, start + duration);

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const oscillators: OscillatorNode[] = [];
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = detune + (Math.random() - 0.5) * 4;
      osc.connect(mix);
      oscillators.push(osc);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.6 + Math.random() * 0.8;
    const depth = ctx.createGain();
    depth.gain.value = f * 0.007;
    lfo.connect(depth);
    for (const osc of oscillators) depth.connect(osc.frequency);

    for (const [freq, bandwidth, level] of FORMANTS[vowel]) {
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = freq;
      band.Q.value = freq / bandwidth;
      const g = ctx.createGain();
      g.gain.value = level * 3;
      mix.connect(band).connect(g).connect(env);
    }
    env.connect(bus);
    const send = ctx.createGain();
    send.gain.value = 0.7;
    env.connect(send).connect(this.reverbIn);

    const end = start + duration + 0.1;
    for (const o of [...oscillators, lfo]) {
      o.start(start);
      o.stop(end);
    }
    return {
      stop: (when: number) => {
        env.gain.cancelScheduledValues(when);
        env.gain.setTargetAtTime(0, when, 0.4);
        for (const o of [...oscillators, lfo]) o.stop(when + 2);
      },
    };
  }

  private chordNotes(step: number) {
    const { root, mode, progression } = this.key;
    const degree = progression[step % progression.length];
    const tone = (d: number) => root + mode[d % 7] + 12 * Math.floor(d / 7);
    const [a, b, c] = [tone(degree), tone(degree + 2), tone(degree + 4)];
    return [a - 12, a, c, b + 12, a + 12, c + 12, b + 24];
  }

  private playChord() {
    if (!this.ctx) return;
    const start = this.now + 0.05;
    const notes = this.chordNotes(this.chordStep++);
    const vowels: Vowel[] = ["u", "o", "a", "a", "e", "o", "a"];
    this.held = [];
    for (let i = 0; i < Math.min(this.voices, notes.length); i++) {
      const gain = i === 0 ? 0.05 : 0.032 - i * 0.002;
      this.held.push(this.sing(notes[i], start + i * 0.12, 9.6, gain, vowels[i], this.choirBus, 2.2, 2.6));
    }
  }

  /** Starts (or retunes) the choir. `voices` grows with the verses recovered. */
  startChoir(key: Key, voices: number) {
    if (!this.ctx) return;
    this.key = key;
    this.voices = voices;
    this.chordStep = 0;
    this.stopChoir();
    this.playChord();
    this.chordTimer = setInterval(() => this.playChord(), 7200);
  }

  setVoices(voices: number) {
    if (!this.ctx || voices <= this.voices) {
      this.voices = voices;
      return;
    }
    // The new voice enters right away, so the player hears the choir grow.
    const notes = this.chordNotes(Math.max(0, this.chordStep - 1));
    const i = Math.min(voices, notes.length) - 1;
    this.voices = voices;
    this.held.push(this.sing(notes[i], this.now + 0.05, 6.5, 0.03, i % 2 ? "a" : "o", this.choirBus, 1.2, 2.4));
  }

  stopChoir() {
    if (this.chordTimer) clearInterval(this.chordTimer);
    this.chordTimer = null;
    if (!this.ctx) return;
    for (const v of this.held) v.stop(this.now);
    this.held = [];
  }

  // ----- Battle music ------------------------------------------------------

  setBattle(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = this.now;
    this.choirBus.gain.setTargetAtTime(on ? 0.2 : 1, t, 0.6);
    if (on && !this.battle) {
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.5, t + 1.2);
      out.connect(this.musicBus);
      const drone = ctx.createOscillator();
      drone.type = "sawtooth";
      drone.frequency.value = hz(this.key.root - 24);
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 260;
      const trem = ctx.createGain();
      trem.gain.value = 0.18;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.1;
      lfo.connect(lfoDepth).connect(trem.gain);
      drone.connect(low).connect(trem).connect(out);
      const high = ctx.createOscillator();
      high.type = "triangle";
      high.frequency.value = hz(this.key.root + 13);
      const highGain = ctx.createGain();
      highGain.gain.value = 0.012;
      high.connect(highGain).connect(out);
      drone.start();
      lfo.start();
      high.start();
      const beat = () => {
        const s = this.now + 0.02;
        this.thump(s, 0.5, out);
        this.thump(s + 0.2, 0.32, out);
      };
      beat();
      this.battle = { nodes: [drone, lfo, high, out], timer: setInterval(beat, 820) };
    } else if (!on && this.battle) {
      const { nodes, timer } = this.battle;
      clearInterval(timer);
      const out = nodes[3] as GainNode;
      out.gain.setTargetAtTime(0, t, 0.3);
      for (const n of nodes.slice(0, 3)) (n as OscillatorNode).stop(t + 1.5);
      this.battle = null;
    }
  }

  private thump(start: number, gain: number, bus: AudioNode) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(70, start);
    osc.frequency.exponentialRampToValueAtTime(38, start + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
    osc.connect(g).connect(bus);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  // ----- Ambience ----------------------------------------------------------

  setRain(on: boolean) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (on && !this.rain) {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const high = ctx.createBiquadFilter();
      high.type = "highpass";
      high.frequency.value = 500;
      const low = ctx.createBiquadFilter();
      low.type = "lowpass";
      low.frequency.value = 3200;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, this.now);
      gain.gain.linearRampToValueAtTime(0.06, this.now + 2);
      source.connect(high).connect(low).connect(gain).connect(this.fxBus);
      source.start();
      this.rain = { source, gain };
    } else if (!on && this.rain) {
      this.rain.gain.gain.setTargetAtTime(0, this.now, 0.4);
      this.rain.source.stop(this.now + 2);
      this.rain = null;
    }
  }

  stopAll() {
    this.stopChoir();
    this.setBattle(false);
    this.setRain(false);
  }

  // ----- Effects -----------------------------------------------------------

  private tone(
    freq: number,
    start: number,
    duration: number,
    { type = "sine", gain = 0.2, attack = 0.005, end, pan = 0, wet = 0.2 }: { type?: OscillatorType; gain?: number; attack?: number; end?: number; pan?: number; wet?: number } = {},
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (end) osc.frequency.exponentialRampToValueAtTime(end, start + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    osc.connect(g).connect(panner).connect(this.fxBus);
    if (wet) {
      const send = ctx.createGain();
      send.gain.value = wet;
      panner.connect(send).connect(this.reverbIn);
    }
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private hiss(
    start: number,
    duration: number,
    { freq = 1000, end, q = 1, gain = 0.1, type = "bandpass", pan = 0, wet = 0.1 }: { freq?: number; end?: number; q?: number; gain?: number; type?: BiquadFilterType; pan?: number; wet?: number } = {},
  ) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, start);
    if (end) filter.frequency.exponentialRampToValueAtTime(end, start + duration);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, duration / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter).connect(g).connect(panner).connect(this.fxBus);
    if (wet) {
      const send = ctx.createGain();
      send.gain.value = wet;
      panner.connect(send).connect(this.reverbIn);
    }
    source.start(start, Math.random());
    source.stop(start + duration + 0.05);
  }

  private bell(freq: number, start: number, gain = 0.08, decay = 1.8) {
    this.tone(freq, start, decay, { gain, wet: 0.6 });
    this.tone(freq * 2.76, start, decay * 0.6, { gain: gain * 0.35, wet: 0.6 });
    this.tone(freq * 5.4, start, decay * 0.3, { gain: gain * 0.15, wet: 0.6 });
  }

  private scaleNote(degree: number, octave = 0) {
    const { root, mode } = this.key;
    return root + mode[((degree % 7) + 7) % 7] + 12 * (octave + Math.floor(degree / 7));
  }

  step(soft: boolean) {
    if (!this.ctx) return;
    this.hiss(this.now, 0.05, { freq: soft ? 420 : 700 + Math.random() * 500, q: 1.4, gain: soft ? 0.03 : 0.045, wet: 0 });
  }

  /** One hand clap of an audience, somewhere to the side. */
  clap(pan: number, gain: number) {
    if (!this.ctx || gain <= 0.002) return;
    this.hiss(this.now, 0.04, { freq: 1500 + Math.random() * 900, q: 0.9, gain, pan: pan + (Math.random() - 0.5) * 0.4, wet: 0.35 });
  }

  bump() {
    if (!this.ctx) return;
    this.tone(95, this.now, 0.14, { gain: 0.16, end: 55, wet: 0 });
  }

  blip(speaker: string) {
    if (!this.ctx) return;
    const t = this.now;
    if (speaker === "angel") this.tone(hz(this.scaleNote(Math.floor(Math.random() * 5), 2)), t, 0.09, { gain: 0.025, wet: 0.5 });
    else if (speaker === "shadow" || speaker === "guardian") this.hiss(t, 0.06, { freq: 260, q: 4, gain: 0.05, wet: 0.2 });
    else if (speaker === "verse") return;
    else this.tone(speaker === "voice" ? 560 : 820, t, 0.03, { type: "triangle", gain: 0.018, wet: 0 });
  }

  move() {
    if (!this.ctx) return;
    this.tone(660, this.now, 0.05, { type: "triangle", gain: 0.04, wet: 0 });
  }

  confirm() {
    if (!this.ctx) return;
    this.tone(660, this.now, 0.07, { type: "triangle", gain: 0.05, wet: 0.1 });
    this.tone(990, this.now + 0.06, 0.12, { type: "triangle", gain: 0.05, wet: 0.2 });
  }

  verse() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 2, 4, 7].forEach((d, i) => this.bell(hz(this.scaleNote(d, 1)), t + i * 0.11, 0.07));
    this.sing(this.scaleNote(4, 0), t, 2.4, 0.04, "a", this.fxBus, 0.25, 1.6);
  }

  /** The voice's own sung note, on the map or in battle. */
  hum(degree: number, quality: "perfect" | "good" | "plain" = "plain") {
    if (!this.ctx) return;
    const t = this.now;
    this.sing(this.scaleNote(degree, 0), t, 0.9, 0.06, "a", this.fxBus, 0.04, 0.6);
    if (quality !== "plain") this.bell(hz(this.scaleNote(degree, 2)), t, quality === "perfect" ? 0.07 : 0.035, 1.2);
  }

  miss() {
    if (!this.ctx) return;
    const t = this.now;
    this.hiss(t, 0.4, { freq: 600, end: 180, q: 3, gain: 0.08 });
    this.tone(hz(this.key.root + 1), t, 0.35, { type: "sawtooth", gain: 0.03, wet: 0.1 });
  }

  hit() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(80, t, 0.6, { gain: 0.3, end: 32, wet: 0.2 });
    this.hiss(t, 0.5, { freq: 900, end: 120, type: "lowpass", gain: 0.2 });
  }

  block() {
    if (!this.ctx) return;
    const t = this.now;
    this.bell(hz(this.scaleNote(0, 2)), t, 0.06, 1);
    this.hiss(t, 0.18, { freq: 2400, q: 2, gain: 0.05 });
  }

  whisper(pan: number, gain = 0.05) {
    if (!this.ctx) return;
    const t = this.now;
    this.hiss(t, 1.3, { freq: 700, end: 1900, q: 9, gain, pan, wet: 0.5 });
    this.hiss(t + 0.35, 1, { freq: 1500, end: 600, q: 9, gain: gain * 0.7, pan, wet: 0.5 });
  }

  heartbeat(intensity: number) {
    if (!this.ctx) return;
    const t = this.now;
    this.thump(t, 0.3 * intensity, this.fxBus);
    this.thump(t + 0.18, 0.2 * intensity, this.fxBus);
  }

  lamp() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 4, 7].forEach((s, i) => this.bell(hz(this.key.root + 12 + s), t + i * 0.07, 0.045, 2.2));
  }

  portal() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(180, t, 2.4, { gain: 0.08, end: 1400, wet: 0.7 });
    [0, 2, 4, 7, 9].forEach((d, i) => this.bell(hz(this.scaleNote(d, 2)), t + 0.5 + i * 0.13, 0.05));
  }

  battleStart() {
    if (!this.ctx) return;
    const t = this.now;
    this.hiss(t, 0.9, { freq: 200, end: 3000, q: 2, gain: 0.14, wet: 0.4 });
    this.tone(hz(this.key.root - 12), t, 1.2, { type: "sawtooth", gain: 0.06, wet: 0.4 });
    this.tone(hz(this.key.root - 11), t, 1.2, { type: "sawtooth", gain: 0.05, wet: 0.4 });
  }

  recall() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 2, 4].forEach((d, i) => this.sing(this.scaleNote(d, i === 0 ? 0 : 1), t, 2.2, 0.05, i ? "a" : "o", this.fxBus, 0.15, 1.4));
    this.bell(hz(this.scaleNote(4, 2)), t + 0.2, 0.06);
  }

  victory() {
    if (!this.ctx) return;
    const t = this.now;
    [0, 2, 4, 7].forEach((d, i) => this.sing(this.scaleNote(d, i > 2 ? 1 : 0), t, 3, 0.045, "a", this.fxBus, 0.3, 2));
    [4, 7, 9, 11].forEach((d, i) => this.bell(hz(this.scaleNote(d, 1)), t + 0.25 + i * 0.12, 0.05));
  }

  defeat() {
    if (!this.ctx) return;
    const t = this.now;
    this.tone(420, t, 1.8, { type: "triangle", gain: 0.08, end: 60, wet: 0.6 });
    this.hiss(t, 1.6, { freq: 1200, end: 90, type: "lowpass", gain: 0.08 });
  }

  thunder(distance: number) {
    if (!this.ctx) return;
    const t = this.now + distance;
    this.hiss(t, 2.8, { freq: 420, end: 60, type: "lowpass", gain: 0.28, wet: 0.5 });
    this.hiss(t + 0.08, 0.5, { freq: 1800, end: 300, type: "lowpass", gain: 0.12, wet: 0.2 });
  }

  reveal() {
    if (!this.ctx) return;
    const t = this.now;
    const notes = this.chordNotes(0);
    notes.forEach((n, i) => this.sing(n, t + i * 0.25, 9, 0.034, i % 2 ? "a" : "o", this.fxBus, 2.5, 4));
    [0, 4, 7, 11, 14].forEach((d, i) => this.bell(hz(this.scaleNote(d, 1)), t + 1.6 + i * 0.22, 0.05, 3));
  }

  ui() {
    if (!this.ctx) return;
    this.tone(520, this.now, 0.05, { type: "triangle", gain: 0.03, wet: 0.1 });
  }
}
