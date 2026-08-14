import { W, H, COLOR_L, COLOR_R } from './constants.js'
import { state } from './state.js'
import { pegX, binX, getTargetStackY } from './layout.js'
import {
  countRights,
  buildBinBalls,
  parseProbInput,
  formatProb,
} from './math.js'
import {
  engine,
  world,
  activeBalls,
  currentL,
  rebuildBoard,
  updateStats,
  landBall,
  dropPhysics,
  clampSpeed,
  clearDropTimers,
} from './physics.js'
import { draw, landedBallScreens } from './renderer.js'

var Composite = Matter.Composite
var Engine = Matter.Engine
var Body = Matter.Body

var canvas = document.getElementById('board')
var ctx = canvas.getContext('2d')

// Keep the canvas backing store matched to its actual rendered CSS size and
// the display's device pixel ratio, so drawing stays crisp across window
// resizes and across screens with different DPRs. Drawing code still works
// in the fixed W x H logical coordinate space; ctx.setTransform maps that
// onto the physical pixel grid.
//
// The CSS box size is computed from the parent wrapper (not the canvas's
// own getBoundingClientRect) and applied via canvas.style.width/height.
// Deriving it from the canvas itself would be circular: an auto-sized
// canvas's layout box depends on its intrinsic width/height attributes,
// which is exactly what this function also writes.
var canvasWrapper = canvas.parentElement
var aspect = W / H

function resizeCanvas() {
  var wrapRect = canvasWrapper.getBoundingClientRect()
  if (wrapRect.width === 0 || wrapRect.height === 0) return
  var cssW = wrapRect.width
  var cssH = cssW / aspect
  if (cssH > wrapRect.height) {
    cssH = wrapRect.height
    cssW = cssH * aspect
  }
  cssW = Math.max(1, Math.round(cssW))
  cssH = Math.max(1, Math.round(cssH))
  canvas.style.width = cssW + 'px'
  canvas.style.height = cssH + 'px'

  var dpr = window.devicePixelRatio || 1
  var pixelW = Math.round(cssW * dpr)
  var pixelH = Math.round(cssH * dpr)
  if (canvas.width === pixelW && canvas.height === pixelH) return
  canvas.width = pixelW
  canvas.height = pixelH
  ctx.setTransform(pixelW / W, 0, 0, pixelH / H, 0, 0)
}

resizeCanvas()

if (window.ResizeObserver) {
  new ResizeObserver(resizeCanvas).observe(canvasWrapper)
} else {
  window.addEventListener('resize', resizeCanvas)
}

// ResizeObserver doesn't fire when the box size is unchanged but the
// display's device pixel ratio changes (e.g. dragging the window to a
// monitor with a different DPR), so watch that separately.
function watchDevicePixelRatio() {
  var dpr = window.devicePixelRatio || 1
  var mql = window.matchMedia('(resolution: ' + dpr + 'dppx)')
  mql.addEventListener(
    'change',
    function () {
      resizeCanvas()
      watchDevicePixelRatio()
    },
    { once: true },
  )
}
watchDevicePixelRatio()

var selectedPegs = []
var hoveredPeg = null
var dragState = null
var currentHover = null
var selectionBox = null
var isShiftPressed = false

var rotateLabel = document.getElementById('rotate-label')
var bulkRotateInput = document.getElementById('bulk-rotate')
var bulkRotateOut = document.getElementById('bulk-rotate-out')

var tooltip = document.getElementById('ball-tooltip')
var tooltipLabel = document.getElementById('tooltip-label')
var tooltipPath = document.getElementById('tooltip-path')

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none'
}

function showTooltip(hit) {
  var container = canvas.parentElement
  var rect = canvas.getBoundingClientRect()
  var parentRect = container.getBoundingClientRect()
  var scaleX = rect.width / W,
    scaleY = rect.height / H
  var left = rect.left - parentRect.left + hit.x * scaleX
  var top = rect.top - parentRect.top + hit.y * scaleY
  tooltip.style.left = left + 'px'
  tooltip.style.top = top + 'px'
  tooltipLabel.textContent =
    'Bin ' + hit.bin + ' \u00b7 ' + hit.path.length + ' steps'
  var html = ''
  for (var i = 0; i < hit.path.length; i++) {
    var ch = hit.path[i]
    var color = ch === 'L' ? COLOR_L : COLOR_R
    html += '<span style="color:' + color + '">' + ch + '</span>'
  }
  tooltipPath.innerHTML = html
  tooltip.style.display = 'block'
}

