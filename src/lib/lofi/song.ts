/**
 * Song and SongBuilder. Song holds generated structure and events.
 * SongBuilder provides fluent API with shared params for easy construction.
 */
import type { InstrumentId } from "./instruments";
import {
  buildChord,
  buildScale,
  midiToName,
  resolveChordFromTemplate,
  spreadChord,
} from "./music-theory";
import {
  type ChordProgressionTemplate,
  type LofiPreset,
  PRESETS,
} from "./presets";
import { Rng } from "./rng";

export interface NoteEvent {
  duration: string;
  note: string;
  time: string;
  velocity: number;
}

export interface InstrumentNoteEvent extends NoteEvent {
  instrument: InstrumentId;
}

export interface DrumEvent {
  instrument: "kick" | "snare" | "hihat";
  time: string;
  velocity: number;
}

export type SectionName = "intro" | "verse" | "chorus" | "bridge" | "outro";

export interface SongSection {
  bars: number;
  drumEvents: DrumEvent[];
  instrumentEvents: InstrumentNoteEvent[];
  name: SectionName;
  padVolume: number;
  startBar: number;
}

export interface SongFXParams {
  crackleMix: number;
  delayMix: number;
  filterCutoff: number;
  reverbDecay: number;
  reverbMix: number;
}

interface Motif {
  degrees: number[];
  durations: string[];
  velocities: number[];
}

const SECTION_STRUCTURES: SectionName[][] = [
  ["intro", "verse", "chorus", "verse", "bridge", "chorus", "outro"],
  ["intro", "verse", "chorus", "verse", "chorus", "outro"],
  ["intro", "verse", "verse", "bridge", "chorus", "outro"],
  ["verse", "chorus", "verse", "bridge", "chorus"],
];

const SECTION_BARS: Record<SectionName, [number, number]> = {
  intro: [2, 4],
  verse: [4, 8],
  chorus: [4, 8],
  bridge: [4, 8],
  outro: [2, 4],
};

const CHORD_VELOCITIES = [0.88, 0.72, 0.62, 0.55];

function maybeSusQuality(q: string, rng: Rng, prob: number): string {
  if (prob <= 0 || !rng.chance(prob)) {
    return q;
  }
  if (q === "maj") {
    return rng.chance(0.5) ? "sus2" : "sus4";
  }
  if (q === "min") {
    return "sus4";
  }
  return q;
}

function chordAtBar(
  key: string,
  progression: ChordProgressionTemplate,
  preset: LofiPreset,
  bar: number
): number {
  const template = progression[bar % progression.length];
  const { root } = resolveChordFromTemplate(key, preset.scaleType, template);
  return root;
}

export class Song {
  readonly seed: number;
  readonly preset: LofiPreset;
  readonly key: string;
  readonly tempo: number;
  readonly swing: number;
  readonly sections: SongSection[];
  readonly totalBars: number;
  readonly fxParams: SongFXParams;

  constructor(
    seed: number,
    preset: LofiPreset,
    key: string,
    tempo: number,
    swing: number,
    sections: SongSection[],
    totalBars: number,
    fxParams: SongFXParams
  ) {
    this.seed = seed;
    this.preset = preset;
    this.key = key;
    this.tempo = tempo;
    this.swing = swing;
    this.sections = sections;
    this.totalBars = totalBars;
    this.fxParams = fxParams;
  }

  /** Backward compat: same shape as previous GeneratedSong */
  get presetName(): string {
    return this.preset.name;
  }
}

export class SongBuilder {
  private readonly seed: number;
  private rng: Rng;
  private _preset?: LofiPreset;
  private _key?: string;
  private _tempo?: number;
  private _structure?: { names: SectionName[]; bars: number[] };
  private _progression?: ChordProgressionTemplate;

  private constructor(seed: number) {
    this.seed = seed;
    this.rng = new Rng(seed);
  }

  static fromSeed(seed: number): SongBuilder {
    return new SongBuilder(seed);
  }

  preset(p: LofiPreset): this {
    this._preset = p;
    return this;
  }

  key(k: string): this {
    this._key = k;
    return this;
  }

  tempo(t: number): this {
    this._tempo = t;
    return this;
  }

  structure(names: SectionName[], bars: number[]): this {
    this._structure = { names, bars };
    return this;
  }

  progression(p: ChordProgressionTemplate): this {
    this._progression = p;
    return this;
  }

