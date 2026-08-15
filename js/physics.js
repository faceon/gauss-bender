import { W, H, PEG_R, MAX_SPEED } from './constants.js'
import { state } from './state.js'
import { layout, pegX } from './layout.js'
import {
  buildPegProb,
  buildBinBalls,
  computeExpected,
  formatCount,
} from './math.js'
import { pegTick, ballLand as playBallLand } from './audio.js'

var Engine = Matter.Engine
var Composite = Matter.Composite
var Bodies = Matter.Bodies
var Body = Matter.Body
var Events = Matter.Events

export var engine = Engine.create()
export var world = engine.world
world.gravity.y = 1

export var activeBalls = []
export var currentL = null
export var dropTimers = []
var leftWall = null
var rightWall = null

// Soft "tick" whenever a falling ball bounces off a peg. Throttled inside
// pegTick() so a large batch of simultaneous balls stays subtle rather than
// turning into a wall of noise.
Events.on(engine, 'collisionStart', function (event) {
  var pairs = event.pairs
  for (var i = 0; i < pairs.length; i++) {
    var a = pairs[i].bodyA
    var b = pairs[i].bodyB
    if ((a.isBall && b.isPeg) || (a.isPeg && b.isBall)) {
      pegTick(activeBalls.length)
    }
  }
})

export function clearDropTimers() {
  for (var i = 0; i < dropTimers.length; i++) {
    clearTimeout(dropTimers[i])
  }
  dropTimers.length = 0
  state.batchTotal = 0
  state.batchSpawned = 0
}

function formatStatHTML(actualStr, expectedStr) {
  return (
    '<span class="stat-actual">' +
    actualStr +
    '</span> <span class="stat-expected">Exp ' +
    expectedStr +
    '</span>'
  )
}

export function updateStats() {
  var L = currentL
  if (!L) return

  var statN = document.getElementById('stat-n')
  var statQueued = document.getElementById('stat-queued')
  var statMean = document.getElementById('stat-mean')
  var statVar = document.getElementById('stat-var')
  var statStd = document.getElementById('stat-std')

  if (statN) statN.textContent = formatCount(state.total)
  if (statQueued) {
    var queued = state.batchTotal - state.batchSpawned
    statQueued.textContent = '+' + formatCount(queued)
    statQueued.classList.toggle('is-active', queued > 0)
  }
  var expected = computeExpected(L)
  var eMean = 0
  for (var j = 0; j <= L.N; j++) eMean += j * expected[j]
  var eVar = 0
  for (var j2 = 0; j2 <= L.N; j2++)
    eVar += expected[j2] * Math.pow(j2 - eMean, 2)
  var eStd = Math.sqrt(eVar)

  if (state.total > 0) {
    var sum = 0
    for (var i = 0; i <= L.N; i++) sum += i * state.binCounts[i]
    var mean = sum / state.total
    var vsum = 0
    for (var i2 = 0; i2 <= L.N; i2++)
      vsum += state.binCounts[i2] * Math.pow(i2 - mean, 2)
    var variance = vsum / state.total
    var std = Math.sqrt(variance)
    if (statMean)
      statMean.innerHTML = formatStatHTML(mean.toFixed(2), eMean.toFixed(2))
    if (statVar)
      statVar.innerHTML = formatStatHTML(variance.toFixed(2), eVar.toFixed(2))
    if (statStd)
      statStd.innerHTML = formatStatHTML(std.toFixed(2), eStd.toFixed(2))
  } else {
    if (statMean)
      statMean.innerHTML = formatStatHTML('-', eMean.toFixed(2))
    if (statVar)
      statVar.innerHTML = formatStatHTML('-', eVar.toFixed(2))
    if (statStd)
      statStd.innerHTML = formatStatHTML('-', eStd.toFixed(2))
  }
}

export function landBall(bin, path) {
  state.binCounts[bin] += 1
  state.binBalls[bin].push(path.slice())
  state.total += 1
  playBallLand()
  updateStats()
}