function isPegSelected(row, idx) {
  for (var i = 0; i < selectedPegs.length; i++) {
    if (selectedPegs[i].row === row && selectedPegs[i].idx === idx) return true
  }
  return false
}

function addPegToSelection(peg) {
  if (!isPegSelected(peg.row, peg.idx)) {
    selectedPegs.push({ row: peg.row, idx: peg.idx })
  }
}

function removePegFromSelection(row, idx) {
  for (var i = 0; i < selectedPegs.length; i++) {
    if (selectedPegs[i].row === row && selectedPegs[i].idx === idx) {
      selectedPegs.splice(i, 1)
      return
    }
  }
}

function togglePegSelection(peg) {
  if (isPegSelected(peg.row, peg.idx)) {
    removePegFromSelection(peg.row, peg.idx)
  } else {
    addPegToSelection(peg)
  }
}

function clearSelection() {
  selectedPegs = []
}

function updateRotateUI() {
  var L = currentL
  if (!L) return

  var isEditingInput = document.activeElement === bulkRotateOut
  if (rotateLabel) rotateLabel.textContent = 'P(left)'

  if (selectedPegs.length === 0) {
    var totalSum = 0,
      totalCount = 0
    for (var r = 0; r < state.N; r++) {
      for (var k = 0; k <= r; k++) {
        totalSum += state.pegProb[r][k]
        totalCount++
      }
    }
    var avgProb = totalCount > 0 ? totalSum / totalCount : 0.5
    if (bulkRotateInput) bulkRotateInput.value = avgProb
    if (bulkRotateOut && !isEditingInput)
      bulkRotateOut.value = formatProb(avgProb)
  } else {
    var selSum = 0
    for (var i = 0; i < selectedPegs.length; i++) {
      var p = selectedPegs[i]
      selSum += state.pegProb[p.row][p.idx]
    }
    var selAvgProb = selSum / selectedPegs.length
    if (bulkRotateInput) bulkRotateInput.value = selAvgProb
    if (bulkRotateOut && !isEditingInput)
      bulkRotateOut.value = formatProb(selAvgProb)
  }
}

function resetSelection() {
  clearSelection()
  hoveredPeg = null
  currentHover = null
  selectionBox = null
  hideTooltip()
  updateRotateUI()
}

function getCanvasCoords(clientX, clientY) {
  var rect = canvas.getBoundingClientRect()
  var scaleX = W / rect.width,
    scaleY = H / rect.height
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
}

function findNearestPeg(cx, cy) {
  var L = currentL
  if (!L) return null
  var best = null,
    bestDist = 14
  for (var row = 0; row < L.N; row++) {
    for (var k = 0; k <= row; k++) {
      var x = pegX(L, row, k),
        y = L.topY + row * L.rowHeight
      var d = Math.hypot(cx - x, cy - y)
      if (d < bestDist) {
        bestDist = d
        best = { row: row, idx: k }
      }
    }
  }
  return best
}

function getPegsInRect(x1, y1, x2, y2) {
  var L = currentL
  if (!L) return []
  var minX = Math.min(x1, x2)
  var maxX = Math.max(x1, x2)
  var minY = Math.min(y1, y2)
  var maxY = Math.max(y1, y2)

  var result = []
  for (var row = 0; row < L.N; row++) {
    for (var k = 0; k <= row; k++) {
      var px = pegX(L, row, k)
      var py = L.topY + row * L.rowHeight
      if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
        result.push({ row: row, idx: k })
      }
    }
  }
  return result
}

