// Draws the pictures in the "Imaging view" panel.
//
// These are ILLUSTRATIONS made by code: simple shapes arranged to look like a
// cross-section of a head or a chest. They are not scans, they contain no
// patient data, and nothing can be read from them medically. The only real
// data in them is the outline colour of the lungs and heart, which follows
// the status of that region in the digital twin.

export type ScanView = "head" | "chest";

export const SCAN_SLICES = 24;

export interface ScanColours {
  line: string; // main drawing colour
  dim: string; // faint structures
  bone: string;
  lungs: string; // status colour of the lungs region
  heart: string; // status colour of the heart region
  label: string;
}

// An oval whose edge wobbles, used for the folded surface of the brain.
function wavyOval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, wobble: number, phase: number) {
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const k = 1 + wobble * Math.sin(9 * a + phase) + wobble * 0.6 * Math.sin(17 * a - phase * 1.7);
    const x = cx + rx * k * Math.cos(a);
    const y = cy + ry * k * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, tilt = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), tilt, 0, Math.PI * 2);
}

function frame(ctx: CanvasRenderingContext2D, w: number, h: number, colours: ScanColours, marks: [string, string, string, string]) {
  // Faint horizontal lines, like a monitor.
  ctx.strokeStyle = "rgba(54, 227, 214, 0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0.5; y < h; y += 4) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  // Centre marks and direction letters.
  ctx.strokeStyle = colours.dim;
  ctx.beginPath();
  ctx.moveTo(w / 2, 4);
  ctx.lineTo(w / 2, 12);
  ctx.moveTo(w / 2, h - 12);
  ctx.lineTo(w / 2, h - 4);
  ctx.moveTo(4, h / 2);
  ctx.lineTo(12, h / 2);
  ctx.moveTo(w - 12, h / 2);
  ctx.lineTo(w - 4, h / 2);
  ctx.stroke();

  ctx.fillStyle = colours.label;
  ctx.font = "10px ui-monospace, Consolas, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(marks[0], w / 2, 20);
  ctx.fillText(marks[1], w / 2, h - 20);
  ctx.textAlign = "left";
  ctx.fillText(marks[2], 16, h / 2);
  ctx.textAlign = "right";
  ctx.fillText(marks[3], w - 16, h / 2);
}

function drawHead(ctx: CanvasRenderingContext2D, w: number, h: number, slice: number, colours: ScanColours) {
  const cx = w / 2;
  const cy = h / 2;
  // Slices near the top and bottom of the head are smaller than those in the middle.
  const depth = Math.sin((Math.PI * (slice + 1)) / (SCAN_SLICES + 1));
  const size = Math.min(w * 0.3, h * 0.36) * (0.62 + 0.38 * depth);

  // Skull: two rings.
  ctx.lineWidth = 2;
  ctx.strokeStyle = colours.line;
  oval(ctx, cx, cy, size * 0.84, size);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = colours.dim;
  oval(ctx, cx, cy, size * 0.78, size * 0.93);
  ctx.stroke();

  // Brain: a soft fill with several wobbly outlines inside one another.
  const glow = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.9);
  glow.addColorStop(0, "rgba(54, 227, 214, 0.05)");
  glow.addColorStop(1, "rgba(54, 227, 214, 0.22)");
  ctx.fillStyle = glow;
  wavyOval(ctx, cx, cy, size * 0.71, size * 0.86, 0.03, slice * 0.5);
  ctx.fill();
  for (let i = 0; i < 4; i++) {
    const shrink = 1 - i * 0.17;
    ctx.globalAlpha = 0.85 - i * 0.18;
    ctx.strokeStyle = colours.line;
    wavyOval(ctx, cx, cy, size * 0.71 * shrink, size * 0.86 * shrink, 0.03 + i * 0.012, slice * 0.5 + i * 1.3);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // The gap between the two halves.
  ctx.strokeStyle = colours.dim;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.84);
  ctx.lineTo(cx, cy + size * 0.84);
  ctx.stroke();

  // Fluid spaces in the middle, only visible in the middle slices.
  if (depth > 0.75) {
    const v = size * 0.2 * (depth - 0.75) * 4;
    ctx.fillStyle = "rgba(3, 14, 21, 0.9)";
    ctx.strokeStyle = colours.line;
    for (const side of [-1, 1]) {
      oval(ctx, cx + side * v * 0.55, cy - size * 0.05, v * 0.32, v * 0.95, side * 0.35);
      ctx.fill();
      ctx.stroke();
    }
  }

  frame(ctx, w, h, colours, ["FRONT", "BACK", "R", "L"]);
}

function drawChest(ctx: CanvasRenderingContext2D, w: number, h: number, slice: number, colours: ScanColours) {
  const cx = w / 2;
  const cy = h / 2;
  const depth = Math.sin((Math.PI * (slice + 1)) / (SCAN_SLICES + 1));
  const ry = Math.min(h * 0.33, w * 0.24);
  const rx = ry * 1.45;

  // Body outline and the rib cage inside it.
  ctx.lineWidth = 2;
  ctx.strokeStyle = colours.line;
  oval(ctx, cx, cy, rx, ry);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = colours.bone;
  ctx.globalAlpha = 0.55;
  ctx.setLineDash([10, 7]);
  oval(ctx, cx, cy, rx * 0.9, ry * 0.86);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Lungs: outline colour follows the twin's status for the lungs region.
  const lungRx = rx * 0.33 * (0.7 + 0.3 * depth);
  const lungRy = ry * 0.6 * (0.7 + 0.3 * depth);
  for (const side of [-1, 1]) {
    const lx = cx + side * rx * 0.47;
    ctx.fillStyle = "rgba(3, 14, 21, 0.85)";
    ctx.strokeStyle = colours.lungs;
    ctx.lineWidth = 2;
    oval(ctx, lx, cy - ry * 0.05, lungRx, lungRy, side * 0.12);
    ctx.fill();
    ctx.stroke();
    // A few branching airways.
    ctx.lineWidth = 1;
    ctx.strokeStyle = colours.dim;
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(lx - side * lungRx * 0.75, cy - ry * 0.05);
      ctx.quadraticCurveTo(lx, cy - ry * 0.05 + i * lungRy * 0.25, lx + side * lungRx * 0.55, cy - ry * 0.05 + i * lungRy * 0.6);
    }
    ctx.stroke();
  }

  // Heart: outline colour follows the twin's status for the heart region.
  const heartSize = ry * 0.3 * (0.75 + 0.25 * depth);
  ctx.fillStyle = "rgba(54, 227, 214, 0.1)";
  ctx.strokeStyle = colours.heart;
  ctx.lineWidth = 2;
  oval(ctx, cx + rx * 0.06, cy + ry * 0.12, heartSize * 1.15, heartSize, 0.3);
  ctx.fill();
  ctx.stroke();

  // Spine at the back, breastbone at the front.
  ctx.strokeStyle = colours.bone;
  ctx.fillStyle = "rgba(217, 246, 244, 0.15)";
  oval(ctx, cx, cy + ry * 0.62, ry * 0.13, ry * 0.13);
  ctx.fill();
  ctx.stroke();
  oval(ctx, cx, cy - ry * 0.78, ry * 0.12, ry * 0.05);
  ctx.stroke();

  frame(ctx, w, h, colours, ["FRONT", "BACK", "R", "L"]);
}

export function drawScan(ctx: CanvasRenderingContext2D, w: number, h: number, view: ScanView, slice: number, colours: ScanColours) {
  ctx.clearRect(0, 0, w, h);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  if (view === "head") drawHead(ctx, w, h, slice, colours);
  else drawChest(ctx, w, h, slice, colours);
}