export function rebuildBoard(resetSelectionCallback, forceResetPegProb) {
  clearDropTimers()
  Composite.clear(world, false)
  activeBalls.length = 0
  if (
    forceResetPegProb ||
    !state.pegProb ||
    state.pegProb.length !== state.N
  ) {
    state.pegProb = buildPegProb(state.N)
  }
  state.binCounts = new Array(state.N + 1).fill(0)
  state.binBalls = buildBinBalls(state.N)
  state.total = 0
  if (resetSelectionCallback) resetSelectionCallback()

  currentL = layout()
  var L = currentL
  var effectivePegR = Math.max(
    1.0,
    Math.min(PEG_R, Math.min(L.spacing * 0.35, L.rowHeight * 0.35)),
  )
  for (var row = 0; row < L.N; row++) {
    for (var k = 0; k <= row; k++) {
      var x = pegX(L, row, k),
        y = L.topY + row * L.rowHeight
      var body = Bodies.circle(x, y, effectivePegR, {
        isStatic: true,
        restitution: 0.25,
        friction: 0,
      })
      body.isPeg = true
      body.pegRow = row
      body.pegIdx = k
      Composite.add(world, body)
    }
  }
  var wallOpts = { isStatic: true, restitution: 0.15 }
  leftWall = Bodies.rectangle(L.marginX - 12, H / 2, 6, H, wallOpts)
  rightWall = Bodies.rectangle(W - L.marginX + 12, H / 2, 6, H, wallOpts)
  Composite.add(world, [leftWall, rightWall])
  updateStats()
}

// Re-derives peg/wall positions for the current W (which setBoardAspect may
// have just changed on resize) without touching balls or stats. A full
// rebuildBoard() clears the world and zeroes state.binCounts/state.total,
// which would wipe a user's results every time they rotate their phone or
// resize the window — this only moves the static bodies that define the
// board's shape.
export function relayoutBoard() {
  if (!currentL) return
  currentL = layout()
  var L = currentL
  var effectivePegR = Math.max(
    1.0,
    Math.min(PEG_R, Math.min(L.spacing * 0.35, L.rowHeight * 0.35)),
  )
  var pegs = Composite.allBodies(world).filter(function (b) {
    return b.isPeg
  })
  for (var i = 0; i < pegs.length; i++) {
    var body = pegs[i]
    Body.setPosition(body, {
      x: pegX(L, body.pegRow, body.pegIdx),
      y: L.topY + body.pegRow * L.rowHeight,
    })
    Body.scale(
      body,
      effectivePegR / body.circleRadius,
      effectivePegR / body.circleRadius,
    )
  }
  if (leftWall) Body.setPosition(leftWall, { x: L.marginX - 12, y: H / 2 })
  if (rightWall) Body.setPosition(rightWall, { x: W - L.marginX + 12, y: H / 2 })
}

export function getBallRadii(L) {
  if (!L) return { physicsR: 6, visualR: 6 }
  var effectivePegR = Math.max(
    1.0,
    Math.min(PEG_R, Math.min(L.spacing * 0.35, L.rowHeight * 0.35)),
  )
  var gap = Math.min(L.spacing, L.rowHeight) - 2 * effectivePegR
  // Collision radius: sized narrowly to pass freely between pins without jamming
  var physicsR = Math.max(0.6, Math.min(3.0, gap * 0.35))
  // Visual rendering radius: maintain minimum 3.2px~6.0px for clear visibility even when N increases to 50
  var visualR = Math.max(3.2, Math.min(6.0, (L.spacing - 0.5) * 0.45))
  return { physicsR: physicsR, visualR: visualR }
}

export function dropOne() {
  var L = currentL
  if (!L) return
  var radii = getBallRadii(L)
  var x = L.centerX + (Math.random() - 0.5) * Math.min(4, L.spacing * 0.3)
  var y = L.topY - L.rowHeight * 0.6
  var ball = Bodies.circle(x, y, radii.physicsR, {
    restitution: 0.15,
    friction: 0,
    frictionAir: 0.004,
  })
  ball.isBall = true
  ball.r = radii.visualR
  ball.physicsR = radii.physicsR
  ball.path = []
  ball.nextRow = 0
  Composite.add(world, ball)
  activeBalls.push(ball)
}

export function dropPhysics(n) {
  var offset = state.batchTotal - state.batchSpawned
  state.batchTotal += n
  updateStats()
  for (var i = 0; i < n; i++) {
    var t = setTimeout(function () {
      dropOne()
      state.batchSpawned += 1
      updateStats()
    }, (offset + i) * 160)
    dropTimers.push(t)
  }
}

export function clampSpeed(ball) {
  var v = ball.velocity
  var speed = Math.hypot(v.x, v.y)
  if (speed > MAX_SPEED) {
    var scale = MAX_SPEED / speed
    Body.setVelocity(ball, { x: v.x * scale, y: v.y * scale })
  }
}
