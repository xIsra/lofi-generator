/**
 * Lofi mixer. Owns and manages the effects chain (reverb, delay, filter, compressor, etc.)
 * and crackle ambience.
 */
/* biome-ignore lint/performance/noNamespaceImport: Tone.js API designed for namespace import */
import * as Tone from "tone";

export interface MixerParams {
  crackleMix: number;
  delayMix: number;
  filterCutoff: number;
  reverbMix: number;
  volume: number;
}

export interface MixerFXParams {
  filterCutoff: number;
  reverbDecay: number;
  reverbMix: number;
  delayMix: number;
}

export interface MixerDestinations {
  drumComp: Tone.Compressor;
  filter: Tone.Filter;
  hihatFilter: Tone.Filter;
  snareFilter: Tone.Filter;
}

export class Mixer {
  readonly masterGain: InstanceType<typeof Tone.Gain>;
  readonly compressor: InstanceType<typeof Tone.Compressor>;
  readonly delay: InstanceType<typeof Tone.FeedbackDelay>;
  readonly reverb: InstanceType<typeof Tone.Reverb>;
  readonly filter: InstanceType<typeof Tone.Filter>;
  readonly drumReverb: InstanceType<typeof Tone.Reverb>;
  readonly drumFilter: InstanceType<typeof Tone.Filter>;
  readonly drumComp: InstanceType<typeof Tone.Compressor>;
  readonly snareFilter: InstanceType<typeof Tone.Filter>;
  readonly hihatFilter: InstanceType<typeof Tone.Filter>;
  readonly crackle: InstanceType<typeof Tone.NoiseSynth>;
  readonly crackleBg: InstanceType<typeof Tone.Noise>;

  private readonly crackleGain: InstanceType<typeof Tone.Gain>;

  constructor() {
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

    const crackleFilter = new Tone.Filter({
      frequency: 3200,
      type: "bandpass",
      Q: 0.6,
    });
    const crackleLowpass = new Tone.Filter({
      frequency: 2200,
      type: "lowpass",
      rolloff: -12,
    }).connect(crackleFilter);
    this.crackleGain = new Tone.Gain(0.08).connect(this.compressor);
    crackleFilter.connect(this.crackleGain);
    this.crackleBg = new Tone.Noise({ type: "white", volume: -28 }).connect(
      crackleLowpass
    );
    this.crackle = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
      volume: -12,
    }).connect(crackleFilter);
  }

  /** Destinations for Instruments to connect to */
  get destinations(): MixerDestinations {
    return {
      filter: this.filter,
      drumComp: this.drumComp,
      snareFilter: this.snareFilter,
      hihatFilter: this.hihatFilter,
    };
  }

  get ready(): Promise<void> {
    return Promise.all([this.reverb.ready, this.drumReverb.ready]).then(
      () => undefined
    );
  }

  applyParams(p: MixerParams): void {
    this.filter.frequency.value = p.filterCutoff;
    this.drumFilter.frequency.value = p.filterCutoff;
    this.reverb.wet.value = p.reverbMix;
    this.drumReverb.wet.value = p.reverbMix * 0.9;
    this.delay.wet.value = p.delayMix;
    this.crackleGain.gain.value = p.crackleMix;
    if (this.masterGain.gain.value > 0) {
      this.masterGain.gain.value = p.volume;
    }
  }

  configureFX(fx: MixerFXParams): void {
    this.reverb.decay = fx.reverbDecay;
    this.reverb.wet.value = fx.reverbMix;
    this.drumReverb.decay = fx.reverbDecay * 0.85;
    this.drumReverb.wet.value = fx.reverbMix * 0.9;
    this.delay.wet.value = fx.delayMix;
    this.filter.frequency.value = fx.filterCutoff;
    this.drumFilter.frequency.value = fx.filterCutoff;
  }

  setVolume(value: number): void {
    this.masterGain.gain.value = value;
  }

  cancelVolumeScheduled(): void {
    this.masterGain.gain.cancelScheduledValues(0);
  }

  connectAnalyser(analyser: AnalyserNode): void {
    this.masterGain.connect(analyser);
  }

  dispose(): void {
    this.crackle.dispose();
    this.crackleBg.dispose();
    this.crackleGain.dispose();
    this.filter.dispose();
    this.reverb.dispose();
    this.drumReverb.dispose();
    this.delay.dispose();
    this.compressor.dispose();
    this.drumComp.dispose();
    this.drumFilter.dispose();
    this.snareFilter.dispose();
    this.hihatFilter.dispose();
    this.masterGain.dispose();
  }
}
