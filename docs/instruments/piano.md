# Piano — Realistic Sound Synthesis Guide

## 1. Why Piano Is Hard to Synthesize

The piano is one of the most acoustically complex instruments. A single note involves:

- A felt hammer striking 1–3 steel strings simultaneously
- Nonlinear hammer-string compression forces
- String vibration with **inharmonicity** (partials are NOT perfect integer multiples)
- Energy transfer through a wooden bridge to a spruce soundboard
- Soundboard radiation into 3D space
- Sympathetic resonance from all undamped strings
- Two-stage decay (fast initial decay + slow sustained decay)
- Damper interaction on key release

No single synthesis technique captures all of this. Realistic piano synthesis is about **layering multiple approximations**.

---

## 2. Acoustic Fundamentals

### 2.1 Harmonic Series & Inharmonicity

An ideal string produces harmonics at exact integer multiples of the fundamental (f, 2f, 3f...). Piano strings are **stiff**, which adds a restoring force beyond tension alone. This causes each partial to be **progressively sharper** than a true harmonic:

```
fₙ = n × F × √(1 + B × n²)
```

Where:
- `n` = partial number (1 = fundamental, 2 = 2nd partial, etc.)
- `F` = ideal fundamental frequency
- `B` = inharmonicity coefficient

**B values by register (approximate):**

| Register       | Note Range | Typical B Value   |
|---------------|------------|-------------------|
| Low bass       | A0–B1      | 0.0004 – 0.001   |
| Upper bass     | C2–B2      | 0.0001 – 0.0004  |
| Mid range      | C3–B4      | 0.00003 – 0.0001 |
| Treble         | C5–B6      | 0.0001 – 0.0005  |
| Upper treble   | C7–C8      | 0.001 – 0.005    |

The U-shaped pattern (high in bass, low in midrange, high again in treble) comes from string design: bass strings are long and wound (increasing stiffness), midrange strings are optimally proportioned, and treble strings are short relative to their diameter.

**Perceptual effect:** Inharmonicity is what makes a piano sound like a piano and not an organ. It creates a slight "beating" warmth, especially in bass notes. Without it, synthesized piano sounds flat and lifeless.

### 2.2 Hammer Strike Position & Harmonic Suppression

The hammer strikes at approximately **1/7th of the string length**. This geometrically suppresses the 7th harmonic (and its multiples: 14th, 21st...), which fall outside equal temperament tuning. This is a deliberate design choice in acoustic pianos.

**Practical consequence for synthesis:** The 7th partial should be significantly attenuated (~-20 dB or more relative to fundamental).

### 2.3 Relative Partial Amplitudes

Approximate relative amplitudes for a **mid-range piano note (C4, 261.6 Hz)** at moderate velocity:

| Partial | Frequency (Hz) | Relative Amplitude (dB) |
|---------|----------------|------------------------|
| 1       | 261.6          | 0 (reference)          |
| 2       | 523.3          | -3                     |
| 3       | 785.0          | -7                     |
| 4       | 1046.5         | -10                    |
| 5       | 1308.0         | -14                    |
| 6       | 1569.8         | -16                    |
| 7       | 1831.5         | -26 (suppressed)       |
| 8       | 2093.0         | -20                    |
| 9       | 2354.6         | -22                    |
| 10      | 2616.2         | -25                    |

These vary with register:
- **Bass notes**: More partials, more energy in upper harmonics, more complex spectrum
- **Treble notes**: Fewer partials (often only 2–4 significant ones), fundamental dominates

### 2.4 Two-Stage Decay

Piano notes exhibit a characteristic **double decay**:

1. **Fast initial decay** (~first 0.5–2s): Energy from string modes that couple efficiently to the soundboard drains quickly. Perceptually, this is the "attack body."
2. **Slow sustained decay** (~2–20s depending on register): Remaining modes that couple poorly to the soundboard persist much longer.

**Decay times by register:**

| Register    | Fast Decay (s) | Slow Decay (s) |
|-------------|---------------|-----------------|
| Low bass    | 0.5 – 1.0    | 10 – 20+        |
| Mid bass    | 0.5 – 0.8    | 8 – 15          |
| Mid range   | 0.3 – 0.6    | 5 – 10          |
| Treble      | 0.2 – 0.4    | 2 – 5           |
| High treble | 0.1 – 0.2    | 0.5 – 2         |

The crossover between fast and slow decay is perceptually critical. It's what gives piano its distinctive "singing" sustain quality.

