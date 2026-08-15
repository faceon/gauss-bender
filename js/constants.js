// W is intentionally `let` (not `var`/const-like) and reassigned by
// setBoardAspect() below. ES module bindings are live, so every file that
// does `import { W } from './constants.js'` always reads the current value
// — no need to re-import or thread it through function calls.
export let W = 640;
export var H = 414;
export var PEG_R = 5;

var MIN_ASPECT = 0.4;
var MAX_ASPECT = 3.4;

// Keeps H fixed (it drives every vertical magic number in layout.js /
// renderer.js — topY, bottomBarsH, font sizes, peg radius caps — all tuned
// against 414) and derives W from the canvas's actual on-screen aspect
// ratio, so the board's logical coordinate space always matches its
// container exactly. That eliminates the letterboxing that used to shrink
// the board to a fraction of the screen on portrait / unusual aspect
// ratios: the canvas previously kept a fixed 640/414 shape no matter how
// tall or narrow its box was.
export function setBoardAspect(aspect) {
  var clamped = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, aspect));
  W = Math.round(H * clamped);
}

export var COLOR_PEG = '#cbb896';
export var COLOR_LEFT_BIAS = '#534AB7';
export var COLOR_RIGHT_BIAS = '#D85A30';
export var COLOR_THEORY = '#eecd82';
export var COLOR_SELECTED = '#378ADD';
export var COLOR_HOVER_PEG = '#EF9F27';
export var COLOR_L = '#378ADD';
export var COLOR_R = '#E24B4A';

export var MAX_SPEED = 5.5;
