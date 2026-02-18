/**
 * SongScheduler schedules a Song's events to the transport, triggering Instruments.
 */
import type * as Tone from "tone";
import type { Instruments } from "./instruments";
import type { DrumEvent, InstrumentNoteEvent, Song } from "./song";

function compareTransportTime(a: string, b: string): number {
  const parse = (s: string) => {
    const parts = s.split(":").map((x) => Number.parseInt(x, 10) || 0);
    return (parts[0] ?? 0) * 16 + (parts[1] ?? 0) * 4 + (parts[2] ?? 0);
  };
  return parse(a) - parse(b);
}

export interface SongSchedulerOptions {
  crackle: InstanceType<typeof Tone.NoiseSynth>;
  onBar?: (sectionName: string) => void;
  onSongEnd?: () => void;
}

export class SongScheduler {
  private readonly transport: ReturnType<typeof Tone.getTransport>;
  private readonly instruments: Instruments;

  constructor(
    transport: ReturnType<typeof Tone.getTransport>,
    instruments: Instruments
  ) {
    this.transport = transport;
    this.instruments = instruments;
  }

  /**
   * Schedules all song events. Returns IDs for cleanup.
   */
  schedule(song: Song, options: SongSchedulerOptions): number[] {
    const ids: number[] = [];
    const { crackle, onBar, onSongEnd } = options;
    const synths = this.instruments.getMelodicSynths();
    const drumSynths = {
      kick: this.instruments.kick,
      snare: this.instruments.snare,
      hihat: this.instruments.hihat,
    };

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
        for (const d of drum) {
          const drumSynth = drumSynths[d.instrument];
          if (d.instrument === "kick") {
            drumSynth.triggerAttackRelease("C2", "8n", t, d.velocity);
          } else {
            drumSynth.triggerAttackRelease("32n", t, d.velocity);
          }
        }
      }, time);
      ids.push(id);
    }

    if (onBar) {
      const barUpdateId = this.transport.scheduleRepeat(
        (time) => {
          const bpm = this.transport.bpm.value;
          const beats = time * (bpm / 60);
          const bar = Math.floor(beats / 4);
          let acc = 0;
          for (const s of song.sections) {
            if (bar >= acc && bar < acc + s.bars) {
              onBar(s.name);
              break;
            }
            acc += s.bars;
          }
        },
        "1m",
        "0:0:0"
      );
      ids.push(barUpdateId);
    }

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
          crackle.triggerAttackRelease(dur, time, vel);
        }
      },
      "32n",
      "0:0:0"
    );
    ids.push(crackleId);

    if (onSongEnd) {
      const nextSongId = this.transport.schedule(
        onSongEnd,
        `${song.totalBars}:0:0`
      );
      ids.push(nextSongId);
    }

    return ids;
  }
}