  build(): Song {
    const preset = this._preset ?? this.rng.pick(PRESETS);
    const key = this._key ?? this.rng.pick(preset.keys);
    const tempo =
      this._tempo ?? this.rng.int(preset.tempoRange[0], preset.tempoRange[1]);
    const scale = buildScale(key, preset.scaleType);
    const structure =
      this._structure ??
      (() => {
        const names = this.rng.pick(SECTION_STRUCTURES);
        const bars: number[] = [];
        for (const name of names) {
          const [minBars, maxBars] = SECTION_BARS[name];
          bars.push(this.rng.int(minBars, maxBars));
        }
        return { names, bars };
      })();
    const progression = this._progression ?? this.rng.pick(preset.progressions);

    const motif = this.generateMotif(scale, preset.motifLength);
    const sections: SongSection[] = [];
    let startBar = 0;

    for (let i = 0; i < structure.names.length; i++) {
      const name = structure.names[i];
      const sectionBars = structure.bars[i];
      const section: SongSection = {
        name,
        startBar,
        bars: sectionBars,
        instrumentEvents: [],
        drumEvents: [],
        padVolume: 0,
      };

      const allInstrumentEvents: InstrumentNoteEvent[] = [];
      allInstrumentEvents.push(
        ...this.resolveChords(key, progression, preset, startBar, sectionBars)
      );
      allInstrumentEvents.push(
        ...this.generateMelody(
          motif,
          scale,
          section,
          key,
          progression,
          preset,
          startBar
        )
      );
      allInstrumentEvents.push(
        ...this.generateBass(key, progression, preset, section, startBar)
      );
      allInstrumentEvents.push(
        ...this.generateTexture(key, progression, preset, section, startBar)
      );

      if (this.rng.chance(0.6)) {
        allInstrumentEvents.push(
          ...this.generateSubbass(key, progression, preset, section, startBar)
        );
      }
      if (this.rng.chance(0.35)) {
        allInstrumentEvents.push(
          ...this.generateContrabass(
            key,
            progression,
            preset,
            section,
            startBar
          )
        );
      }

      const extraInstruments = preset.extraInstruments ?? [
        { id: "piano", probability: 0.4 },
        { id: "violin", probability: 0.25 },
        { id: "guitar", probability: 0.2 },
      ];
      for (const { id, probability } of extraInstruments) {
        if (this.rng.chance(probability)) {
          allInstrumentEvents.push(
            ...this.generateExtraInstrument(
              id as InstrumentId,
              key,
              progression,
              preset,
              section,
              startBar
            )
          );
        }
      }

      section.instrumentEvents = allInstrumentEvents;
      section.drumEvents = this.generateDrums(preset, section, startBar);
      section.padVolume = this.sectionPadVolume(section);
      sections.push(section);
      startBar += sectionBars;
    }

    const fxParams = this.generateFXParams(preset);

    return new Song(
      this.seed,
      preset,
      key,
      tempo,
      preset.swing,
      sections,
      startBar,
      fxParams
    );
  }

  private generateMotif(scale: number[], lengthRange: [number, number]): Motif {
    const rng = this.rng.fork();
    const len = rng.int(lengthRange[0], lengthRange[1]);
    const scaleLen = scale.length;
    const chordTones = [0, 2, 4];
    const startDeg = rng.pick(chordTones);
    const degrees: number[] = [startDeg];
    for (let i = 1; i < len; i++) {
      const last = degrees.at(-1) ?? 0;
      const move = rng.weightedPick(
        [-1, -2, -3, 1, 2, 3],
        [35, 10, 5, 35, 10, 5]
      );
      let next = last + move;
      next = Math.max(0, Math.min(scaleLen - 1, next));
      degrees.push(next);
    }
    const durations = [];
    for (let i = 0; i < len; i++) {
      durations.push(rng.weightedPick(["8n", "4n", "2n"], [70, 25, 5]));
    }
    const velocities = [];
    for (let i = 0; i < len; i++) {
      const t = i / Math.max(1, len - 1);
      const arc = 0.5 + 0.35 * Math.sin(t * Math.PI);
      velocities.push(0.6 + rng.gaussian(0, 0.08) + arc * 0.2);
    }
    return { degrees, durations, velocities };
  }

