/**
 * Lofi instrument controller. Owns and manages all Tone.js synths.
 */
/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";
import { PianoInstrument } from "./instruments/piano";

export type InstrumentId =
  | "pad"
  | "piano"
  | "violin"
  | "trumpet"
  | "guitar"
  | "contrabass"
  | "subbass"
  | "bass"
  | "melody"
  | "texture";

export const INSTRUMENT_IDS = [
  "pad",
  "melody",
  "bass",
  "subbass",
  "texture",
  "piano",
  "violin",
  "trumpet",
  "guitar",
  "contrabass",
  "kick",
  "snare",
  "hihat",
] as const;
export type InstrumentVolumeId = (typeof INSTRUMENT_IDS)[number];

export const BASE_VOLUMES: Record<InstrumentVolumeId, number> = {
  pad: -14,
  melody: 0,
  bass: -5,
  subbass: -6,
  texture: -14,
  piano: -5,
  violin: -14,
  trumpet: -6,
  guitar: -5,
  contrabass: -7,
  kick: 0,
  snare: 0,
  hihat: -5,
};

export interface InstrumentsDestinations {
  drumComp: Tone.Compressor;
  filter: Tone.Filter;
  hihatFilter: Tone.Filter;
  snareFilter: Tone.Filter;
}

export class Instruments {
  readonly pad: InstanceType<typeof Tone.PolySynth>;
  readonly melody: InstanceType<typeof Tone.Synth>;
  readonly bass: InstanceType<typeof Tone.MonoSynth>;
  readonly subbass: InstanceType<typeof Tone.MonoSynth>;
  readonly texture: InstanceType<typeof Tone.Synth>;
  readonly piano: PianoInstrument;
  readonly violin: InstanceType<typeof Tone.PolySynth>;
  readonly trumpet: InstanceType<typeof Tone.PolySynth>;
  readonly guitar: InstanceType<typeof Tone.PluckSynth>;
  readonly contrabass: InstanceType<typeof Tone.MonoSynth>;
  readonly kick: InstanceType<typeof Tone.MembraneSynth>;
  readonly snare: InstanceType<typeof Tone.NoiseSynth>;
  readonly hihat: InstanceType<typeof Tone.NoiseSynth>;

  private bassBaseVolume = -5;

  constructor(dest: InstrumentsDestinations) {
    const { filter, drumComp, snareFilter, hihatFilter } = dest;

    this.pad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.45, decay: 0.25, sustain: 0.55, release: 1.6 },
      volume: -14,
    }).connect(filter);

    this.melody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 },
    }).connect(filter);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
    }).connect(filter);

    this.texture = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.2, release: 0.8 },
      volume: -14,
    }).connect(filter);

    this.subbass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 },
      volume: -6,
    }).connect(filter);

    this.piano = new PianoInstrument(filter);

    this.violin = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.35, decay: 0.25, sustain: 0.5, release: 1.2 },
      volume: -14,
    }).connect(filter);

    this.trumpet = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.4 },
      volume: -6,
    }).connect(filter);

    this.guitar = new Tone.PluckSynth({
      attackNoise: 0.5,
      dampening: 3000,
      resonance: 0.7,
      volume: -5,
    }).connect(filter);

    this.contrabass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.6 },
      volume: -7,
    }).connect(filter);

    this.kick = new Tone.MembraneSynth({
      envelope: { attack: 0.01, decay: 0.3, sustain: 0 },
      octaves: 4,
      pitchDecay: 0.05,
    }).connect(drumComp);

    this.snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.22, sustain: 0 },
      volume: 0,
    }).connect(snareFilter);

    this.hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -5,
    }).connect(hihatFilter);
  }

  /** Configure pad, melody, bass from preset. Returns bass base volume for volume calculations. */
  configurePreset(preset: {
    pad: { options: Record<string, unknown> };
    melody: { options: Record<string, unknown>; volume: number };
    bass: { options: Record<string, unknown>; volume: number };
  }): number {
    this.pad.set(preset.pad.options as object);
    this.melody.set(preset.melody.options as object);
    this.bass.set(preset.bass.options as object);
    this.bassBaseVolume = preset.bass.volume - 3;
    return this.bassBaseVolume;
  }

  applyVolumes(
    vols: Partial<Record<InstrumentVolumeId, number>>,
    bassBaseVolume?: number
  ): void {
    const base = bassBaseVolume ?? this.bassBaseVolume;
    const dbFromSlider = (v: number) => (v / 100 - 1) * 24;
    const set = (
      id: InstrumentVolumeId,
      synth: { volume: { value: number } }
    ) => {
      const b = id === "bass" ? base : BASE_VOLUMES[id];
      const slider = vols[id] ?? 100;
      synth.volume.value = b + dbFromSlider(slider);
    };
    set("pad", this.pad);
    set("melody", this.melody);
    set("bass", this.bass);
    set("subbass", this.subbass);
    set("texture", this.texture);
    set("piano", this.piano);
    set("violin", this.violin);
    set("trumpet", this.trumpet);
    set("guitar", this.guitar);
    set("contrabass", this.contrabass);
    set("kick", this.kick);
    set("snare", this.snare);
    set("hihat", this.hihat);
  }

  releaseAll(): void {
    this.pad.releaseAll();
    this.melody.triggerRelease();
    this.bass.triggerRelease();
    this.subbass.triggerRelease();
    this.contrabass.triggerRelease();
    this.texture.triggerRelease();
    this.piano.releaseAll();
    this.violin.releaseAll();
    this.trumpet.releaseAll();
    this.guitar.triggerRelease();
  }

  getMelodicSynths(): Record<
    InstrumentId,
    | InstanceType<typeof Tone.PolySynth>
    | InstanceType<typeof Tone.MonoSynth>
    | InstanceType<typeof Tone.Synth>
    | InstanceType<typeof Tone.PluckSynth>
    | PianoInstrument
  > {
    return {
      pad: this.pad,
      melody: this.melody,
      bass: this.bass,
      texture: this.texture,
      subbass: this.subbass,
      piano: this.piano,
      violin: this.violin,
      trumpet: this.trumpet,
      guitar: this.guitar,
      contrabass: this.contrabass,
    };
  }

  dispose(): void {
    this.pad.dispose();
    this.melody.dispose();
    this.bass.dispose();
    this.subbass.dispose();
    this.texture.dispose();
    this.piano.dispose();
    this.violin.dispose();
    this.trumpet.dispose();
    this.guitar.dispose();
    this.contrabass.dispose();
    this.kick.dispose();
    this.snare.dispose();
    this.hihat.dispose();
  }
}