### 2.5 Velocity Response

Hammer velocity affects **both loudness and timbre**:

- **Soft (pp)**: Hammer compresses slowly → broader contact area → fewer high-frequency partials excited → warm, muted tone
- **Medium (mf)**: Balanced spectrum
- **Hard (ff)**: Hammer compresses quickly → narrow contact area → more high-frequency partials → bright, percussive tone

This is NOT just a volume change. The **spectral envelope shifts** — roughly:
- pp: partials above the 4th are ~6 dB quieter relative to fundamental
- ff: partials above the 4th are ~6 dB louder relative to fundamental

### 2.6 Sympathetic Resonance

When strings are undamped (sustain pedal), all 230+ strings resonate sympathetically with any struck note. This adds:

- A subtle "halo" of overtones tuned to harmonics of the played notes
- Slight chorusing from near-unison strings
- Extended sustain
- Richer, more complex timbre

---

## 3. Implementation

### 3.1 Current Implementation (in `src/lib/lofi/instruments/piano.ts`)

The piano uses a `PianoInstrument` class with:

| Layer | Synth | Purpose |
|-------|-------|---------|
| Body A | PolySynth(Synth) with custom partials, detune -3 | Main tone, detuned for inharmonicity beating |
| Body B | PolySynth(Synth) with custom partials, detune +3 | Unison layer |
| Tail | PolySynth(Synth), fewer partials, long decay | Slow decay sustain |
| Hammer | NoiseSynth (white) → bandpass 3 kHz | Percussive attack transient |

- **Partials**: `[1, 0.71, 0.45, 0.32, 0.2, 0.16, 0.05, 0.1, 0.08, 0.06]` — 7th suppressed
- **Brightness filter**: Velocity-mapped lowpass (800 + v×5200 Hz → decays to 30% over 1s)
- **Envelopes**: Body attack 0.005, decay 1.0, sustain 0.08, release 0.8; Tail decay 4.0, release 2.0
- **Not implemented**: Per-register partials, sympathetic reverb (sustain pedal), true inharmonicity (partials are harmonic; detuned unison approximates it)

### 3.2 Previous Implementation (Replaced)

Previously: single `FMSynth` with harmonicity 3, modulationIndex 2, sine oscillator. Problems:

| Problem | Impact |
|---------|--------|
| Single `FMSynth` with `harmonicity: 3` | Creates harmonics at 3× fundamental — sounds metallic/bell-like |
| No inharmonicity | Organ-like quality |
| Single-stage ADSR | Misses two-stage decay |
| No velocity-dependent timbre | Spectrum stays constant |
| No hammer transient | Missing percussive attack |

---

## 4. Synthesis Strategy for Realistic Piano

The best approach within Tone.js (no samples) combines multiple techniques:

### 4.1 Custom Partials via Additive Synthesis

Tone.js supports custom waveforms through the `partials` array. This is the **most impactful single improvement**.

```typescript
// Mid-range piano partial template (relative linear amplitudes)
const PIANO_PARTIALS_MID = [
  1.0,    // 1st (fundamental)
  0.71,   // 2nd
  0.45,   // 3rd
  0.32,   // 4th
  0.20,   // 5th
  0.16,   // 6th
  0.05,   // 7th (suppressed — hammer at 1/7 position)
  0.10,   // 8th
  0.08,   // 9th
  0.06,   // 10th
  0.04,   // 11th
  0.03,   // 12th
];
```

Use `type: "custom"` with `partials` array:

```typescript
new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: "custom",
    partials: PIANO_PARTIALS_MID,
  },
  envelope: { /* ... */ },
});
```

### 4.2 Register-Dependent Partials

Create different partial templates per register:

```typescript
const PIANO_PARTIALS = {
  bass: [1.0, 0.8, 0.6, 0.5, 0.4, 0.35, 0.05, 0.25, 0.2, 0.18, 0.15, 0.12, 0.1, 0.08],
  mid:  [1.0, 0.71, 0.45, 0.32, 0.2, 0.16, 0.05, 0.1, 0.08, 0.06, 0.04, 0.03],
  treble: [1.0, 0.5, 0.2, 0.08, 0.03],
};

function getPartialsForNote(note: string): number[] {
  const midi = Tone.Frequency(note).toMidi();
  if (midi < 48) return PIANO_PARTIALS.bass;    // Below C3
  if (midi < 72) return PIANO_PARTIALS.mid;     // C3 to B4
  return PIANO_PARTIALS.treble;                  // C5 and above
}
```