  private varyMotif(motif: Motif, amount: number): Motif {
    const rng = this.rng.fork();
    if (amount <= 0) {
      return {
        ...motif,
        degrees: [...motif.degrees],
        durations: [...motif.durations],
        velocities: [...motif.velocities],
      };
    }
    const degrees = [...motif.degrees];
    const durations = [...motif.durations];
    const velocities = [...motif.velocities];
    const scaleLen = 7;
    if (rng.chance(amount * 0.3) && degrees.length > 0) {
      const i = rng.int(0, degrees.length - 1);
      degrees[i] = Math.max(
        0,
        Math.min(scaleLen - 1, degrees[i] + rng.pick([-1, 1]))
      );
    }
    if (rng.chance(amount * 0.2) && degrees.length >= 2) {
      const i = rng.int(0, degrees.length - 2);
      [degrees[i], degrees[i + 1]] = [degrees[i + 1], degrees[i]];
    }
    if (rng.chance(amount * 0.2)) {
      durations[rng.int(0, durations.length - 1)] = rng.pick([
        "8n",
        "4n",
        "2n",
      ]);
    }
    if (rng.chance(amount * 0.15) && degrees.length > 0) {
      const i = rng.int(0, degrees.length - 1);
      degrees[i] = -1;
    }
    return { degrees, durations, velocities };
  }

  private invertMotif(motif: Motif): Motif {
    if (motif.degrees.length === 0) {
      return motif;
    }
    const first = motif.degrees[0];
    const degrees = motif.degrees.map((d) =>
      d === -1 ? -1 : first - (d - first)
    );
    return {
      degrees,
      durations: [...motif.durations],
      velocities: [...motif.velocities],
    };
  }

  private fragmentMotif(motif: Motif, keepRatio: number): Motif {
    const keep = Math.max(1, Math.floor(motif.degrees.length * keepRatio));
    return {
      degrees: motif.degrees.slice(0, keep),
      durations: motif.durations.slice(0, keep),
      velocities: motif.velocities.slice(0, keep),
    };
  }

  private resolveChords(
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    sectionStartBar: number,
    sectionBars: number
  ): InstrumentNoteEvent[] {
    const rng = this.rng.fork();
    const events: InstrumentNoteEvent[] = [];
    const len = progression.length;
    const chordBars = preset.chordDurationBars ?? 1;
    const padVol = preset.pad.volume;
    const baseVel = Math.max(0.5, 0.7 + padVol / 25);
    const voicingModes = preset.chordVoicing ?? ["block"];
    const susProb = preset.susChordProbability ?? 0;

    for (let bar = 0; bar < sectionBars; bar += chordBars) {
      const [degree, quality] = progression[(bar / chordBars) % len];
      let q = quality;
      if (
        preset.useSoftVoicings &&
        (quality === "maj7" || quality === "min7")
      ) {
        q = quality === "maj7" ? "maj" : "min";
      }
      q = maybeSusQuality(q, rng, susProb);
      const { root } = resolveChordFromTemplate(key, preset.scaleType, [
        degree,
        q,
      ]);
      const mode = rng.pick(voicingModes);
      const duration = chordBars === 2 ? "2m" : "1n";
      const baseTime = `${sectionStartBar + bar}:0:0`;

      const chordNotes =
        mode === "spread"
          ? spreadChord(root, q)
          : buildChord(root, q)
              .map((n) => n - 12)
              .filter((n) => n >= 28);

      const voicing: { note: string; velocity: number }[] = [];
      for (let i = 0; i < chordNotes.length; i++) {
        const velCurve = CHORD_VELOCITIES[i] ?? 0.6;
        const jitter = rng.gaussian(0, 0.02);
        voicing.push({
          note: midiToName(chordNotes[i]),
          velocity: Math.max(0.35, Math.min(0.65, baseVel * velCurve + jitter)),
        });
      }

      if (mode === "block") {
        for (const v of voicing) {
          events.push({
            time: baseTime,
            note: v.note,
            duration,
            velocity: v.velocity,
            instrument: "pad",
          });
        }
      } else if (mode === "broken" || mode === "arpeggio") {
        const step = "8n";
        const ordering = rng.chance(0.5)
          ? [...voicing]
          : [...voicing].reverse();
        for (let i = 0; i < ordering.length; i++) {
          const v = ordering[i];
          const sixteenth = i * 2;
          const beat = Math.floor(sixteenth / 4);
          const rem = sixteenth % 4;
          const time = `${sectionStartBar + bar}:${beat}:${rem}`;
          events.push({
            time,
            note: v.note,
            duration: step,
            velocity: v.velocity,
            instrument: "pad",
          });
        }
      } else {
        for (const v of voicing) {
          events.push({
            time: baseTime,
            note: v.note,
            duration,
            velocity: v.velocity,
            instrument: "pad",
          });
        }
      }
    }
    return events;
  }