function startDrag(clientX, clientY, isShift) {
  var c = getCanvasCoords(clientX, clientY)
  var peg = findNearestPeg(c.x, c.y)

  if (peg) {
    if (isShift) {
      togglePegSelection(peg)
    } else {
      if (!isPegSelected(peg.row, peg.idx)) {
        selectedPegs = [peg]
      }
    }
    hoveredPeg = { row: peg.row, idx: peg.idx }
    var initialProbs = {}
    for (var i = 0; i < selectedPegs.length; i++) {
      var sp = selectedPegs[i]
      initialProbs[sp.row + '_' + sp.idx] = state.pegProb[sp.row][sp.idx]
    }
    dragState = {
      isBox: false,
      row: peg.row,
      idx: peg.idx,
      startX: c.x,
      startProb: state.pegProb[peg.row][peg.idx],
      initialProbs: initialProbs,
      selectedPegs: selectedPegs.slice(),
    }
  } else {
    hoveredPeg = null
    dragState = {
      isBox: true,
      startX: c.x,
      startY: c.y,
      isShift: isShift,
      initialSelection: selectedPegs.slice(),
    }
    selectionBox = { x1: c.x, y1: c.y, x2: c.x, y2: c.y }
  }
  updateRotateUI()
}

function moveDrag(clientX, clientY) {
  if (!dragState) return
  var c = getCanvasCoords(clientX, clientY)

  if (dragState.isBox) {
    selectionBox = {
      x1: dragState.startX,
      y1: dragState.startY,
      x2: c.x,
      y2: c.y,
    }
    var rectPegs = getPegsInRect(
      selectionBox.x1,
      selectionBox.y1,
      selectionBox.x2,
      selectionBox.y2,
    )

    if (dragState.isShift) {
      selectedPegs = dragState.initialSelection.slice()
      for (var i = 0; i < rectPegs.length; i++) {
        addPegToSelection(rectPegs[i])
      }
    } else {
      selectedPegs = rectPegs
    }
    updateRotateUI()
  } else {
    hoveredPeg = { row: dragState.row, idx: dragState.idx }
    var deltaX = c.x - dragState.startX
    var dragRange = 90
    var deltaProb = deltaX / dragRange

    if (dragState.selectedPegs && dragState.selectedPegs.length > 0) {
      for (var j = 0; j < dragState.selectedPegs.length; j++) {
        var pegItem = dragState.selectedPegs[j]
        var key = pegItem.row + '_' + pegItem.idx
        var baseP =
          dragState.initialProbs[key] !== undefined
            ? dragState.initialProbs[key]
            : 0.5
        var newP = Math.max(0, Math.min(1, baseP + deltaProb))
        state.pegProb[pegItem.row][pegItem.idx] = newP
      }
    } else {
      var newProb = Math.max(0, Math.min(1, dragState.startProb + deltaProb))
      state.pegProb[dragState.row][dragState.idx] = newProb
    }
    updateStats()
    updateRotateUI()
  }
}

function endDrag(clientX, clientY) {
  if (dragState && dragState.isBox) {
    var dx = Math.abs(selectionBox.x2 - selectionBox.x1)
    var dy = Math.abs(selectionBox.y2 - selectionBox.y1)
    if (dx < 4 && dy < 4 && !dragState.isShift) {
      clearSelection()
    }
  }
  if (clientX !== undefined && clientY !== undefined) {
    var c = getCanvasCoords(clientX, clientY)
    hoveredPeg = findNearestPeg(c.x, c.y)
  }
  dragState = null
  selectionBox = null
  updateRotateUI()
}

window.addEventListener('keydown', function (e) {
  if (e.key === 'Shift') {
    isShiftPressed = true
  }
  if (e.key === 'Escape') {
    clearSelection()
    updateRotateUI()
  }
})

window.addEventListener('keyup', function (e) {
  if (e.key === 'Shift') {
    isShiftPressed = false
  }
})

// Event Listeners
var nSliderEl = document.getElementById('n-slider')
var nOutEl = document.getElementById('n-out')

function setNRows(val) {
  var num = parseInt(val, 10)
  if (isNaN(num)) return
  num = Math.max(1, Math.min(50, num))
  if (nSliderEl && parseInt(nSliderEl.value, 10) !== num) nSliderEl.value = num
  if (nOutEl && parseInt(nOutEl.value, 10) !== num) nOutEl.value = num
  if (num === state.N) return
  state.N = num
  rebuildBoard(resetSelection, true)
}

