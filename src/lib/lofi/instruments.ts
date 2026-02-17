/**
 * Lofi instrument definitions. Each maps to a Tone.js synth configuration.
 * Uses synthesis (no samples) for portability.
 */
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

export interface InstrumentDef {
  id: InstrumentId;
  /** Volume in dB */
  volume: number;
  /** Tone.js synth options for PolySynth/MonoSynth/Synth */
  options: Record<string, unknown>;
  /** "PolySynth" | "MonoSynth" | "Synth" | "PluckSynth" */
  type: string;
}

/** Rhodes-like electric piano (FM) */
export const PIANO_DEF: InstrumentDef = {
  id: "piano",
  volume: -5,
  type: "PolySynth",
  options: {
    harmonicity: 3,
    modulationIndex: 2,
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
  },
};

/** Sustained strings (filtered saw) */
export const VIOLIN_DEF: InstrumentDef = {
  id: "violin",
  volume: -8,
  type: "PolySynth",
  options: {
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 1.2 },
  },
};

/** FM brass */
export const TRUMPET_DEF: InstrumentDef = {
  id: "trumpet",
  volume: -6,
  type: "PolySynth",
  options: {
    harmonicity: 2,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.4 },
  },
};

/** Plucked string (nylon-ish) */
export const GUITAR_DEF: InstrumentDef = {
  id: "guitar",
  volume: -5,
  type: "PluckSynth",
  options: {
    attackNoise: 0.5,
    dampingFactor: 0.8,
    resonance: 0.7,
  },
};

/** Low sustained bass */
export const CONTRABASS_DEF: InstrumentDef = {
  id: "contrabass",
  volume: -4,
  type: "MonoSynth",
  options: {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.6 },
  },
};

/** Sub octave sine */
export const SUBBASS_DEF: InstrumentDef = {
  id: "subbass",
  volume: -3,
  type: "MonoSynth",
  options: {
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 },
  },
};

export const INSTRUMENT_DEFS: Record<InstrumentId, InstrumentDef> = {
  pad: {
    id: "pad",
    volume: -5,
    type: "PolySynth",
    options: {},
  },
  piano: PIANO_DEF,
  violin: VIOLIN_DEF,
  trumpet: TRUMPET_DEF,
  guitar: GUITAR_DEF,
  contrabass: CONTRABASS_DEF,
  subbass: SUBBASS_DEF,
  bass: {
    id: "bass",
    volume: -2,
    type: "MonoSynth",
    options: {
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
    },
  },
  melody: {
    id: "melody",
    volume: -4,
    type: "Synth",
    options: {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 },
    },
  },
  texture: {
    id: "texture",
    volume: -14,
    type: "Synth",
    options: {
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.2, release: 0.8 },
    },
  },
};
