/**
 * Mulberry32 seeded PRNG. Fast, good distribution, 32-bit state.
 * Same seed = same sequence. For deterministic music generation.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
  }

  /** Returns float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d_2b_79_f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  }

  /** Integer in [min, max] inclusive */
  int(min: number, max: number): number {
    return (this.next() * (max - min + 1) + min) | 0;
  }

  /** Float in [min, max) */
  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /** Pick one item from array */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Pick with weights (weights need not sum to 1) */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        return items[i];
      }
    }
    return items[items.length - 1];
  }

  /** Shuffle array (Fisher-Yates, returns new array) */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** Boolean with probability p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Box-Muller transform for Gaussian distribution */
  gaussian(mean: number, stddev: number): number {
    const u1 = this.next();
    const u2 = this.next();
    if (u1 < 1e-10) {
      return mean;
    }
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stddev * z;
  }

  /** Fork: create a child Rng from current state (isolated sub-generation) */
  fork(): Rng {
    return new Rng(this.state);
  }
}