  private generateMelody(
    motif: Motif,
    scale: number[],
    section: SongSection,
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const rng = this.rng.fork();
    const restProb = preset.melodyRestProbability;
    const events: InstrumentNoteEvent[] = [];
    if (section.name === "intro") {
      return events;
    }

    const twoBarSlots = Math.floor(section.bars / 2);
    const scaleLen = scale.length;

    for (let slot = 0; slot < twoBarSlots; slot++) {
      let m: Motif = motif;
      if (section.name === "verse") {
        m = this.varyMotif(motif, 0.2);
      } else if (section.name === "chorus") {
        m = rng.chance(0.5) ? this.invertMotif(motif) : motif;
        m = this.varyMotif(m, 0.15);
      } else if (section.name === "bridge") {
        m = this.fragmentMotif(motif, 0.4);
        if (rng.chance(restProb * 1.5)) {
          continue;
        }
      } else if (section.name === "outro") {
        m = this.fragmentMotif(motif, 0.3);
        m = {
          ...m,
          durations: m.durations.map((d) =>
            d === "8n" ? "4n" : d === "4n" ? "2n" : d
          ),
        };
      }

      const slotStartBar = sectionStartBar + slot * 2;
      let sixteenth = 0;
      const durTo16 = (d: string) =>
        d === "8n" ? 2 : d === "4n" ? 4 : d === "2n" ? 8 : 2;

      for (let i = 0; i < m.degrees.length; i++) {
        if (m.degrees[i] === -1) {
          continue;
        }
        if (rng.chance(restProb)) {
          continue;
        }

        const deg = m.degrees[i];
        const pitchClass = scale[((deg % scaleLen) + scaleLen) % scaleLen];
        const octaveOffset = deg >= scaleLen ? 1 : deg < 0 ? -1 : 0;
        const midi = 60 + pitchClass + octaveOffset * 12;
        const note = midiToName(midi);

        const bar = slotStartBar + Math.floor(sixteenth / 16);
        const rem = sixteenth % 16;
        const beat = Math.floor(rem / 4);
        const sixteen = rem % 4;
        const time = `${bar}:${beat}:${sixteen}`;

        let vel = Math.max(
          0.2,
          Math.min(1, m.velocities[i] + rng.gaussian(0, 0.08))
        );

        const chordRoot = chordAtBar(key, progression, preset, bar);
        const chordPitch = chordRoot % 12;
        const notePitch = midi % 12;
        if (
          notePitch === chordPitch ||
          notePitch === (chordPitch + 4) % 12 ||
          notePitch === (chordPitch + 7) % 12
        ) {
          vel = Math.min(1, vel * 1.1);
        }

        events.push({
          time,
          note,
          duration: m.durations[i],
          velocity: vel,
          instrument: "melody",
        });
        sixteenth += durTo16(m.durations[i]);
      }
    }
    return events;
  }

  private generateBass(
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const rng = this.rng.fork();
    const events: InstrumentNoteEvent[] = [];
    const len = progression.length;
    const isSparse =
      section.name === "intro" ||
      section.name === "outro" ||
      section.name === "bridge";
    const step = isSparse ? 2 : 1;
    const chordBars = preset.chordDurationBars ?? 1;
    const intensity =
      section.name === "chorus" ? 0.92 : section.name === "verse" ? 0.85 : 0.7;

    for (let bar = 0; bar < section.bars; bar++) {
      const template = progression[Math.floor(bar / chordBars) % len];
      const { root } = resolveChordFromTemplate(
        key,
        preset.scaleType,
        template
      );
      const bassRoot = root - 12;
      const bass5th = root - 12 + 7;
      const rootNote = midiToName(bassRoot);
      const fifthNote = midiToName(bass5th);

      for (let beat = 0; beat < 4; beat += step) {
        const time = `${sectionStartBar + bar}:${beat}:0`;
        const useFifth = beat === 2 && !isSparse && rng.chance(0.25);
        const note = useFifth ? fifthNote : rootNote;
        const vel = 0.78 + rng.gaussian(0, 0.05);
        events.push({
          time,
          note,
          duration: isSparse ? "2n" : "4n",
          velocity: Math.max(0.5, Math.min(1, vel * intensity)),
          instrument: "bass",
        });
        if (beat === 3 && !isSparse && rng.chance(0.2) && chordBars === 1) {
          const nextTemplate = progression[(bar + 1) % len];
          const nextRoot =
            resolveChordFromTemplate(key, preset.scaleType, nextTemplate).root -
            12;
          events.push({
            time: `${sectionStartBar + bar}:3:2`,
            note: midiToName(nextRoot - 1),
            duration: "8n",
            velocity: 0.6,
            instrument: "bass",
          });
        }
      }
    }
    return events;
  }