if (nSliderEl) {
  nSliderEl.addEventListener('input', function (e) {
    setNRows(e.target.value)
  })
}

if (nOutEl) {
  nOutEl.addEventListener('change', function (e) {
    setNRows(e.target.value)
  })
  nOutEl.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') {
      setNRows(e.target.value)
      e.target.blur()
    }
  })
}

function applyPegRotation(val, updateText) {
  var prob = parseProbInput(val)
  if (prob === null) return

  if (bulkRotateInput) bulkRotateInput.value = prob
  if (updateText && bulkRotateOut) bulkRotateOut.value = formatProb(prob)

  if (selectedPegs.length > 0) {
    for (var i = 0; i < selectedPegs.length; i++) {
      var p = selectedPegs[i]
      state.pegProb[p.row][p.idx] = prob
    }
  } else {
    for (var row = 0; row < state.N; row++) {
      for (var k = 0; k <= row; k++) {
        state.pegProb[row][k] = prob
      }
    }
  }
  updateStats()
}

var isSliderActive = false

if (bulkRotateInput) {
  bulkRotateInput.addEventListener('mousedown', function () {
    isSliderActive = true
    if (selectedPegs.length > 0) hoveredPeg = selectedPegs[0]
  })
  bulkRotateInput.addEventListener(
    'touchstart',
    function () {
      isSliderActive = true
      if (selectedPegs.length > 0) hoveredPeg = selectedPegs[0]
    },
    { passive: true },
  )
  bulkRotateInput.addEventListener('input', function (e) {
    isSliderActive = true
    applyPegRotation(e.target.value, true)
    if (selectedPegs.length > 0) hoveredPeg = selectedPegs[0]
  })
  bulkRotateInput.addEventListener('change', function () {
    isSliderActive = false
  })
}

if (bulkRotateOut) {
  bulkRotateOut.addEventListener('focus', function () {
    isSliderActive = true
    if (selectedPegs.length > 0) hoveredPeg = selectedPegs[0]
  })
  bulkRotateOut.addEventListener('input', function () {
    isSliderActive = true
  })
  bulkRotateOut.addEventListener('blur', function () {
    isSliderActive = false
  })
  bulkRotateOut.addEventListener('change', function (e) {
    applyPegRotation(e.target.value, true)
    isSliderActive = false
  })
  bulkRotateOut.addEventListener('keyup', function (e) {
    if (e.key === 'Enter') {
      applyPegRotation(e.target.value, true)
      e.target.blur()
      isSliderActive = false
    }
  })
}

document
  .getElementById('theory-toggle')
  .addEventListener('change', function (e) {
    state.showTheory = e.target.checked
  })

var settingsToggle = document.getElementById('settings-toggle')
var settingsPopover = document.getElementById('settings-popover')

function closeSettingsPopover() {
  if (settingsPopover) settingsPopover.classList.remove('is-open')
  if (settingsToggle) settingsToggle.setAttribute('aria-expanded', 'false')
}

function toggleSettingsPopover() {
  if (!settingsPopover) return
  var isOpen = settingsPopover.classList.toggle('is-open')
  if (settingsToggle)
    settingsToggle.setAttribute('aria-expanded', String(isOpen))
}

if (settingsToggle) {
  settingsToggle.addEventListener('click', function (e) {
    e.stopPropagation()
    toggleSettingsPopover()
  })
}

document.addEventListener('click', function (e) {
  if (
    settingsPopover &&
    settingsPopover.classList.contains('is-open') &&
    !settingsPopover.contains(e.target) &&
    e.target !== settingsToggle
  ) {
    closeSettingsPopover()
  }
})

document.getElementById('reset-results').addEventListener('click', function () {
  clearDropTimers()
  for (var i = activeBalls.length - 1; i >= 0; i--)
    Composite.remove(world, activeBalls[i])
  activeBalls.length = 0
  state.binCounts = new Array(state.N + 1).fill(0)
  state.binBalls = buildBinBalls(state.N)
  state.total = 0
  currentHover = null
  hoveredPeg = null
  hideTooltip()
  updateStats()
})