**Limitation:** `PolySynth` uses a single oscillator config. To get per-note partials, you'd need either:
- Multiple `PolySynth` instances split by register (recommended)
- A custom wrapper that reconfigures per-note (complex, might cause clicks)

### 4.3 Two-Stage Decay Envelope

A single ADSR cannot model two-stage decay. Options:

**Option A — Approximation with long decay + moderate sustain:**
```typescript
envelope: {
  attack: 0.005,
  decay: 1.5,      // fast decay phase
  sustain: 0.15,   // level where "slow decay" begins
  release: 3.0,    // release simulates slow decay tail
}
```

**Option B — Dual-layer approach (better):**
Layer two synths per voice — one for the fast-decaying "body" and one for the slow-decaying "sustain":

```typescript
// Layer 1: Attack body (fast decay, louder)
const pianoBody = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "custom", partials: PIANO_PARTIALS.mid },
  envelope: { attack: 0.005, decay: 0.8, sustain: 0, release: 0.1 },
  volume: -5,
});

// Layer 2: Sustain tail (slow decay, quieter, fewer partials)
const pianoTail = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: "custom", partials: [1.0, 0.4, 0.15, 0.05] },
  envelope: { attack: 0.01, decay: 4.0, sustain: 0, release: 2.0 },
  volume: -12,
});

// Trigger both together
function playPianoNote(note: string, duration: string, time: number) {
  pianoBody.triggerAttackRelease(note, duration, time);
  pianoTail.triggerAttackRelease(note, duration, time);
}
```

### 4.4 Hammer Transient Layer

The percussive "thunk" of the hammer hitting the string is critical for attack realism. Use a short noise burst:

```typescript
const hammerNoise = new Tone.NoiseSynth({
  noise: { type: "white" },
  envelope: { attack: 0.001, decay: 0.015, sustain: 0 },
  volume: -25,
});

// Route through a bandpass to shape the "knock"
const hammerFilter = new Tone.Filter({
  frequency: 3000,
  type: "bandpass",
  Q: 2,
});

hammerNoise.connect(hammerFilter);
hammerFilter.connect(/* destination */);
```

Trigger the hammer noise on each note attack for a subtle mechanical quality.

### 4.5 Velocity-Dependent Timbre (Brightness)

Since Tone.js `PolySynth` doesn't support per-note velocity control of oscillator partials, simulate brightness changes with a **velocity-controlled filter**:

```typescript
const brightnessFilter = new Tone.Filter({
  frequency: 2000,   // base brightness
  type: "lowpass",
  rolloff: -12,
});

// Before each note, adjust filter based on velocity
function playWithVelocity(note: string, velocity: number, duration: string, time: number) {
  // Map velocity (0-1) to filter frequency (800 Hz – 6000 Hz)
  const filterFreq = 800 + velocity * 5200;
  brightnessFilter.frequency.setValueAtTime(filterFreq, time);
  brightnessFilter.frequency.exponentialRampToValueAtTime(filterFreq * 0.4, time + 0.5);

  piano.triggerAttackRelease(note, duration, time, velocity);
}
```

This mimics how harder hammer strikes excite more high-frequency content.

### 4.6 Simulating Inharmonicity

True per-partial inharmonicity isn't possible with Tone.js `partials` (they're locked to integer multiples). Workarounds:

**Detuned unison layers (chorus effect):**
```typescript
const pianoA = new Tone.PolySynth(Tone.Synth, { /* config */ });
const pianoB = new Tone.PolySynth(Tone.Synth, { /* config */ });

pianoA.set({ detune: -3 });  // ~3 cents flat
pianoB.set({ detune: +3 });  // ~3 cents sharp
```

This creates beating between the two layers, mimicking the natural inharmonicity-induced beating of real piano strings. In a real piano, each note has 2–3 strings tuned very slightly apart for exactly this effect.

**FM-based inharmonicity:**
A small amount of FM modulation with a non-integer harmonicity ratio introduces non-harmonic partials:

```typescript
new Tone.FMSynth({
  harmonicity: 1.0005,     // very slight detuning from integer
  modulationIndex: 0.3,    // subtle modulation
  oscillator: { type: "custom", partials: PIANO_PARTIALS.mid },
  modulation: { type: "sine" },
  envelope: { /* piano envelope */ },
});
```