  private generateTexture(
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const rng = this.rng.fork();
    const events: InstrumentNoteEvent[] = [];
    if (section.name === "intro" || section.name === "outro") {
      return events;
    }
    const len = progression.length;
    const chordBars = preset.chordDurationBars ?? 1;

    for (let bar = 0; bar < section.bars; bar++) {
      const template = progression[Math.floor(bar / chordBars) % len];
      const { root } = resolveChordFromTemplate(
        key,
        preset.scaleType,
        template
      );
      let q = template[1];
      if (preset.useSoftVoicings && (q === "maj7" || q === "min7")) {
        q = q === "maj7" ? "maj" : "min";
      }
      const tones = buildChord(root, q);
      const highTones = tones
        .map((m) => m + 24)
        .filter((m) => m >= 72 && m <= 84);
      if (highTones.length === 0) {
        continue;
      }
      const density =
        section.name === "chorus" ? 0.5 : section.name === "verse" ? 0.4 : 0.25;
      if (!rng.chance(density)) {
        continue;
      }
      const idx = rng.int(0, highTones.length - 1);
      const note = midiToName(highTones[idx]);
      const beat = rng.int(0, 3);
      const sixteen = rng.int(0, 3);
      const time = `${sectionStartBar + bar}:${beat}:${sixteen}`;
      const vel = 0.18 + rng.gaussian(0, 0.04);
      events.push({
        time,
        note,
        duration: "4n",
        velocity: Math.max(0.12, Math.min(0.35, vel)),
        instrument: "texture",
      });
    }
    return events;
  }

  private generateContrabass(
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const events: InstrumentNoteEvent[] = [];
    if (section.name === "intro" || section.name === "outro") {
      return events;
    }
    const len = progression.length;
    const chordBars = preset.chordDurationBars ?? 1;
    for (let bar = 0; bar < section.bars; bar++) {
      const template = progression[Math.floor(bar / chordBars) % len];
      const { root } = resolveChordFromTemplate(
        key,
        preset.scaleType,
        template
      );
      const cbNote = root - 12;
      if (cbNote < 28) {
        continue;
      }
      events.push({
        time: `${sectionStartBar + bar}:0:0`,
        note: midiToName(cbNote),
        duration: chordBars === 2 ? "2m" : "1n",
        velocity: 0.65,
        instrument: "contrabass",
      });
    }
    return events;
  }

  private generateSubbass(
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const events: InstrumentNoteEvent[] = [];
    if (section.name === "intro" || section.name === "outro") {
      return events;
    }
    const len = progression.length;
    const chordBars = preset.chordDurationBars ?? 1;
    for (let bar = 0; bar < section.bars; bar++) {
      const template = progression[Math.floor(bar / chordBars) % len];
      const { root } = resolveChordFromTemplate(
        key,
        preset.scaleType,
        template
      );
      const subNote = root - 24;
      if (subNote < 20) {
        continue;
      }
      events.push({
        time: `${sectionStartBar + bar}:0:0`,
        note: midiToName(subNote),
        duration: chordBars === 2 ? "2m" : "1n",
        velocity: 0.7,
        instrument: "subbass",
      });
    }
    return events;
  }

