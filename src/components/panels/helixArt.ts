// Draws the turning double helix in the "Genomic sequence" panel, and makes the
// made-up sequence shown beside it.
//
// The sequence is SYNTHETIC: random letters generated from a seed. It is not
// read from any person and says nothing about anyone's genes.

export type Base = "A" | "T" | "G" | "C";
export const BASES: Base[] = ["A", "T", "G", "C"];
const PAIR: Record<Base, Base> = { A: "T", T: "A", G: "C", C: "G" };

// A small repeatable random number generator: the same seed always gives the same numbers.
function generator(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeSequence(seed: string, length = 240): Base[] {
  const next = generator(seed);
  return Array.from({ length }, () => BASES[Math.floor(next() * 4)]);
}

// Share of each letter in a sequence, as percentages that are worked out, not invented.
export function composition(sequence: Base[]): Record<Base, number> {
  const counts: Record<Base, number> = { A: 0, T: 0, G: 0, C: 0 };
  for (const base of sequence) counts[base] += 1;
  const total = sequence.length || 1;
  return { A: (counts.A / total) * 100, T: (counts.T / total) * 100, G: (counts.G / total) * 100, C: (counts.C / total) * 100 };
}

export const pairOf = (base: Base): Base => PAIR[base];

// Draws one frame of the helix. "time" is in seconds and makes it turn.
export function drawHelix(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, sequence: Base[]) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const reach = Math.min(w * 0.34, 46);
  const top = 10;
  const bottom = h - 10;
  const twist = 0.045; // how tightly the strands wind
  const at = (y: number) => y * twist + time * 0.9;

  // Rungs: one per letter pair, brighter when facing the viewer.
  const gap = 9;
  ctx.font = "9px ui-monospace, Consolas, monospace";
  ctx.textBaseline = "middle";
  let index = 0;
  for (let y = top + 4; y <= bottom - 4; y += gap) {
    const s = Math.sin(at(y));
    const c = Math.cos(at(y));
    const x1 = cx + reach * s;
    const x2 = cx - reach * s;
    ctx.strokeStyle = `rgba(54, 227, 214, ${0.18 + 0.4 * Math.abs(s)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();

    // The two ends of the rung; the nearer one is drawn larger.
    for (const [x, near] of [
      [x1, c],
      [x2, -c],
    ] as [number, number][]) {
      ctx.fillStyle = near > 0 ? "#bffaf4" : "rgba(54, 227, 214, 0.55)";
      ctx.beginPath();
      ctx.arc(x, y, near > 0 ? 2.6 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Letters beside the helix for every third rung.
    if (index % 3 === 0 && sequence.length > 0) {
      const base = sequence[index % sequence.length];
      ctx.fillStyle = "rgba(138, 180, 188, 0.9)";
      ctx.textAlign = "right";
      ctx.fillText(base, cx - reach - 10, y);
      ctx.textAlign = "left";
      ctx.fillText(pairOf(base), cx + reach + 10, y);
    }
    index += 1;
  }

  // The two backbones.
  for (const sign of [1, -1]) {
    ctx.strokeStyle = sign === 1 ? "#36e3d6" : "rgba(54, 227, 214, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = top; y <= bottom; y += 2) {
      const x = cx + sign * reach * Math.sin(at(y));
      if (y === top) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
