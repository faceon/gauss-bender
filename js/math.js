import { state } from './state.js';

export function buildPegProb(N) {
  var arr = [];
  for (var row = 0; row < N; row++) {
    var r = [];
    for (var k = 0; k <= row; k++) r.push(0.5);
    arr.push(r);
  }
  return arr;
}

export function buildBinBalls(N) {
  var arr = [];
  for (var j = 0; j <= N; j++) arr.push([]);
  return arr;
}

export function ballPassesThroughPeg(path, targetRow, targetIdx) {
  var k = 0;
  for (var row = 0; row < path.length; row++) {
    if (row === targetRow) return k === targetIdx;
    if (path[row] === 'R') k += 1;
  }
  return false;
}

export function countRights(path) {
  var k = 0;
  for (var i = 0; i < path.length; i++) if (path[i] === 'R') k += 1;
  return k;
}

export function computeExpected(L) {
  var dp = [[1]];
  for (var row = 0; row < L.N; row++) {
    var next = new Array(row + 2).fill(0);
    for (var k = 0; k <= row; k++) {
      var pL = state.pegProb[row][k];
      var prob = dp[row][k];
      next[k] += prob * pL;
      next[k + 1] += prob * (1 - pL);
    }
    dp.push(next);
  }
  return dp[L.N];
}

export function parseProbInput(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (isNaN(val)) return null;
    return Math.max(0, Math.min(1, val));
  }
  var str = String(val).trim();
  if (!str) return null;

  if (str.indexOf('/') !== -1) {
    var parts = str.split('/');
    if (parts.length === 2) {
      var num = parseFloat(parts[0].trim());
      var den = parseFloat(parts[1].trim());
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        var v = num / den;
        return Math.max(0, Math.min(1, v));
      }
    }
    return null;
  }

  var v = parseFloat(str);
  if (isNaN(v)) return null;
  return Math.max(0, Math.min(1, v));
}

export function formatProb(prob) {
  if (prob === null || prob === undefined || isNaN(prob)) return '0.5';
  var rounded = Math.round(prob * 1000) / 1000;
  return String(rounded);
}

// Ball counts/queued totals are unbounded (they only grow as more balls are
// dropped), but the telemetry badges only have room budgeted for 4 digits.
// Past that, collapse to thousands with a comma (e.g. 4123456 -> "4,123K")
// instead of letting the raw digit string keep growing the badge forever.
export function formatCount(n) {
  var abs = Math.abs(n);
  if (abs < 10000) return String(n);
  var thousands = Math.floor(abs / 1000);
  var sign = n < 0 ? '-' : '';
  return sign + thousands.toLocaleString('en-US') + 'K';
}