  private generateExtraInstrument(
    instrumentId: InstrumentId,
    key: string,
    progression: ChordProgressionTemplate,
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): InstrumentNoteEvent[] {
    const rng = this.rng.fork();
    const events: InstrumentNoteEvent[] = [];
    if (section.name === "intro" || section.name === "outro") {
      return events;
    }
    const len = progression.length;
    const chordBars = preset.chordDurationBars ?? 1;
    const chordVoicing = preset.chordVoicing ?? ["block"];

    for (let bar = 0; bar < section.bars; bar += chordBars) {
      const [degree, quality] = progression[(bar / chordBars) % len];
      let q = quality;
      if (
        preset.useSoftVoicings &&
        (quality === "maj7" || quality === "min7")
      ) {
        q = quality === "maj7" ? "maj" : "min";
      }
      const { root } = resolveChordFromTemplate(key, preset.scaleType, [
        degree,
        q,
      ]);
      const mode = rng.pick(chordVoicing);
      const chordNotes =
        mode === "spread"
          ? spreadChord(root, q)
          : buildChord(root, q).map(
              (n) => n + (instrumentId === "guitar" ? 0 : 12)
            );

      const isArpeggio =
        (instrumentId === "piano" || instrumentId === "guitar") &&
        rng.chance(0.5);
      for (let i = 0; i < chordNotes.length; i++) {
        const midi = chordNotes[i];
        if (midi < 36 || midi > 84) {
          continue;
        }
        const sixteenth = isArpeggio ? i * 2 : 0;
        const beat = Math.floor(sixteenth / 4);
        const rem = sixteenth % 4;
        const time = isArpeggio
          ? `${sectionStartBar + bar}:${beat}:${rem}`
          : `${sectionStartBar + bar}:0:0`;
        const baseVel =
          instrumentId === "guitar"
            ? 0.45
            : instrumentId === "violin"
              ? 0.38
              : 0.4;
        const vel =
          baseVel + (instrumentId === "guitar" ? rng.gaussian(0, 0.04) : 0);
        events.push({
          time,
          note: midiToName(midi),
          duration: instrumentId === "guitar" || isArpeggio ? "8n" : "1n",
          velocity: Math.max(
            0.2,
            Math.min(instrumentId === "violin" ? 0.52 : 0.6, vel)
          ),
          instrument: instrumentId,
        });
      }
    }
    return events;
  }

  private generateDrums(
    preset: LofiPreset,
    section: SongSection,
    sectionStartBar: number
  ): DrumEvent[] {
    const rng = this.rng.fork();
    const events: DrumEvent[] = [];
    const pattern = rng.pick(preset.drumPatterns);
    const fill = rng.pick(preset.drumFills);
    const useFill =
      section.name !== "intro" &&
      section.name !== "outro" &&
      section.bars > 0 &&
      rng.chance(0.8);

    const thinOut = section.name === "intro" || section.name === "outro";
    const thinProb = section.name === "intro" ? 0.6 : 0.7;

    for (let bar = 0; bar < section.bars; bar++) {
      const isLastBar = bar === section.bars - 1;
      const pat = isLastBar && useFill ? fill : pattern;

      for (let step = 0; step < 16; step++) {
        const time = `${sectionStartBar + bar}:${Math.floor(step / 4)}:${step % 4}`;

        if (pat.kick[step] > 0 && (!thinOut || rng.chance(1 - thinProb))) {
          const v = pat.kick[step] * (preset.kickVolume / -6);
          events.push({
            time,
            instrument: "kick",
            velocity: Math.max(0.2, Math.min(1, v)),
          });
        }
        if (pat.snare[step] > 0 && (!thinOut || rng.chance(1 - thinProb))) {
          const v = pat.snare[step] * (1 + preset.snareVolume / 20);
          events.push({
            time,
            instrument: "snare",
            velocity: Math.max(0.2, Math.min(1, v)),
          });
        }
        if (pat.hihat[step] > 0) {
          const v = pat.hihat[step] * (1 + preset.hihatVolume / 20);
          events.push({
            time,
            instrument: "hihat",
            velocity: Math.max(0.15, Math.min(1, v)),
          });
        }
      }
    }
    return events;
  }

  private generateFXParams(preset: LofiPreset): SongFXParams {
    return {
      reverbDecay: preset.reverbDecay * (0.95 + this.rng.next() * 0.1),
      reverbMix: preset.reverbMix * (0.9 + this.rng.next() * 0.2),
      delayMix: preset.delayMix * (0.85 + this.rng.next() * 0.3),
      filterCutoff: preset.filterCutoff * (0.9 + this.rng.next() * 0.2),
      crackleMix: preset.crackleMix * (0.8 + this.rng.next() * 0.4),
    };
  }

  private sectionPadVolume(section: SongSection): number {
    if (section.name === "intro") {
      return -12;
    }
    if (section.name === "outro") {
      return -9;
    }
    return 0;
  }
}

/** Convenience: build a song from seed (same as SongBuilder.fromSeed(seed).build()) */
export function buildSong(seed: number): Song {
  return SongBuilder.fromSeed(seed).build();
}