document.getElementById('reset-pegs').addEventListener('click', function () {
  applyPegRotation(0.5, true)
  updateRotateUI()
})

var dropCustomBtn = document.getElementById('drop-custom')
if (dropCustomBtn) {
  dropCustomBtn.addEventListener('click', function () {
    var input = document.getElementById('custom-drop-count')
    var val = input ? parseInt(input.value, 10) : 50
    var count = isNaN(val) || val < 1 ? 1 : val
    dropPhysics(count)
  })
}

// Drop-count spinner: single click steps by 1; press-and-hold repeats with
// acceleration (bigger steps, shorter delay the longer it's held) so
// reaching large counts doesn't take dozens of individual clicks.
var dropCountInput = document.getElementById('custom-drop-count')
var dropCountUpBtn = document.getElementById('drop-count-up')
var dropCountDownBtn = document.getElementById('drop-count-down')
var dropSpinTimer = null

function stepDropCount(delta) {
  if (!dropCountInput) return
  var min = parseInt(dropCountInput.min, 10)
  if (isNaN(min)) min = 1
  var max = parseInt(dropCountInput.max, 10)
  if (isNaN(max)) max = 1000
  var current = parseInt(dropCountInput.value, 10)
  if (isNaN(current)) current = min
  var next = Math.max(min, Math.min(max, current + delta))
  if (next !== current) dropCountInput.value = next
}

function stopDropCountSpin() {
  if (dropSpinTimer) {
    clearTimeout(dropSpinTimer)
    dropSpinTimer = null
  }
}

function startDropCountSpin(direction) {
  stopDropCountSpin()
  stepDropCount(direction)
  var holdTicks = 0
  var tick = function () {
    holdTicks += 1
    var step =
      holdTicks < 6 ? 1 : holdTicks < 16 ? 5 : holdTicks < 30 ? 10 : 25
    var delay = Math.max(35, 200 - holdTicks * 6)
    stepDropCount(direction * step)
    dropSpinTimer = setTimeout(tick, delay)
  }
  dropSpinTimer = setTimeout(tick, 400)
}

if (dropCountUpBtn) {
  dropCountUpBtn.addEventListener('mousedown', function () {
    startDropCountSpin(1)
  })
  dropCountUpBtn.addEventListener(
    'touchstart',
    function (e) {
      e.preventDefault()
      startDropCountSpin(1)
    },
    { passive: false },
  )
}
if (dropCountDownBtn) {
  dropCountDownBtn.addEventListener('mousedown', function () {
    startDropCountSpin(-1)
  })
  dropCountDownBtn.addEventListener(
    'touchstart',
    function (e) {
      e.preventDefault()
      startDropCountSpin(-1)
    },
    { passive: false },
  )
}
window.addEventListener('mouseup', stopDropCountSpin)
window.addEventListener('touchend', stopDropCountSpin)
window.addEventListener('touchcancel', stopDropCountSpin)
window.addEventListener('blur', stopDropCountSpin)

// Prevent HUD interactions from triggering canvas drag / box-select
document.querySelectorAll('.hud-overlay, .arcade-deck').forEach(function (el) {
  ;['mousedown', 'touchstart', 'pointerdown'].forEach(function (evt) {
    el.addEventListener(evt, function (e) {
      e.stopPropagation()
    })
  })
})

canvas.addEventListener('mousedown', function (e) {
  startDrag(e.clientX, e.clientY, e.shiftKey || isShiftPressed)
})
window.addEventListener('mousemove', function (e) {
  moveDrag(e.clientX, e.clientY)
})
window.addEventListener('mouseup', function (e) {
  endDrag(e.clientX, e.clientY)
  if (document.activeElement !== bulkRotateOut) {
    isSliderActive = false
  }
})

canvas.addEventListener(
  'touchstart',
  function (e) {
    if (e.touches.length > 0) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY, false)
    }
    e.preventDefault()
  },
  { passive: false },
)

