// Lightweight synthesized sound effects (Web Audio API, no assets).
// Kept intentionally quiet and short so the board stays calm even when many
// balls are dropping and colliding with pegs at once.

var STORAGE_KEY = 'gauss-bender-sound-enabled'

var ctx = null
var master = null
var noiseBuffer = null
var enabled = readEnabledPref()

function readEnabledPref() {
  try {
    var v = window.localStorage.getItem(STORAGE_KEY)
    return v === null ? true : v === '1'
  } catch (e) {
    return true
  }
}

function writeEnabledPref(v) {
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  } catch (e) {
    /* ignore (private mode / disabled storage) */
  }
}

function ensureContext() {
  if (ctx) return ctx
  var AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)
  return ctx
}

function resumeContext() {
  var c = ensureContext()
  if (c && c.state === 'suspended') c.resume()
}

;['pointerdown', 'keydown', 'touchstart'].forEach(function (evt) {
  window.addEventListener(evt, resumeContext, { passive: true })
})

export function isSoundEnabled() {
  return enabled
}

export function setSoundEnabled(v) {
  enabled = !!v
  writeEnabledPref(enabled)
}

function getNoiseBuffer(c) {
  if (noiseBuffer) return noiseBuffer
  var len = Math.max(1, Math.floor(c.sampleRate * 0.08))
  noiseBuffer = c.createBuffer(1, len, c.sampleRate)
  var data = noiseBuffer.getChannelData(0)
  for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  return noiseBuffer
}

// Short filtered noise burst — used for mechanical ticks/clicks.
function playClick(opts) {
  var c = ensureContext()
  if (!c || !enabled) return
  var t0 = c.currentTime
  var duration = opts.duration || 0.035
  var peak = opts.gain != null ? opts.gain : 0.08

  var src = c.createBufferSource()
  src.buffer = getNoiseBuffer(c)

  var filter = c.createBiquadFilter()
  filter.type = opts.filterType || 'bandpass'
  filter.frequency.value = opts.freq || 1200
  filter.Q.value = opts.q != null ? opts.q : 1.2

  var gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start(t0)
  src.stop(t0 + duration + 0.02)
}

// Short pitched tone with an exponential pitch/level decay — used for the
// duller "thud" when a ball settles into a bin.
function playThud(opts) {
  var c = ensureContext()
  if (!c || !enabled) return
  var t0 = c.currentTime
  var duration = opts.duration || 0.12
  var peak = opts.gain != null ? opts.gain : 0.1

  var osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(opts.freq || 180, t0)
  osc.frequency.exponentialRampToValueAtTime((opts.freq || 180) * 0.55, t0 + duration)

  var gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)

  osc.connect(gain)
  gain.connect(master)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

var lastPegTickAt = 0

// Ball bouncing off a peg mid-fall. `activeCount` throttles/quiets the
// sound so a large batch of simultaneous balls doesn't turn into noise.
export function pegTick(activeCount) {
  var c = ensureContext()
  if (!c || !enabled) return
  var now = c.currentTime
  var minGap = activeCount > 20 ? 0.045 : activeCount > 6 ? 0.025 : 0.012
  if (now - lastPegTickAt < minGap) return
  lastPegTickAt = now

  var crowding = Math.min(1, (activeCount || 1) / 15)
  playClick({
    freq: 1500 + Math.random() * 900,
    q: 2.2,
    duration: 0.03,
    gain: 0.05 * (1 - 0.6 * crowding),
  })
}

// Ball coming to rest in its bin.
export function ballLand() {
  playThud({
    freq: 150 + Math.random() * 40,
    duration: 0.1,
    gain: 0.07,
  })
}

var lastSliderTickAt = 0

// A slider/drag value crossed a discrete step — soft ratchet-like tick.
export function sliderTick() {
  var c = ensureContext()
  if (!c || !enabled) return
  var now = c.currentTime
  if (now - lastSliderTickAt < 0.02) return
  lastSliderTickAt = now
  playClick({
    freq: 2000 + Math.random() * 400,
    q: 3,
    duration: 0.018,
    gain: 0.035,
  })
}

// Button press — a slightly fuller mechanical clack.
export function buttonClick() {
  playClick({
    freq: 950,
    q: 1.4,
    duration: 0.05,
    gain: 0.09,
  })
  playThud({ freq: 320, duration: 0.04, gain: 0.03 })
}
