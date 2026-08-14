import { W, H } from './constants.js';
import { state } from './state.js';

export function layout() {
  var N = state.N;
  var marginX = 40, topY = 26, bottomBarsH = 100, labelH = 20;
  var boardH = H - topY - bottomBarsH - labelH;
  var rowHeight = boardH / (N + 1);
  var spacing = Math.min(38, (W - 2 * marginX) / (N + 2));
  var centerX = W / 2;
  var landY = topY + N * rowHeight + 6;
  var barsBottomY = landY + bottomBarsH;
  return {
    N: N,
    marginX: marginX,
    topY: topY,
    rowHeight: rowHeight,
    spacing: spacing,
    centerX: centerX,
    landY: landY,
    barsBottomY: barsBottomY
  };
}

export function pegX(L, row, k) {
  return L.centerX + (k - row / 2) * L.spacing;
}

export function binX(L, j) {
  return L.centerX + (j - L.N / 2) * L.spacing;
}

export function getTargetStackY(L, bin) {
  var maxBinCount = 0;
  for (var i = 0; i <= L.N; i++) {
    var count = state.binCounts[i] || 0;
    if (count > maxBinCount) maxBinCount = count;
  }
  var barW = Math.min(30, L.spacing * 0.8);
  var barsAreaH = L.barsBottomY - L.landY;
  var rBall = Math.max(1.4, Math.min(6, barW / 2 - 1));
  var baseStep = rBall * 2 + 0.6;
  var neededH = maxBinCount * baseStep + rBall + 6;
  var zoomY = neededH > barsAreaH ? (barsAreaH - rBall - 6) / (maxBinCount * baseStep) : 1.0;
  zoomY = Math.max(0.1, zoomY);

  var yStep = baseStep * zoomY;
  var rBallY = rBall * zoomY;
  var currentCount = state.binBalls[bin] ? state.binBalls[bin].length : 0;
  return L.barsBottomY - rBallY - currentCount * yStep;
}