canvas.addEventListener(
  'touchmove',
  function (e) {
    if (e.touches.length > 0) {
      moveDrag(e.touches[0].clientX, e.touches[0].clientY)
    }
    e.preventDefault()
  },
  { passive: false },
)

window.addEventListener('touchend', function () {
  endDrag()
  if (document.activeElement !== bulkRotateOut) {
    isSliderActive = false
  }
})

canvas.addEventListener('mousemove', function (e) {
  if (dragState) {
    hideTooltip()
    currentHover = null
    if (!dragState.isBox) {
      hoveredPeg = { row: dragState.row, idx: dragState.idx }
    } else {
      hoveredPeg = null
    }
    return
  }
  var c = getCanvasCoords(e.clientX, e.clientY)
  var hit = null,
    bestDist = 999
  for (var i = 0; i < landedBallScreens.length; i++) {
    var lb = landedBallScreens[i]
    var d = Math.hypot(c.x - lb.x, c.y - lb.y)
    var hoverR = Math.max(lb.r, 7)
    if (d < hoverR && d < bestDist) {
      hit = lb
      bestDist = d
    }
  }
  if (hit) {
    currentHover = { bin: hit.bin, idx: hit.idx }
    showTooltip(hit)
    hoveredPeg = null
  } else {
    currentHover = null
    hideTooltip()
    hoveredPeg = findNearestPeg(c.x, c.y)
  }
})

canvas.addEventListener('mouseleave', function () {
  currentHover = null
  hideTooltip()
  hoveredPeg = null
})

// Initialization
rebuildBoard(resetSelection)

function loop() {
  var L = currentL
  if (L && activeBalls.length > 0) {
    for (var c = 0; c < activeBalls.length; c++) clampSpeed(activeBalls[c])
    Engine.update(engine, 16.666)
    for (var f = 0; f < activeBalls.length; f++) {
      var fb = activeBalls[f]
      while (
        fb.nextRow < L.N &&
        fb.position.y >= L.topY + fb.nextRow * L.rowHeight
      ) {
        var row = fb.nextRow
        var k = countRights(fb.path)
        var pL = state.pegProb[row][k]
        var goLeft = Math.random() < pL
        fb.path.push(goLeft ? 'L' : 'R')

        var nextK = k + (goLeft ? 0 : 1)
        var nextTargetX =
          row + 1 === L.N ? binX(L, nextK) : pegX(L, row + 1, nextK)
        var targetY =
          row + 1 === L.N ? L.landY : L.topY + (row + 1) * L.rowHeight
        var deltaY = Math.max(1, targetY - fb.position.y)
        var deltaX = nextTargetX - fb.position.x

        var g = engine.world.gravity.y
        var vy0 = 0
        var t = Math.sqrt(2 * g * deltaY) / g
        var vx = deltaX / Math.max(1, t)

        Body.setVelocity(fb, { x: vx, y: vy0 })
        fb.nextRow += 1
      }
    }
  }
  if (L) {
    for (var i = activeBalls.length - 1; i >= 0; i--) {
      var b = activeBalls[i]
      var bin = countRights(b.path)
      var targetStackY = getTargetStackY(L, bin)
      if (b.position.y >= targetStackY - 4) {
        landBall(bin, b.path)
        Composite.remove(world, b)
        activeBalls.splice(i, 1)
      } else if (b.position.y >= L.landY) {
        var bx = binX(L, bin)
        var deltaX = bx - b.position.x
        var deltaY = Math.max(1, targetStackY - b.position.y)
        var g = engine.world.gravity.y
        var t = Math.sqrt(2 * g * deltaY) / g
        var vx = deltaX / Math.max(1, t)
        var vy = Math.max(b.velocity.y, 2.0)
        Body.setVelocity(b, { x: vx, y: vy })
      }
    }
  }
  draw(
    ctx,
    selectedPegs,
    hoveredPeg,
    currentHover,
    selectionBox,
    isShiftPressed,
    hideTooltip,
    isSliderActive,
  )
  requestAnimationFrame(loop)
}

requestAnimationFrame(loop)