### 4.7 Sympathetic Resonance (Sustain Pedal Effect)

Add a convolution reverb or long feedback delay to simulate sympathetic resonance when the "pedal" is engaged:

```typescript
const sympatheticReverb = new Tone.Reverb({
  decay: 4,
  wet: 0,  // off by default
});

function setSustainPedal(on: boolean) {
  sympatheticReverb.wet.rampTo(on ? 0.15 : 0, 0.1);
}
```

---

## 5. Recommended Implementation (Combining All Techniques)

A three-layer piano architecture:

```
┌─────────────────────────────────────────────────────┐
│                    Piano Note                        │
├──────────┬──────────────┬───────────────────────────┤
│  Layer 1 │   Layer 2    │         Layer 3           │
│  Hammer  │  Body (fast) │      Tail (slow)          │
│  Noise   │  Custom wave │      Custom wave          │
│  ~15ms   │  ~0.8s decay │      ~4s decay            │
│  -25 dB  │  -5 dB       │      -12 dB               │
└────┬─────┴──────┬───────┴───────────┬───────────────┘
     │            │                   │
     ▼            ▼                   ▼
  Bandpass    Brightness          Low-pass
  (3 kHz)    Filter (vel)        (2 kHz)
     │            │                   │
     └────────────┼───────────────────┘
                  ▼
          Detuned Unison (+/- 3 cents)
                  │
                  ▼
          Sympathetic Reverb
                  │
                  ▼
            Main Mix Bus
```

### Full Example:

```typescript
import * as Tone from "tone";

const PIANO_PARTIALS = {
  bass:   [1.0, 0.8, 0.6, 0.5, 0.4, 0.35, 0.05, 0.25, 0.2, 0.18, 0.15, 0.12],
  mid:    [1.0, 0.71, 0.45, 0.32, 0.2, 0.16, 0.05, 0.1, 0.08, 0.06],
  treble: [1.0, 0.5, 0.2, 0.08, 0.03],
};

class RealisticPiano {
  private bodyA: InstanceType<typeof Tone.PolySynth>;
  private bodyB: InstanceType<typeof Tone.PolySynth>;
  private tail: InstanceType<typeof Tone.PolySynth>;
  private hammer: InstanceType<typeof Tone.NoiseSynth>;
  private brightnessFilter: InstanceType<typeof Tone.Filter>;
  private hammerFilter: InstanceType<typeof Tone.Filter>;
  private sympatheticReverb: InstanceType<typeof Tone.Reverb>;

  constructor(destination: Tone.InputNode) {
    this.sympatheticReverb = new Tone.Reverb({ decay: 4, wet: 0 });
    this.sympatheticReverb.connect(destination as Tone.ToneAudioNode);

    this.brightnessFilter = new Tone.Filter({
      frequency: 3000, type: "lowpass", rolloff: -12,
    });
    this.brightnessFilter.connect(this.sympatheticReverb);

    // Body layer A (slightly flat)
    this.bodyA = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: PIANO_PARTIALS.mid },
      envelope: { attack: 0.005, decay: 1.0, sustain: 0.08, release: 0.8 },
      volume: -8,
    });
    this.bodyA.set({ detune: -3 });
    this.bodyA.connect(this.brightnessFilter);

    // Body layer B (slightly sharp)
    this.bodyB = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: PIANO_PARTIALS.mid },
      envelope: { attack: 0.005, decay: 1.0, sustain: 0.08, release: 0.8 },
      volume: -8,
    });
    this.bodyB.set({ detune: +3 });
    this.bodyB.connect(this.brightnessFilter);

    // Sustain tail layer
    this.tail = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "custom", partials: [1.0, 0.4, 0.15, 0.05] },
      envelope: { attack: 0.01, decay: 4.0, sustain: 0, release: 2.0 },
      volume: -14,
    });
    this.tail.connect(this.sympatheticReverb);

    // Hammer transient
    this.hammerFilter = new Tone.Filter({
      frequency: 3000, type: "bandpass", Q: 2,
    });
    this.hammerFilter.connect(destination as Tone.ToneAudioNode);

    this.hammer = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.015, sustain: 0 },
      volume: -25,
    });
    this.hammer.connect(this.hammerFilter);
  }

  triggerAttackRelease(
    note: string | string[],
    duration: Tone.Unit.Time,
    time: number,
    velocity = 0.7
  ) {
    const filterFreq = 800 + velocity * 5200;
    this.brightnessFilter.frequency.setValueAtTime(filterFreq, time);
    this.brightnessFilter.frequency.exponentialRampToValueAtTime(
      filterFreq * 0.3, time + 1.0
    );

    this.bodyA.triggerAttackRelease(note, duration, time, velocity);
    this.bodyB.triggerAttackRelease(note, duration, time, velocity);
    this.tail.triggerAttackRelease(note, duration, time, velocity * 0.6);
    this.hammer.triggerAttackRelease("16n", time);
  }

  releaseAll() {
    this.bodyA.releaseAll();
    this.bodyB.releaseAll();
    this.tail.releaseAll();
  }

  setSustainPedal(on: boolean) {
    this.sympatheticReverb.wet.rampTo(on ? 0.15 : 0, 0.1);
  }

  dispose() {
    this.bodyA.dispose();
    this.bodyB.dispose();
    this.tail.dispose();
    this.hammer.dispose();
    this.brightnessFilter.dispose();
    this.hammerFilter.dispose();
    this.sympatheticReverb.dispose();
  }
}
```

