/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";
import type {
  DrumEvent,
  GeneratedSong,
  InstrumentNoteEvent,
} from "./song-generator";
import { generateSong } from "./song-generator";

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

export interface LofiParams {
  crackleMix: number;
  delayMix: number;
  filterCutoff: number;
  instrumentVolumes: Partial<Record<InstrumentVolumeId, number>>;
  reverbMix: number;
  tempo: number;
  volume: number;
}

function compareTransportTime(a: string, b: string): number {
  const parse = (s: string) => {
    const parts = s.split(":").map((x) => Number.parseInt(x, 10) || 0);
    return (parts[0] ?? 0) * 16 + (parts[1] ?? 0) * 4 + (parts[2] ?? 0);
  };
  return parse(a) - parse(b);
}

export const DEFAULT_PARAMS: LofiParams = {
  tempo: 75,
  volume: 1,
  reverbMix: 0.4,
  filterCutoff: 1200,
  crackleMix: 0.08,
  delayMix: 0.15,
  instrumentVolumes: {},
};

export class LofiEngine {
  private readonly transport: ReturnType<typeof Tone.getTransport>;
  private readonly pad: InstanceType<typeof Tone.PolySynth>;
  private readonly melody: InstanceType<
    typeof Tone.Synth | typeof Tone.FMSynth | typeof Tone.AMSynth
  >;
  private readonly bass: InstanceType<typeof Tone.MonoSynth>;
  private readonly subbass: InstanceType<typeof Tone.MonoSynth>;
  private readonly texture: InstanceType<typeof Tone.Synth>;
  private readonly piano: InstanceType<typeof Tone.PolySynth>;
  private readonly violin: InstanceType<typeof Tone.PolySynth>;
  private readonly trumpet: InstanceType<typeof Tone.PolySynth>;
  private readonly guitar: InstanceType<typeof Tone.PluckSynth>;
  private readonly contrabass: InstanceType<typeof Tone.MonoSynth>;
  private readonly kick: InstanceType<typeof Tone.MembraneSynth>;
  private readonly snare: InstanceType<typeof Tone.NoiseSynth>;
  private readonly hihat: InstanceType<typeof Tone.NoiseSynth>;
  private readonly crackle: InstanceType<typeof Tone.NoiseSynth>;
  private readonly crackleBg: InstanceType<typeof Tone.Noise>;
  private readonly crackleLowpass: InstanceType<typeof Tone.Filter>;
  private readonly filter: InstanceType<typeof Tone.Filter>;
  private readonly reverb: InstanceType<typeof Tone.Reverb>;
  private readonly drumReverb: InstanceType<typeof Tone.Reverb>;
  private readonly delay: InstanceType<typeof Tone.FeedbackDelay>;
  private readonly compressor: InstanceType<typeof Tone.Compressor>;
  private readonly crackleGain: InstanceType<typeof Tone.Gain>;
  private readonly drumComp: InstanceType<typeof Tone.Compressor>;
  private readonly snareFilter: InstanceType<typeof Tone.Filter>;
  private readonly hihatFilter: InstanceType<typeof Tone.Filter>;

  private currentSong: GeneratedSong | null = null;
  private scheduledIds: number[] = [];
  private currentSectionName = "";
  private params: LofiParams = { ...DEFAULT_PARAMS };
  private bassBaseVolume = -5;
  private readonly masterGain: InstanceType<typeof Tone.Gain>;

  constructor() {
    this.transport = Tone.getTransport();
    this.masterGain = new Tone.Gain(1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -32,
      ratio: 10,
      attack: 0.1,
      release: 0.5,
    }).connect(this.masterGain);

    this.delay = new Tone.FeedbackDelay({
      delayTime: "4n",
      feedback: 0.35,
      wet: 0.15,
    }).connect(this.compressor);

    this.reverb = new Tone.Reverb({
      decay: 4,
      preDelay: 0.02,
      wet: 0.4,
    }).connect(this.delay);

    this.drumReverb = new Tone.Reverb({
      decay: 3,
      preDelay: 0.01,
      wet: 0.35,
    }).connect(this.compressor);

