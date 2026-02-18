/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";
import {
  Instruments,
  type InstrumentVolumeId,
} from "./instruments";
import type {
  DrumEvent,
  GeneratedSong,
  InstrumentNoteEvent,
} from "./song-generator";
import { generateSong } from "./song-generator";

export { INSTRUMENT_IDS, type InstrumentVolumeId } from "./instruments";

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
  private readonly instruments: Instruments;
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
  private readonly drumFilter: InstanceType<typeof Tone.Filter>;
  private readonly snareFilter: InstanceType<typeof Tone.Filter>;
  private readonly hihatFilter: InstanceType<typeof Tone.Filter>;

  private currentSong: GeneratedSong | null = null;
  private scheduledIds: number[] = [];
  private currentSectionName = "";
  private params: LofiParams = { ...DEFAULT_PARAMS };
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

    this.drumFilter = new Tone.Filter({
      frequency: 1200,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.drumReverb);

    this.drumComp = new Tone.Compressor({
      threshold: -20,
      ratio: 3,
    }).connect(this.drumFilter);

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

    this.instruments = new Instruments({
      filter: this.filter,
      drumComp: this.drumComp,
      snareFilter: this.snareFilter,
      hihatFilter: this.hihatFilter,
    });

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
    this.instruments.releaseAll();
    this.start(Date.now());
  }

  stop(): void {
    this.transport.stop();
    this.crackleBg.stop();
    this.masterGain.gain.cancelScheduledValues(0);
    this.masterGain.gain.value = 0;
    this.instruments.releaseAll();
  }

  setParams(p: Partial<LofiParams>): void {
    this.params = { ...this.params, ...p };
    this.applyParamOverrides();
  }

  private applyParamOverrides(): void {
    this.transport.bpm.value = this.params.tempo;
    this.filter.frequency.value = this.params.filterCutoff;
    this.drumFilter.frequency.value = this.params.filterCutoff;
    this.reverb.wet.value = this.params.reverbMix;
    this.drumReverb.wet.value = this.params.reverbMix * 0.9;
    this.delay.wet.value = this.params.delayMix;
    this.crackleGain.gain.value = this.params.crackleMix;
    this.instruments.applyVolumes(this.params.instrumentVolumes ?? {});
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
    this.instruments.dispose();
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
    this.instruments.configurePreset(song.preset);
    this.instruments.applyVolumes(this.params.instrumentVolumes ?? {});
  }

  private configureFX(fx: GeneratedSong["fxParams"]): void {
    this.reverb.decay = fx.reverbDecay;
    this.reverb.wet.value = fx.reverbMix;
    this.drumReverb.decay = fx.reverbDecay * 0.85;
    this.drumReverb.wet.value = fx.reverbMix * 0.9;
    this.delay.wet.value = fx.delayMix;
    this.filter.frequency.value = fx.filterCutoff;
    this.drumFilter.frequency.value = fx.filterCutoff;
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

    const synths = this.instruments.getMelodicSynths();

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
            this.instruments.pad.triggerAttackRelease(e.note, dur, t, e.velocity);
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
        const drumSynths = {
          kick: this.instruments.kick,
          snare: this.instruments.snare,
          hihat: this.instruments.hihat,
        };
        for (const d of drum) {
          const drumSynth = drumSynths[d.instrument];
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
      this.instruments.releaseAll();
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