---

## 6. Parameter Tuning Guide

### Envelope by Register

| Register | Attack (s) | Body Decay (s) | Tail Decay (s) | Release (s) |
|----------|-----------|-----------------|-----------------|-------------|
| Bass     | 0.008     | 1.5             | 8.0             | 4.0         |
| Mid      | 0.005     | 1.0             | 4.0             | 2.0         |
| Treble   | 0.003     | 0.5             | 1.5             | 0.8         |

### Brightness Filter by Velocity

| Velocity (0–1) | Filter Cutoff (Hz) | Decay Slope |
|-----------------|--------------------|----|
| 0.1 (pp)        | 1200               | Slow roll-off to 400 Hz |
| 0.5 (mf)        | 3000               | Medium roll-off to 900 Hz |
| 0.9 (ff)        | 6000               | Fast initial → 1800 Hz |

### Detune Amount for Unison Beating

| Register | Detune (cents) | Rationale |
|----------|---------------|-----------|
| Bass     | ±5            | More beating in bass — real pianos have wider tuning spread here |
| Mid      | ±3            | Standard |
| Treble   | ±1.5          | Tighter tuning, less beating |

---

## 7. Lofi Context Considerations

For a **lofi** piano specifically, the synthesis doesn't need to be perfectly realistic. Lofi aesthetics actually benefit from:

- **Slightly muffled tone**: Lower the brightness filter cutoff by 20–30%
- **Tape wow/flutter**: Add slow LFO (0.1–0.5 Hz) to detune (±10–20 cents)
- **Bit reduction**: Route through `Tone.BitCrusher` at 12-bit for subtle grit
- **Vinyl warmth**: The existing lowpass filter in the mixer chain handles this
- **Imperfect timing**: The existing scheduler randomization helps
- **Room reverb**: Slightly higher wet mix than a "clean" piano

The point is: the realistic synthesis foundations described above make the lofi processing **sound better** because you're degrading a rich source signal rather than degrading an already thin one.

---

## 8. References

1. **Piano acoustics** — Wikipedia. Covers string design, hammer position, inharmonicity, soundboard coupling.
2. **Martin & Ward (1961)** — "Decay Characteristics of Piano Tones" — Journal of the Acoustical Society of America. Two-stage decay measurements.
3. **Conklin (1996)** — "Piano strings with reduced inharmonicity" — Measured B coefficients across registers.
4. **Bank & Sujbert (2005)** — "Generation of longitudinal vibrations in piano strings: From physics to sound synthesis" — IEEE Signal Processing Magazine.
5. **Julius O. Smith III** — *Physical Audio Signal Processing* — Stanford CCRMA. Chapters on commuted piano synthesis, Karplus-Strong, and dispersion filters. https://ccrma.stanford.edu/~jos/pasp/Piano_Synthesis.html
6. **Esquef et al. (2023)** — "Physics-informed differentiable method for piano modeling" — Frontiers in Signal Processing.
7. **Renault et al. (2024)** — "Sines, transient, noise neural modeling of piano notes" — Frontiers in Signal Processing.
8. **Bank (2000)** — Part-pedaling analysis and sustain pedal modeling — Aalto University acoustics research.
9. **Tone.js documentation** — Custom oscillator partials, FMSynth, PolySynth API. https://tonejs.github.io/