    this.filter = new Tone.Filter({
      frequency: 1200,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.reverb);

    this.pad = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 1.8,
      oscillator: { type: "sine" },
      envelope: { attack: 0.45, decay: 0.25, sustain: 0.55, release: 1.6 },
      volume: -14,
    }).connect(this.filter);

    this.melody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.3 },
    }).connect(this.filter);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
    }).connect(this.filter);

    this.texture = new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.2, release: 0.8 },
      volume: -14,
    }).connect(this.filter);

    this.subbass = new Tone.MonoSynth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 },
      volume: -6,
    }).connect(this.filter);

    this.piano = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3,
      modulationIndex: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
      volume: -5,
    }).connect(this.filter);

    this.violin = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.35, decay: 0.25, sustain: 0.5, release: 1.2 },
      volume: -14,
    }).connect(this.filter);

    this.trumpet = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2,
      modulationIndex: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.4 },
      volume: -6,
    }).connect(this.filter);

    this.guitar = new Tone.PluckSynth({
      attackNoise: 0.5,
      dampening: 3000,
      resonance: 0.7,
      volume: -5,
    }).connect(this.filter);

    this.contrabass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.6 },
      volume: -7,
    }).connect(this.filter);

    this.drumComp = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
    }).connect(this.drumReverb);

    this.kick = new Tone.MembraneSynth({
      envelope: { attack: 0.01, decay: 0.3, sustain: 0 },
      octaves: 4,
      pitchDecay: 0.05,
    }).connect(this.drumComp);

    this.snareFilter = new Tone.Filter({
      frequency: 1200,
      type: "bandpass",
      Q: 2,
      rolloff: -12,
    }).connect(this.drumComp);

    this.hihatFilter = new Tone.Filter({
      frequency: 3200,
      type: "bandpass",
      Q: 1.2,
      rolloff: -12,
    }).connect(this.drumComp);

    this.snare = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.002, decay: 0.22, sustain: 0 },
      volume: 0,
    }).connect(this.snareFilter);

    this.hihat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -5,
    }).connect(this.hihatFilter);

    const crackleFilter = new Tone.Filter({
      frequency: 3200,
      type: "bandpass",
      Q: 0.6,
    });
    this.crackleLowpass = new Tone.Filter({
      frequency: 2200,
      type: "lowpass",
      rolloff: -12,
    }).connect(crackleFilter);
    this.crackleGain = new Tone.Gain(0.08).connect(this.compressor);
    crackleFilter.connect(this.crackleGain);
    this.crackleBg = new Tone.Noise({ type: "white", volume: -28 }).connect(
      this.crackleLowpass
    );
    this.crackle = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -12,
    }).connect(crackleFilter);
  }

  async init(): Promise<void> {
    await Promise.all([this.reverb.ready, this.drumReverb.ready]);
  }

  async start(seed?: number): Promise<void> {
    await Tone.start();
    if (this.currentSong && seed === undefined) {
      this.masterGain.gain.cancelScheduledValues(0);
      this.masterGain.gain.value = this.params.volume;
      this.crackleBg.start();
      this.transport.start();
      return;
    }
    const song = generateSong(seed ?? Date.now());
    this.playSong(song);
  }

  randomize(): void {
    this.clearScheduled();
    this.currentSong = null;
    this.currentSectionName = "";
    this.transport.stop();
    this.crackleBg.stop();
    this.pad.releaseAll();
    this.melody.triggerRelease();
    this.bass.triggerRelease();
    this.subbass.triggerRelease();
    this.contrabass.triggerRelease();
    this.texture.triggerRelease();
    this.piano.releaseAll();
    this.violin.releaseAll();
    this.trumpet.releaseAll();
    this.start(Date.now());
  }

  stop(): void {
    this.transport.stop();
    this.crackleBg.stop();
    this.masterGain.gain.cancelScheduledValues(0);
    this.masterGain.gain.value = 0;
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

  setParams(p: Partial<LofiParams>): void {
    this.params = { ...this.params, ...p };
    this.applyParamOverrides();
  }

  private readonly baseVolumes: Record<InstrumentVolumeId, number> = {
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

  private applyInstrumentVolumes(): void {
    const vols = this.params.instrumentVolumes ?? {};
    const dbFromSlider = (v: number) => (v / 100 - 1) * 24;
    const set = (
      id: InstrumentVolumeId,
      synth: { volume: { value: number } }
    ) => {
      const base = id === "bass" ? this.bassBaseVolume : this.baseVolumes[id];
      const slider = vols[id] ?? 100;
      synth.volume.value = base + dbFromSlider(slider);
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

  private applyParamOverrides(): void {
    this.transport.bpm.value = this.params.tempo;
    this.filter.frequency.value = this.params.filterCutoff;
    this.reverb.wet.value = this.params.reverbMix;
    this.drumReverb.wet.value = this.params.reverbMix * 0.9;
    this.delay.wet.value = this.params.delayMix;
    this.crackleGain.gain.value = this.params.crackleMix;
    this.applyInstrumentVolumes();
    if (this.masterGain.gain.value > 0) {
      this.masterGain.gain.value = this.params.volume;
    }
  }

  connectAnalyser(analyser: AnalyserNode): void {
    this.masterGain.connect(analyser);
  }

  getCurrentInfo(): {
    preset: string;
    section: string;
    key: string;
  } {
    if (!this.currentSong) {
      return { preset: "", section: "", key: "" };
    }
    return {
      preset: this.currentSong.preset.name,
      section: this.currentSectionName,
      key: this.currentSong.key,
    };
  }

  dispose(): void {
    this.stop();
    this.clearScheduled();
    this.currentSong = null;
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
    this.crackle.dispose();
    this.crackleBg.dispose();
    this.crackleLowpass.dispose();
    this.filter.dispose();
    this.reverb.dispose();
    this.drumReverb.dispose();
    this.delay.dispose();
    this.compressor.dispose();
    this.crackleGain.dispose();
    this.drumComp.dispose();
    this.snareFilter.dispose();
    this.hihatFilter.dispose();
    this.masterGain.dispose();
  }

  private clearScheduled(): void {
    for (const id of this.scheduledIds) {
      this.transport.clear(id);
    }
    this.scheduledIds = [];
  }

  private configureSynths(song: GeneratedSong): void {
    const { preset } = song;
    this.pad.set(preset.pad.options as object);
    this.melody.set(preset.melody.options as object);
    this.bass.set(preset.bass.options as object);
    this.bassBaseVolume = preset.bass.volume - 3;
    this.applyInstrumentVolumes();
  }

  private configureFX(fx: GeneratedSong["fxParams"]): void {
    this.reverb.decay = fx.reverbDecay;
    this.reverb.wet.value = fx.reverbMix;
    this.drumReverb.decay = fx.reverbDecay * 0.85;
    this.drumReverb.wet.value = fx.reverbMix * 0.9;
    this.delay.wet.value = fx.delayMix;
    this.filter.frequency.value = fx.filterCutoff;
    /* crackleGain set only by user's crackle slider via applyParamOverrides */
  }

  private playSong(song: GeneratedSong): void {
    this.currentSong = song;
    this.clearScheduled();
    this.configureSynths(song);
    this.configureFX(song.fxParams);
    this.transport.swing = song.swing;
    this.applyParamOverrides();
    this.masterGain.gain.cancelScheduledValues(0);
    this.masterGain.gain.value = this.params.volume;

    const synths: Record<
      string,
      | typeof this.pad
      | typeof this.melody
      | typeof this.bass
      | typeof this.texture
      | typeof this.subbass
      | typeof this.piano
      | typeof this.violin
      | typeof this.trumpet
      | typeof this.guitar
      | typeof this.contrabass
    > = {
      pad: this.pad,
      melody: this.melody,
      bass: this.bass,
      texture: this.texture,
      subbass: this.subbass,
      contrabass: this.contrabass,
      piano: this.piano,
      violin: this.violin,
      trumpet: this.trumpet,
      guitar: this.guitar,
    };

    /** Batch all events by time so we schedule once per time (Tone requires strictly increasing times) */
    const eventsByTime = new Map<
      string,
      { instrument: InstrumentNoteEvent[]; drum: DrumEvent[] }
    >();
    for (const section of song.sections) {
      for (const e of section.instrumentEvents) {
        const entry = eventsByTime.get(e.time) ?? {
          instrument: [],
          drum: [],
        };
        entry.instrument.push(e);
        eventsByTime.set(e.time, entry);
      }
      for (const e of section.drumEvents) {
        const entry = eventsByTime.get(e.time) ?? {
          instrument: [],
          drum: [],
        };
        entry.drum.push(e);
        eventsByTime.set(e.time, entry);
      }
    }
    const sortedTimes = [...eventsByTime.keys()].sort(compareTransportTime);
    for (const time of sortedTimes) {
      const { instrument, drum } = eventsByTime.get(time) ?? {
        instrument: [],
        drum: [],
      };
      const id = this.transport.schedule((t) => {
        const padEvents = instrument.filter((e) => e.instrument === "pad");
        if (padEvents.length > 0) {
          const dur = padEvents[0].duration;
          for (const e of padEvents) {
            this.pad.triggerAttackRelease(e.note, dur, t, e.velocity);
          }
        }
        for (const e of instrument) {
          if (e.instrument === "pad") {
            continue;
          }
          const synth = synths[e.instrument];
          if (synth) {
            synth.triggerAttackRelease(e.note, e.duration, t, e.velocity);
          }
        }
        for (const d of drum) {
          const drumSynth =
            d.instrument === "kick"
              ? this.kick
              : // biome-ignore lint/style/noNestedTernary: TODO: fix this
                d.instrument === "snare"
                ? this.snare
                : this.hihat;
          if (d.instrument === "kick") {
            drumSynth.triggerAttackRelease("C2", "8n", t, d.velocity);
          } else {
            drumSynth.triggerAttackRelease("32n", t, d.velocity);
          }
        }
      }, time);
      this.scheduledIds.push(id);
    }

    const barUpdateId = this.transport.scheduleRepeat(
      (time) => {
        const bpm = this.transport.bpm.value;
        const beats = time * (bpm / 60);
        const bar = Math.floor(beats / 4);
        let acc = 0;
        for (const s of song.sections) {
          if (bar >= acc && bar < acc + s.bars) {
            this.currentSectionName = s.name;
            break;
          }
          acc += s.bars;
        }
      },
      "1m",
      "0:0:0"
    );
    this.scheduledIds.push(barUpdateId);

    const crackleId = this.transport.scheduleRepeat(
      (time) => {
        const r = Math.random();
        if (r < 0.65) {
          const isTick = r < 0.4;
          const dur = isTick
            ? 0.008 + Math.random() * 0.012
            : 0.02 + Math.random() * 0.05;
          const vel = isTick
            ? 0.2 + Math.random() * 0.35
            : 0.45 + Math.random() * 0.5;
          this.crackle.triggerAttackRelease(dur, time, vel);
        }
      },
      "32n",
      "0:0:0"
    );
    this.scheduledIds.push(crackleId);

    const nextSongId = this.transport.schedule(() => {
      this.transport.stop();
      this.clearScheduled();
      this.crackleBg.stop();
      this.pad.releaseAll();
      this.melody.triggerRelease();
      this.bass.triggerRelease();
      this.subbass.triggerRelease();
      this.contrabass.triggerRelease();
      this.texture.triggerRelease();
      this.piano.releaseAll();
      this.violin.releaseAll();
      this.trumpet.releaseAll();
      this.currentSong = null;
      this.currentSectionName = "";

      const nextSong = generateSong(Date.now());
      this.transport.position = "0:0:0";
      this.playSong(nextSong);
    }, `${song.totalBars}:0:0`);
    this.scheduledIds.push(nextSongId);

    this.crackleBg.start();
    this.transport.start();
  }
}
