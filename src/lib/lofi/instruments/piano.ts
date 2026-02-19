/**
 * Realistic piano synthesis. See docs/instruments/piano.md.
 */
/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";

/** Piano partial template (7th suppressed for hammer position). See docs/instruments/piano.md */
const PIANO_PARTIALS_BODY: number[] = [
  1.0, 0.71, 0.45, 0.32, 0.2, 0.16, 0.05, 0.1, 0.08, 0.06,
];
const PIANO_PARTIALS_TAIL: number[] = [1.0, 0.4, 0.15, 0.05];

/**
 * Realistic piano: body (detuned unison) + tail + hammer transient.
 */
export class PianoInstrument {
  readonly volume: { value: number };
  private readonly bodyA: InstanceType<typeof Tone.PolySynth>;
  private readonly bodyB: InstanceType<typeof Tone.PolySynth>;
  private readonly tail: InstanceType<typeof Tone.PolySynth>;
  private readonly hammer: InstanceType<typeof Tone.NoiseSynth>;
  private readonly brightnessFilter: InstanceType<typeof Tone.Filter>;
  private readonly hammerFilter: InstanceType<typeof Tone.Filter>;
  private readonly output: InstanceType<typeof Tone.Volume>;

  constructor(filter: Tone.Filter) {
    this.output = new Tone.Volume(-5).connect(filter);
    this.brightnessFilter = new Tone.Filter({
      frequency: 3000,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.output);

    this.bodyA = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: PIANO_PARTIALS_BODY },
      envelope: { attack: 0.005, decay: 1.0, sustain: 0.08, release: 0.8 },
      volume: -8,
    });
    this.bodyA.set({ detune: -3 });
    this.bodyA.connect(this.brightnessFilter);

    this.bodyB = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: PIANO_PARTIALS_BODY },
      envelope: { attack: 0.005, decay: 1.0, sustain: 0.08, release: 0.8 },
      volume: -8,
    });
    this.bodyB.set({ detune: 3 });
    this.bodyB.connect(this.brightnessFilter);

    this.tail = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: PIANO_PARTIALS_TAIL },
      envelope: { attack: 0.01, decay: 4.0, sustain: 0, release: 2.0 },
      volume: -14,
    });
    this.tail.connect(this.brightnessFilter);

    this.hammerFilter = new Tone.Filter({
      frequency: 3000,
      type: "bandpass",
      Q: 2,
    }).connect(filter);
    this.hammer = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.015, sustain: 0 },
      volume: -25,
    });
    this.hammer.connect(this.hammerFilter);

    this.volume = this.output.volume;
  }

  triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time: number,
    velocity = 0.7
  ): void {
    const v = velocity ?? 0.7;
    const filterFreq = 800 + v * 5200;
    this.brightnessFilter.frequency.setValueAtTime(filterFreq, time);
    this.brightnessFilter.frequency.exponentialRampToValueAtTime(
      filterFreq * 0.3,
      time + 1.0
    );

    this.bodyA.triggerAttackRelease(note, duration, time, v);
    this.bodyB.triggerAttackRelease(note, duration, time, v);
    this.tail.triggerAttackRelease(note, duration, time, v * 0.6);
    this.hammer.triggerAttackRelease("16n", time);
  }

  releaseAll(): void {
    this.bodyA.releaseAll();
    this.bodyB.releaseAll();
    this.tail.releaseAll();
  }

  dispose(): void {
    this.bodyA.dispose();
    this.bodyB.dispose();
    this.tail.dispose();
    this.hammer.dispose();
    this.brightnessFilter.dispose();
    this.hammerFilter.dispose();
    this.output.dispose();
  }
}
