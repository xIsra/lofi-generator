/** 16 steps per bar (16ths), velocity 0-1 */
export interface DrumPattern {
  hihat: number[];
  kick: number[];
  snare: number[];
}

/** [degree, quality] - degree is 1-based scale degree */
export type ChordProgressionTemplate = [number, string][];

export interface LofiPreset {
  bass: { options: Record<string, unknown>; volume: number };
  /** Bars per chord (1 = 1 chord/bar, 2 = 1 chord/2 bars) */
  chordDurationBars?: number;
  /** Chord voicing: "block" | "broken" | "arpeggio" | "spread" - can be array for variety */
  chordVoicing?: ("block" | "broken" | "arpeggio" | "spread")[];
  crackleMix: number;
  delayFeedback: number;
  delayMix: number;
  delayTime: string;
  drumFills: DrumPattern[];

  drumPatterns: DrumPattern[];
  /** Extra instruments with spawn probability per section */
  extraInstruments?: { id: string; probability: number }[];
  filterCutoff: number;
  hihatVolume: number;

  keys: string[];
  kickVolume: number;
  melody: {
    synthType: "Synth" | "FMSynth" | "AMSynth";
    options: Record<string, unknown>;
    volume: number;
  };
  melodyRestProbability: number;
  motifLength: [number, number];
  name: string;

  pad: {
    synthType: "FMSynth" | "AMSynth" | "Synth";
    options: Record<string, unknown>;
    volume: number;
  };
  progressions: ChordProgressionTemplate[];

  reverbDecay: number;
  reverbMix: number;
  scaleType: string;
  snareVolume: number;
  /** Occasional sus chord substitute (0-1, prob to swap 3rd for sus) */
  susChordProbability?: number;
  swing: number;
  tempoRange: [number, number];
  /** Use triads (maj/min) instead of 7ths for softer sound */
  useSoftVoicings?: boolean;
}

function pattern(
  kick: number[],
  snare: number[],
  hihat: number[]
): DrumPattern {
  return { kick, snare, hihat };
}

const JAZZHOP_PATTERNS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [
      0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3,
      0.2,
    ]
  ),
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0],
    [0, 0, 0.5, 0, 1, 0, 0, 0, 0, 0, 0.5, 0, 1, 0, 0, 0],
    [
      0.25, 0.15, 0.25, 0.15, 0.25, 0.15, 0.25, 0.15, 0.25, 0.15, 0.25, 0.15,
      0.25, 0.15, 0.25, 0.15,
    ]
  ),
];

const JAZZHOP_FILLS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 1, 0, 0, 0],
    [
      0.4, 0.3, 0.4, 0.3, 0.4, 0.3, 0.5, 0.4, 0.5, 0.4, 0.5, 0.4, 0.5, 0.4, 0.5,
      0.4,
    ]
  ),
];

const CHILLHOP_PATTERNS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [
      0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35, 0.2, 0.35,
      0.2, 0.35, 0.2,
    ]
  ),
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0],
    [0, 0, 0.4, 0, 1, 0, 0, 0, 0, 0, 0.4, 0, 1, 0, 0, 0],
    [
      0.3, 0.25, 0.3, 0.25, 0.3, 0.25, 0.3, 0.25, 0.3, 0.25, 0.3, 0.25, 0.3,
      0.25, 0.3, 0.25,
    ]
  ),
];

const CHILLHOP_FILLS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 0, 0, 0],
    [
      0.3, 0.3, 0.35, 0.35, 0.4, 0.4, 0.45, 0.45, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5,
      0.5, 0.5,
    ]
  ),
];

const AMBIENT_PATTERNS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0.4, 0, 0, 0, 0, 0, 0, 0, 0.4, 0, 0, 0],
    [
      0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2,
      0.15, 0.2, 0.15,
    ]
  ),
  pattern(
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0],
    [
      0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15,
      0.1, 0.15, 0.1,
    ]
  ),
];

const AMBIENT_FILLS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.3, 0.5, 0, 0, 0],
    [
      0.2, 0.2, 0.25, 0.25, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3,
      0.3, 0.3,
    ]
  ),
];

const BOOMBAP_PATTERNS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    [
      0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5, 0.2, 0.5,
      0.2,
    ]
  ),
  pattern(
    [1, 0, 0, 0.3, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.4, 0],
    [0, 0, 0.6, 0, 1, 0, 0.6, 0, 0, 0, 0.6, 0, 1, 0, 0, 0],
    [
      0.55, 0.2, 0.55, 0.25, 0.55, 0.2, 0.55, 0.25, 0.55, 0.2, 0.55, 0.25, 0.55,
      0.2, 0.55, 0.25,
    ]
  ),
];

