import type { Rng } from "./rng";

export type MidiNote = number;

const CHORD_SHAPES: Record<string, number[]> = {
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  maj: [0, 4, 7],
  min: [0, 3, 7],
  add9: [0, 4, 7, 14],
  min9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7, 10],
};

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  minPenta: [0, 3, 5, 7, 10],
};

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const CIRCLE_OF_FIFTHS = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "Db",
  "Ab",
  "Eb",
  "Bb",
  "F",
];

/** Diatonic chord qualities per scale degree (1-based). Major scale. */
const DIATONIC_MAJOR: Record<number, string> = {
  1: "maj7",
  2: "min7",
  3: "min7",
  4: "maj7",
  5: "dom7",
  6: "min7",
  7: "m7b5",
};

/** Minor / Dorian */
const DIATONIC_MINOR: Record<number, string> = {
  1: "min7",
  2: "m7b5",
  3: "maj7",
  4: "min7",
  5: "min7",
  6: "maj7",
  7: "dom7",
};

export function midiToName(midi: MidiNote): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIdx = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIdx]}${octave}`;
}

const NOTE_NAME_REGEX = /^([A-G]#?)(-?\d+)$/;

export function nameToMidi(name: string): MidiNote {
  const m = name.match(NOTE_NAME_REGEX);
  if (!m) {
    return 60;
  }
  const noteIdx = NOTE_NAMES.indexOf(m[1]);
  const octave = Number.parseInt(m[2], 10);
  if (noteIdx === -1) {
    return 60;
  }
  return (octave + 1) * 12 + noteIdx;
}

export function buildChord(rootMidi: MidiNote, quality: string): MidiNote[] {
  const shape = CHORD_SHAPES[quality] ?? CHORD_SHAPES.maj7;
  return shape.map((interval) => rootMidi + interval);
}

export function invertChord(notes: MidiNote[], inversion: number): MidiNote[] {
  if (inversion <= 0 || inversion >= notes.length) {
    return [...notes];
  }
  const out = [...notes];
  for (let i = 0; i < inversion; i++) {
    out[i] += 12;
  }
  return out.sort((a, b) => a - b);
}

/** Two-hand spread: LH root+5th low, RH 3rd+7th high */
export function spreadChord(rootMidi: MidiNote, quality: string): MidiNote[] {
  const shape = CHORD_SHAPES[quality] ?? CHORD_SHAPES.maj7;
  const notes = shape.map((i) => rootMidi + i);
  const root = notes[0];
  const idx5 = shape.indexOf(7);
  const fifth = idx5 >= 0 ? notes[idx5] : root + 7;
  const upper = notes.filter((n) => n !== root && n !== fifth);
  const left = [root - 12, fifth - 12];
  const right = upper.length > 0 ? upper : [root + 4];
  return [...left, ...right].sort((a, b) => a - b).filter((n) => n >= 28);
}

export function getScaleNotes(
  rootName: string,
  scaleType: string,
  octaveLow: number,
  octaveHigh: number
): MidiNote[] {
  const scale = SCALES[scaleType] ?? SCALES.major;
  const rootMidi = nameToMidi(`${rootName}4`);
  const rootPitch = rootMidi % 12;
  const result: MidiNote[] = [];
  for (let oct = octaveLow; oct <= octaveHigh; oct++) {
    const base = (oct + 1) * 12;
    for (const offset of scale) {
      const pitchClass = (rootPitch + offset + 12) % 12;
      result.push(base + pitchClass);
    }
  }
  return result.sort((a, b) => a - b);
}

/** Build scale as semitone offsets from root (for motif generation) */
export function buildScale(rootName: string, scaleType: string): number[] {
  const scale = SCALES[scaleType] ?? SCALES.major;
  const rootPitch = nameToMidi(`${rootName}4`) % 12;
  return scale.map((s) => (rootPitch + s) % 12);
}

/** Pick a neighboring key (circle of fifths distance 1-2, or relative minor/major) */
export function pickRelatedKey(currentKey: string, rng: Rng): string {
  const idx = CIRCLE_OF_FIFTHS.indexOf(currentKey);
  if (idx === -1) {
    return currentKey;
  }
  const options: string[] = [];
  options.push(CIRCLE_OF_FIFTHS[(idx + 1) % 12]);
  options.push(CIRCLE_OF_FIFTHS[(idx - 1 + 12) % 12]);
  options.push(CIRCLE_OF_FIFTHS[(idx + 2) % 12]);
  options.push(CIRCLE_OF_FIFTHS[(idx - 2 + 12) % 12]);
  return rng.pick(options);
}

/** 7-note scale for chord degree resolution (pentatonic uses major/minor) */
const CHORD_SCALES: Record<string, number[]> = {
  major: SCALES.major,
  minor: SCALES.minor,
  dorian: SCALES.dorian,
  pentatonic: SCALES.major,
  minPenta: SCALES.minor,
};

/** Get diatonic chord for a scale degree (1-based). degree 2 in C major = Dm7. */
export function diatonicChord(
  key: string,
  scaleType: string,
  degree: number
): { root: MidiNote; quality: string } {
  const scale = CHORD_SCALES[scaleType] ?? CHORD_SCALES.major;
  const rootMidi = nameToMidi(`${key}4`);
  const diatonic =
    scaleType === "minor" || scaleType === "minPenta" || scaleType === "dorian"
      ? DIATONIC_MINOR
      : DIATONIC_MAJOR;
  const normDegree = ((((degree - 1) % 7) + 7) % 7) + 1;
  const quality = diatonic[normDegree] ?? "maj7";
  const degreeIdx = (((degree - 1) % 7) + 7) % 7;
  const degreeSemitone = scale[degreeIdx] ?? 0;
  const chordRootMidi = rootMidi + degreeSemitone;
  return { root: chordRootMidi, quality };
}

/** Resolve [degree, quality] template to { root, quality } using key and scaleType */
export function resolveChordFromTemplate(
  key: string,
  scaleType: string,
  [degree, quality]: [number, string]
): { root: MidiNote; quality: string } {
  const { root } = diatonicChord(key, scaleType, degree);
  return { root, quality };
}
