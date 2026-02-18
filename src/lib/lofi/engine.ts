/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";
import { Instruments, type InstrumentVolumeId } from "./instruments";
import { Mixer } from "./mixer";
import type {
  DrumEvent,
  GeneratedSong,
  InstrumentNoteEvent,
} from "./song-generator";
import { generateSong } from "./song-generator";

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
  private readonly mixer: Mixer;
  private readonly instruments: Instruments;

  private currentSong: GeneratedSong | null = null;
  private scheduledIds: number[] = [];
  private currentSectionName = "";
  private params: LofiParams = { ...DEFAULT_PARAMS };

  constructor() {
    this.transport = Tone.getTransport();
    this.mixer = new Mixer();
    this.instruments = new Instruments(this.mixer.destinations);
  }

  async init(): Promise<void> {
    await this.mixer.ready;
  }

  async start(seed?: number): Promise<void> {
    await Tone.start();
    if (this.currentSong && seed === undefined) {
      this.mixer.cancelVolumeScheduled();
      this.mixer.setVolume(this.params.volume);
      this.mixer.crackleBg.start();
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
    this.mixer.crackleBg.stop();
    this.instruments.releaseAll();
    this.start(Date.now());
  }

  stop(): void {
    this.transport.stop();
    this.mixer.crackleBg.stop();
    this.mixer.cancelVolumeScheduled();
    this.mixer.setVolume(0);
    this.instruments.releaseAll();
  }

  setParams(p: Partial<LofiParams>): void {
    this.params = { ...this.params, ...p };
    this.applyParamOverrides();
  }

  private applyParamOverrides(): void {
    this.transport.bpm.value = this.params.tempo;
    this.mixer.applyParams({
      filterCutoff: this.params.filterCutoff,
      reverbMix: this.params.reverbMix,
      delayMix: this.params.delayMix,
      crackleMix: this.params.crackleMix,
      volume: this.params.volume,
    });
    this.instruments.applyVolumes(this.params.instrumentVolumes ?? {});
  }

  connectAnalyser(analyser: AnalyserNode): void {
    this.mixer.connectAnalyser(analyser);
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
    this.mixer.dispose();
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
    this.mixer.configureFX({
      reverbDecay: fx.reverbDecay,
      reverbMix: fx.reverbMix,
      delayMix: fx.delayMix,
      filterCutoff: fx.filterCutoff,
    });
  }

  private playSong(song: GeneratedSong): void {
    this.currentSong = song;
    this.clearScheduled();
    this.configureSynths(song);
    this.configureFX(song.fxParams);
    this.transport.swing = song.swing;
    this.applyParamOverrides();
    this.mixer.cancelVolumeScheduled();
    this.mixer.setVolume(this.params.volume);

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
            this.instruments.pad.triggerAttackRelease(
              e.note,
              dur,
              t,
              e.velocity
            );
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
          this.mixer.crackle.triggerAttackRelease(dur, time, vel);
        }
      },
      "32n",
      "0:0:0"
    );
    this.scheduledIds.push(crackleId);

    const nextSongId = this.transport.schedule(() => {
      this.transport.stop();
      this.clearScheduled();
      this.mixer.crackleBg.stop();
      this.instruments.releaseAll();
      this.currentSong = null;
      this.currentSectionName = "";

      const nextSong = generateSong(Date.now());
      this.transport.position = "0:0:0";
      this.playSong(nextSong);
    }, `${song.totalBars}:0:0`);
    this.scheduledIds.push(nextSongId);

    this.mixer.crackleBg.start();
    this.transport.start();
  }
}