const BOOMBAP_FILLS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 0.6, 0.6, 1, 0, 0, 0],
    [
      0.6, 0.5, 0.6, 0.5, 0.65, 0.55, 0.65, 0.55, 0.7, 0.6, 0.7, 0.6, 0.7, 0.6,
      0.7, 0.6,
    ]
  ),
];

const SLEEPY_PATTERNS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0, 0.3, 0, 0, 0],
    [
      0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15, 0.1, 0.15,
      0.1, 0.15, 0.1,
    ]
  ),
  pattern(
    [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0, 0, 0],
    [
      0.12, 0.08, 0.12, 0.08, 0.12, 0.08, 0.12, 0.08, 0.12, 0.08, 0.12, 0.08,
      0.12, 0.08, 0.12, 0.08,
    ]
  ),
];

const SLEEPY_FILLS: DrumPattern[] = [
  pattern(
    [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0.2, 0.35, 0, 0, 0],
    [
      0.15, 0.15, 0.15, 0.15, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18,
      0.18, 0.18, 0.18, 0.18,
    ]
  ),
];

export const PRESETS: LofiPreset[] = [
  {
    name: "Jazzhop",
    tempoRange: [70, 80],
    swing: 0.3,
    pad: {
      synthType: "AMSynth",
      options: {
        harmonicity: 2,
        modulationIndex: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.3, decay: 0.2, sustain: 0.6, release: 1.5 },
      },
      volume: -4,
    },
    melody: {
      synthType: "FMSynth",
      options: {
        harmonicity: 3,
        modulationIndex: 1,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.4 },
      },
      volume: -3,
    },
    bass: {
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
      },
      volume: -2,
    },
    drumPatterns: JAZZHOP_PATTERNS,
    drumFills: JAZZHOP_FILLS,
    kickVolume: -2,
    snareVolume: -5,
    hihatVolume: -12,
    reverbDecay: 3.5,
    reverbMix: 0.35,
    delayTime: "8n",
    delayFeedback: 0.3,
    delayMix: 0.2,
    filterCutoff: 1400,
    crackleMix: 0.06,
    keys: ["C", "F", "G", "Am", "Bb", "Eb"],
    progressions: [
      [
        [1, "min7"],
        [4, "min7"],
        [1, "min7"],
        [5, "min7"],
      ],
      [
        [1, "min7"],
        [4, "min7"],
        [1, "min7"],
        [4, "min7"],
      ],
      [
        [4, "min7"],
        [1, "min7"],
        [5, "min7"],
        [1, "min7"],
      ],
    ],
    scaleType: "dorian",
    melodyRestProbability: 0.25,
    motifLength: [4, 6],
    useSoftVoicings: true,
    chordVoicing: ["block", "broken", "arpeggio"],
    susChordProbability: 0.15,
    extraInstruments: [
      { id: "piano", probability: 0.5 },
      { id: "trumpet", probability: 0.3 },
    ],
  },
  {
    name: "Chillhop",
    tempoRange: [80, 90],
    swing: 0.15,
    pad: {
      synthType: "Synth",
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.5 },
      },
      volume: -6,
    },
    melody: {
      synthType: "AMSynth",
      options: {
        harmonicity: 2,
        modulationIndex: 1.5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.35 },
      },
      volume: -4,
    },
    bass: {
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.5 },
      },
      volume: -2,
    },
    drumPatterns: CHILLHOP_PATTERNS,
    drumFills: CHILLHOP_FILLS,
    kickVolume: -2,
    snareVolume: -6,
    hihatVolume: -11,
    reverbDecay: 3,
    reverbMix: 0.4,
    delayTime: "4n",
    delayFeedback: 0.35,
    delayMix: 0.18,
    filterCutoff: 1000,
    crackleMix: 0.07,
    keys: ["C", "G", "F", "Am", "Dm", "Em"],
    progressions: [
      [
        [1, "maj"],
        [5, "maj"],
        [6, "min"],
        [4, "maj"],
      ],
      [
        [1, "maj"],
        [6, "min"],
        [4, "maj"],
        [5, "maj"],
      ],
      [
        [4, "maj"],
        [1, "maj"],
        [6, "min"],
        [5, "maj"],
      ],
      [
        [6, "min"],
        [4, "maj"],
        [1, "maj"],
        [5, "maj"],
      ],
    ],
    scaleType: "major",
    melodyRestProbability: 0.2,
    motifLength: [5, 8],
    useSoftVoicings: true,
    chordVoicing: ["block", "spread", "arpeggio"],
    susChordProbability: 0.2,
    extraInstruments: [
      { id: "piano", probability: 0.6 },
      { id: "violin", probability: 0.35 },
      { id: "guitar", probability: 0.25 },
    ],
  },
  {
    name: "Ambient",
    tempoRange: [65, 75],
    swing: 0.05,
    pad: {
      synthType: "FMSynth",
      options: {
        harmonicity: 2.5,
        modulationIndex: 1,
        oscillator: { type: "sine" },
        envelope: { attack: 0.8, decay: 0.3, sustain: 0.6, release: 2 },
      },
      volume: -4,
    },
    melody: {
      synthType: "Synth",
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.5 },
      },
      volume: -6,
    },
    bass: {
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.6 },
      },
      volume: -3,
    },
    drumPatterns: AMBIENT_PATTERNS,
    drumFills: AMBIENT_FILLS,
    kickVolume: -4,
    snareVolume: -10,
    hihatVolume: -16,
    reverbDecay: 5,
    reverbMix: 0.5,
    delayTime: "2n",
    delayFeedback: 0.4,
    delayMix: 0.25,
    filterCutoff: 1200,
    crackleMix: 0.08,
    keys: ["Am", "Dm", "Em", "C", "F"],
    progressions: [
      [
        [1, "min"],
        [4, "min"],
        [1, "min"],
        [4, "min"],
      ],
      [
        [1, "min"],
        [5, "min"],
        [1, "min"],
        [5, "min"],
      ],
      [
        [4, "min"],
        [1, "min"],
        [5, "min"],
        [1, "min"],
      ],
    ],
    scaleType: "pentatonic",
    melodyRestProbability: 0.6,
    motifLength: [3, 4],
    chordDurationBars: 2,
    useSoftVoicings: true,
    chordVoicing: ["block", "spread"],
    extraInstruments: [{ id: "violin", probability: 0.3 }],
  },
  {
    name: "Boom Bap",
    tempoRange: [85, 95],
    swing: 0.1,
    pad: {
      synthType: "Synth",
      options: {
        oscillator: { type: "square" },
        envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
      },
      volume: -6,
    },
    melody: {
      synthType: "Synth",
      options: {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.08, sustain: 0.3, release: 0.2 },
      },
      volume: -8,
    },
    bass: {
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.005, decay: 0.15, sustain: 0.6, release: 0.4 },
      },
      volume: -3,
    },
    drumPatterns: BOOMBAP_PATTERNS,
    drumFills: BOOMBAP_FILLS,
    kickVolume: 0,
    snareVolume: -4,
    hihatVolume: -10,
    reverbDecay: 2.5,
    reverbMix: 0.3,
    delayTime: "8n",
    delayFeedback: 0.25,
    delayMix: 0.12,
    filterCutoff: 1000,
    crackleMix: 0.15,
    keys: ["Am", "Dm", "Em", "Gm", "Cm", "Fm"],
    progressions: [
      [
        [1, "min"],
        [5, "min"],
        [1, "min"],
        [5, "min"],
      ],
      [
        [1, "min"],
        [4, "min"],
        [1, "min"],
        [5, "min"],
      ],
      [
        [1, "min"],
        [4, "min"],
        [5, "min"],
        [1, "min"],
      ],
    ],
    scaleType: "minPenta",
    useSoftVoicings: true,
    melodyRestProbability: 0.4,
    motifLength: [3, 5],
  },
  {
    name: "Sleepy",
    tempoRange: [60, 70],
    swing: 0.08,
    pad: {
      synthType: "Synth",
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 1.5 },
      },
      volume: -6,
    },
    melody: {
      synthType: "Synth",
      options: {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.35, release: 0.45 },
      },
      volume: -5,
    },
    bass: {
      options: {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.25, sustain: 0.5, release: 0.6 },
      },
      volume: -3,
    },
    drumPatterns: SLEEPY_PATTERNS,
    drumFills: SLEEPY_FILLS,
    kickVolume: -3,
    snareVolume: -8,
    hihatVolume: -14,
    reverbDecay: 4,
    reverbMix: 0.45,
    delayTime: "4n",
    delayFeedback: 0.35,
    delayMix: 0.2,
    filterCutoff: 1100,
    crackleMix: 0.05,
    keys: ["C", "F", "G", "Am", "Dm"],
    progressions: [
      [
        [1, "maj"],
        [4, "maj"],
        [1, "maj"],
        [5, "maj"],
      ],
      [
        [1, "maj"],
        [5, "maj"],
        [6, "min"],
        [4, "maj"],
      ],
      [
        [6, "min"],
        [4, "maj"],
        [1, "maj"],
        [5, "maj"],
      ],
    ],
    scaleType: "pentatonic",
    useSoftVoicings: true,
    melodyRestProbability: 0.65,
    motifLength: [3, 4],
  },
];
