/**
 * Deterministic 32-bit PRNG using sfc32 (Small Fast Counter, 128-bit state).
 * Pure integer bitwise arithmetic; cross-platform identical in Worker and Node.
 */

export type RngStateTuple = [number, number, number, number];

function splitmix32(seed: number): () => number {
  let z = seed >>> 0;
  return () => {
    z = (z + 0x9e3779b9) >>> 0;
    let t = z ^ (z >>> 16);
    t = Math.imul(t, 0x21f0aaad) >>> 0;
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97) >>> 0;
    return (t ^ (t >>> 15)) >>> 0;
  };
}

export class SeededRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number) {
    const gen = splitmix32(seed >>> 0);
    this.a = gen();
    this.b = gen();
    this.c = gen();
    this.d = gen() | 1;
    // Mix initial state thoroughly
    for (let i = 0; i < 12; i++) {
      this.nextUint32();
    }
  }

  static fromState(state: RngStateTuple): SeededRng {
    const rng = new SeededRng(0);
    rng.setState(state);
    return rng;
  }

  /** Produce next deterministic unsigned 32-bit integer. */
  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Integer in [0, 999] inclusive. */
  nextPermille(): number {
    return this.nextUint32() % 1000;
  }

  /** Integer in [min, max] inclusive. */
  nextInt(min: number, max: number): number {
    const lo = Math.trunc(min);
    const hi = Math.trunc(max);
    if (hi <= lo) return lo;
    const span = (hi - lo + 1) >>> 0;
    return lo + (this.nextUint32() % span);
  }

  getState(): RngStateTuple {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state: RngStateTuple): void {
    this.a = state[0] >>> 0;
    this.b = state[1] >>> 0;
    this.c = state[2] >>> 0;
    this.d = state[3] >>> 0;
  }

  clone(): SeededRng {
    return SeededRng.fromState(this.getState());
  }
}
