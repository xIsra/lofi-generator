/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";
import { Instruments, type InstrumentVolumeId } from "./instruments";
import { Mixer } from "./mixer";
import { buildSong, type Song } from "./song";
import { SongScheduler } from "./song-scheduler";

export interface LofiParams {
  crackleMix: number;
  delayMix: number;
  filterCutoff: number;
  instrumentVolumes: Partial<Record<InstrumentVolumeId, number>>;
  reverbMix: number;
  tempo: number;
  volume: number;
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
  private readonly scheduler: SongScheduler;

  private currentSong: Song | null = null;
  private scheduledIds: number[] = [];
  private currentSectionName = "";
  private params: LofiParams = { ...DEFAULT_PARAMS };

  constructor() {
    this.transport = Tone.getTransport();
    this.mixer = new Mixer();
    this.instruments = new Instruments(this.mixer.destinations);
    this.scheduler = new SongScheduler(this.transport, this.instruments);
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
    const song = buildSong(seed ?? Date.now());
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

  private configureSynths(song: Song): void {
    this.instruments.configurePreset(song.preset);
    this.instruments.applyVolumes(this.params.instrumentVolumes ?? {});
  }

  private configureFX(fx: Song["fxParams"]): void {
    this.mixer.configureFX({
      reverbDecay: fx.reverbDecay,
      reverbMix: fx.reverbMix,
      delayMix: fx.delayMix,
      filterCutoff: fx.filterCutoff,
    });
  }

  private playSong(song: Song): void {
    this.currentSong = song;
    this.clearScheduled();
    this.configureSynths(song);
    this.configureFX(song.fxParams);
    this.transport.swing = song.swing;
    this.applyParamOverrides();
    this.mixer.cancelVolumeScheduled();
    this.mixer.setVolume(this.params.volume);

    const ids = this.scheduler.schedule(song, {
      crackle: this.mixer.crackle,
      onBar: (name) => {
        this.currentSectionName = name;
      },
      onSongEnd: () => {
        this.transport.stop();
        this.clearScheduled();
        this.mixer.crackleBg.stop();
        this.instruments.releaseAll();
        this.currentSong = null;
        this.currentSectionName = "";
        const nextSong = buildSong(Date.now());
        this.transport.position = "0:0:0";
        this.playSong(nextSong);
      },
    });
    this.scheduledIds.push(...ids);

    this.mixer.crackleBg.start();
    this.transport.start();
  }
}
