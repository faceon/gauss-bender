import {
  W,
  H,
  PEG_R,
  COLOR_PEG,
  COLOR_LEFT_BIAS,
  COLOR_RIGHT_BIAS,
  COLOR_THEORY,
  COLOR_SELECTED,
  COLOR_HOVER_PEG,
  COLOR_L,
  COLOR_R,
} from './constants.js'
import { state } from './state.js'
import { pegX, binX } from './layout.js'
import { computeExpected, ballPassesThroughPeg } from './math.js'
import { currentL, activeBalls } from './physics.js'

export var landedBallScreens = []

export function getDeflectorColor(pLeft) {
  var p = Math.max(0, Math.min(1, pLeft == null ? 0.5 : pLeft))
  if (p < 0.5) {
    // Interpolate from Blue #3b82f6 (59, 130, 246) at p=0 to White #ffffff (255, 255, 255) at p=0.5
    var t = p / 0.5
    var r = Math.round(59 + (255 - 59) * t)
    var g = Math.round(130 + (255 - 130) * t)
    var b = Math.round(246 + (255 - 246) * t)
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  } else if (p > 0.5) {
    // Interpolate from White #ffffff (255, 255, 255) at p=0.5 to Red #ef4444 (239, 68, 68) at p=1.0
    var t = (p - 0.5) / 0.5
    var r = Math.round(255 + (239 - 255) * t)
    var g = Math.round(255 + (68 - 255) * t)
    var b = Math.round(255 + (68 - 255) * t)
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  }
  return '#FFFFFF'
}

export function getNormalLineColor(pLeft) {
  var p = Math.max(0, Math.min(1, pLeft == null ? 0.5 : pLeft))
  if (p < 0.5) {
    // Interpolate from Blue #2563EB (37, 99, 235) at p=0 to Slate Gray #94A3B8 (148, 163, 184) at p=0.5
    var t = p / 0.5
    var r = Math.round(37 + (148 - 37) * t)
    var g = Math.round(99 + (163 - 99) * t)
    var b = Math.round(235 + (184 - 235) * t)
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  } else if (p > 0.5) {
    // Interpolate from Slate Gray #94A3B8 (148, 163, 184) at p=0.5 to Red #DC2626 (220, 38, 38) at p=1.0
    var t = (p - 0.5) / 0.5
    var r = Math.round(148 + (220 - 148) * t)
    var g = Math.round(163 + (38 - 163) * t)
    var b = Math.round(184 + (38 - 184) * t)
    return 'rgb(' + r + ',' + g + ',' + b + ')'
  }
  return '#94A3B8'
}

export function drawPeg(
  ctx,
  x,
  y,
  pLeft,
  isSelected,
  isHovered,
  isShiftHover,
  customR,
) {
  var r = customR || PEG_R
  var baseR = r * 1.35
  var bias = pLeft - 0.5
  var maxAngle = (48 * Math.PI) / 180
  var angle = bias * 2 * maxAngle

  // 1. Hover background aura (clearly visible on hover and drag)
  var ringPadding = Math.max(2.5, baseR * 0.38)
  if (isShiftHover) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(x, y, baseR + ringPadding, Math.PI, 0, false)
    ctx.closePath()
    ctx.fillStyle = 'rgba(40, 167, 69, 0.18)'
    ctx.fill()
    ctx.strokeStyle = '#28a745'
    ctx.lineWidth = Math.max(1.5, baseR * 0.25)
    ctx.setLineDash([3, 2.5])
    ctx.stroke()
    ctx.restore()
  } else if (isHovered) {
    ctx.save()
    // Dynamic color dashed normal line opposite (180 deg) to Deflector below Base (implies ball drop direction)
    // Deflector direction vector: (sin(angle), -cos(angle))
    // 180-deg opposite vector (below Base): (-sin(angle), +cos(angle))
    var dirX = -Math.sin(angle)
    var dirY = Math.cos(angle)

    // Maintain constant fixed length during manipulation
    var lineLen = Math.max(14.0, baseR * 2.4)
    var p1X = x
    var p1Y = y
    var p2X = x + dirX * lineLen
    var p2Y = y + dirY * lineLen

    // Render trajectory guide with dashed line (clean dashed line without arrowhead)
    ctx.beginPath()
    ctx.moveTo(p1X, p1Y)
    ctx.lineTo(p2X, p2Y)
    ctx.strokeStyle = getNormalLineColor(pLeft)
    ctx.lineWidth = Math.max(2.0, baseR * 0.3)
    ctx.setLineDash([4, 3])
    ctx.lineCap = 'round'
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // 2. Fixed Semicircle Base (Dome) - default: gray / selected: blue
  ctx.save()
  var baseGrad = ctx.createLinearGradient(0, y - baseR, 0, y)
  if (isSelected) {
    // When selected: deeper and vivid royal blue (Deep Blue)
    baseGrad.addColorStop(0, '#2B6CB0') // Rich deep blue
    baseGrad.addColorStop(1, '#1A365D') // Navy deep blue
    ctx.strokeStyle = '#0F223D'
  } else {
    // Default state: gray (Gray)
    baseGrad.addColorStop(0, '#94A3B8')
    baseGrad.addColorStop(1, '#64748B')
    ctx.strokeStyle = '#475569'
  }

  ctx.beginPath()
  ctx.arc(x, y, baseR, Math.PI, 0, false)
  ctx.closePath()
  ctx.fillStyle = baseGrad
  ctx.fill()
  ctx.lineWidth = Math.max(0.8, baseR * 0.1)
  ctx.stroke()

  // Base inner subtle 3D highlight curve
  if (baseR > 3) {
    ctx.beginPath()
    ctx.arc(x, y, baseR * 0.85, Math.PI * 1.05, Math.PI * 1.95, false)
    ctx.strokeStyle = isSelected
      ? 'rgba(255, 255, 255, 0.55)'
      : 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = Math.max(0.6, baseR * 0.08)
    ctx.stroke()
  }
  ctx.restore()

  // 3. Top Movable Small Semicircle (Deflector / Indicator) - high contrast clean graphics
  var topR = baseR * 0.56
  var topCenterX = x + baseR * Math.sin(angle)
  var topCenterY = y - baseR * Math.cos(angle)

  ctx.save()
  ctx.translate(topCenterX, topCenterY)
  ctx.rotate(angle)

  // Clean drop shadow
  ctx.beginPath()
  ctx.arc(0, 0.5, topR, Math.PI, 0, false)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
  ctx.fill()

  // Fill with color corresponding to pLeft (Blue - White - Red)
  ctx.beginPath()
  ctx.arc(0, 0, topR, Math.PI, 0, false)
  ctx.closePath()
  ctx.fillStyle = getDeflectorColor(pLeft)
  ctx.fill()
  ctx.strokeStyle = '#1E293B'
  ctx.lineWidth = Math.max(1.0, topR * 0.18)
  ctx.stroke()
  ctx.restore()

  // 4. Shift+Hover '+' Badge
  if (isShiftHover) {
    ctx.save()
    var badgeR = Math.max(5, baseR * 0.8)
    var badgeX = x + baseR * 1.3
    var badgeY = y - baseR * 1.3
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2)
    ctx.fillStyle = '#28a745'
    ctx.fill()
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.2
    ctx.stroke()

    var offset = badgeR * 0.45
    ctx.beginPath()
    ctx.moveTo(badgeX - offset, badgeY)
    ctx.lineTo(badgeX + offset, badgeY)
    ctx.moveTo(badgeX, badgeY - offset)
    ctx.lineTo(badgeX, badgeY + offset)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.restore()
  }
}

export function drawSteelBall(ctx, x, y, r, rY) {
  var ry = rY !== undefined && rY > 0 ? rY : r
  var scaleY = ry / r
  ctx.save()
  if (scaleY !== 1) {
    ctx.translate(x, y)
    ctx.scale(1, scaleY)
    ctx.translate(-x, -y)
  }
  var grad = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.4,
    r * 0.05,
    x,
    y,
    r * 1.15,
  )
  grad.addColorStop(0, '#f7f7f7')
  grad.addColorStop(0.35, '#cfcfcf')
  grad.addColorStop(0.7, '#93938f')
  grad.addColorStop(1, '#57564f')
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()
  if (r > 1.8) {
    ctx.lineWidth = Math.max(0.5, r * 0.08)
    ctx.strokeStyle = '#3a3a37'
    ctx.stroke()
  }
  ctx.restore()
}

export function drawGlow(ctx, x, y, r) {
  ctx.save()
  var glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4)
  glow.addColorStop(0, 'rgba(255,209,64,0.65)')
  glow.addColorStop(0.5, 'rgba(255,209,64,0.25)')
  glow.addColorStop(1, 'rgba(255,209,64,0)')
  ctx.beginPath()
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
  ctx.fillStyle = glow
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.fill()
  ctx.restore()
}

export function drawHoverPath(ctx, L, hit) {
  var points = [{ x: L.centerX, y: L.topY - L.rowHeight * 0.6 }]
  var k = 0
  for (var row = 0; row < hit.path.length; row++) {
    points.push({ x: pegX(L, row, k), y: L.topY + row * L.rowHeight })
    if (hit.path[row] === 'R') k += 1
  }
  points.push({ x: hit.x, y: hit.y })
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 2
  for (var s = 0; s < points.length - 1; s++) {
    var color =
      s === 0 ? '#888780' : hit.path[s - 1] === 'L' ? COLOR_L : COLOR_R
    ctx.beginPath()
    ctx.moveTo(points[s].x, points[s].y)
    ctx.lineTo(points[s + 1].x, points[s + 1].y)
    ctx.strokeStyle = color
    ctx.stroke()
  }
  ctx.restore()
}

export function getMonotoneCubicControlPoints(pts, maxY) {
  var n = pts.length
  if (n < 2) return []

  var dxs = []
  var deltas = []
  for (var i = 0; i < n - 1; i++) {
    var dx = pts[i + 1].x - pts[i].x
    var dy = pts[i + 1].y - pts[i].y
    dxs.push(dx)
    deltas.push(dy / dx)
  }

  var d = new Array(n)
  d[0] = deltas[0]
  d[n - 1] = deltas[n - 2]

  for (var i = 1; i < n - 1; i++) {
    if (deltas[i - 1] * deltas[i] <= 0) {
      d[i] = 0
    } else {
      var w1 = 2 * dxs[i] + dxs[i - 1]
      var w2 = dxs[i] + 2 * dxs[i - 1]
      d[i] = (w1 + w2) / (w1 / deltas[i - 1] + w2 / deltas[i])
    }
  }

  if (deltas[0] === 0) d[0] = 0
  if (deltas[n - 2] === 0) d[n - 1] = 0

  var ctrl = []
  for (var k = 0; k < n - 1; k++) {
    var h = dxs[k]
    var cp1x = pts[k].x + h / 3
    var cp1y = pts[k].y + (d[k] * h) / 3
    var cp2x = pts[k + 1].x - h / 3
    var cp2y = pts[k + 1].y - (d[k + 1] * h) / 3

    if (maxY !== undefined) {
      cp1y = Math.min(maxY, cp1y)
      cp2y = Math.min(maxY, cp2y)
    }

    ctrl.push({ cp1x: cp1x, cp1y: cp1y, cp2x: cp2x, cp2y: cp2y })
  }
  return ctrl
}

export function draw(
  ctx,
  selectedPegs,
  hoveredPeg,
  currentHover,
  selectionBox,
  isShiftPressed,
  hideTooltipCallback,
  isSliderActive,
) {
  ctx.clearRect(0, 0, W, H)
  var L = currentL
  if (!L) return

  var hasSelection = Array.isArray(selectedPegs) && selectedPegs.length > 0
  var effectivePegR = Math.max(
    1.0,
    Math.min(PEG_R, Math.min(L.spacing * 0.35, L.rowHeight * 0.35)),
  )

  var isHoveringSelectedGroup = false
  if (hasSelection && hoveredPeg) {
    for (var hsp = 0; hsp < selectedPegs.length; hsp++) {
      if (
        selectedPegs[hsp].row === hoveredPeg.row &&
        selectedPegs[hsp].idx === hoveredPeg.idx
      ) {
        isHoveringSelectedGroup = true
        break
      }
    }
  }

  var boxMinX = 0,
    boxMaxX = 0,
    boxMinY = 0,
    boxMaxY = 0
  if (selectionBox) {
    boxMinX = Math.min(selectionBox.x1, selectionBox.x2)
    boxMaxX = Math.max(selectionBox.x1, selectionBox.x2)
    boxMinY = Math.min(selectionBox.y1, selectionBox.y2)
    boxMaxY = Math.max(selectionBox.y1, selectionBox.y2)
  }

  for (var row = 0; row < L.N; row++) {
    for (var k = 0; k <= row; k++) {
      var x = pegX(L, row, k)
      var y = L.topY + row * L.rowHeight
      var isSel = false
      if (hasSelection) {
        for (var sp = 0; sp < selectedPegs.length; sp++) {
          if (selectedPegs[sp].row === row && selectedPegs[sp].idx === k) {
            isSel = true
            break
          }
        }
      }

      // 1. Single mouse hover
      var isHov =
        hoveredPeg && hoveredPeg.row === row && hoveredPeg.idx === k

      // 2. Highlight all pegs within box selection
      var pegRadius = effectivePegR * 1.35
      if (
        selectionBox &&
        x + pegRadius >= boxMinX &&
        x - pegRadius <= boxMaxX &&
        y >= boxMinY &&
        y - pegRadius <= boxMaxY
      ) {
        isHov = true
      }

      // 3. Highlight all selected pegs while selected (orange frame and direction line always visible)
      if (isSel) {
        isHov = true
      }

      // 4. Highlight all pegs while manipulating the P slider without selection
      if (isSliderActive && !hasSelection) {
        isHov = true
      }

      var isShiftHov = isHov && isShiftPressed && hasSelection && !isSel
      drawPeg(
        ctx,
        x,
        y,
        state.pegProb[row][k],
        isSel,
        isHov,
        isShiftHov,
        effectivePegR,
      )
    }
  }

  if (selectionBox) {
    var minX = Math.min(selectionBox.x1, selectionBox.x2)
    var maxX = Math.max(selectionBox.x1, selectionBox.x2)
    var minY = Math.min(selectionBox.y1, selectionBox.y2)
    var maxY = Math.max(selectionBox.y1, selectionBox.y2)
    var boxW = maxX - minX
    var boxH = maxY - minY

    ctx.save()
    ctx.fillStyle = 'rgba(55, 138, 221, 0.18)'
    ctx.strokeStyle = '#378ADD'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.fillRect(minX, minY, boxW, boxH)
    ctx.strokeRect(minX, minY, boxW, boxH)
    ctx.restore()
  }

  // Draw bin dividers and bottom baseline
  ctx.save()
  ctx.strokeStyle = '#cac8bd'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (var divIdx = 0; divIdx <= L.N + 1; divIdx++) {
    var divX =
      divIdx === 0
        ? binX(L, 0) - L.spacing * 0.5
        : divIdx === L.N + 1
          ? binX(L, L.N) + L.spacing * 0.5
          : pegX(L, L.N - 1, divIdx - 1)
    ctx.moveTo(divX, L.landY - 4)
    ctx.lineTo(divX, L.barsBottomY)
  }
  var leftX = binX(L, 0) - L.spacing * 0.5
  var rightX = binX(L, L.N) + L.spacing * 0.5
  ctx.moveTo(leftX, L.barsBottomY)
  ctx.lineTo(rightX, L.barsBottomY)
  ctx.stroke()
  ctx.restore()

  var maxBinCount = 0
  for (var bIdx = 0; bIdx <= L.N; bIdx++) {
    var bCount = state.binCounts[bIdx] || 0
    if (bCount > maxBinCount) maxBinCount = bCount
  }

  var barW = Math.min(30, L.spacing * 0.8)
  var barsAreaH = L.barsBottomY - L.landY
  var rBall = Math.max(2.2, Math.min(6, barW / 2 - 0.5))
  var baseStep = rBall * 2 + 0.6
  var neededH = maxBinCount * baseStep + rBall + 6
  var zoomY =
    neededH > barsAreaH
      ? (barsAreaH - rBall - 6) / (maxBinCount * baseStep)
      : 1.0
  zoomY = Math.max(0.1, zoomY)

  var yStep = baseStep * zoomY
  var rBallY = rBall * zoomY

  landedBallScreens = []
  for (var j = 0; j <= L.N; j++) {
    var bx = binX(L, j)
    var balls = state.binBalls[j]
    for (var idx = 0; idx < balls.length; idx++) {
      var by = L.barsBottomY - rBallY - idx * yStep
      drawSteelBall(ctx, bx, by, rBall, rBallY)
      landedBallScreens.push({
        x: bx,
        y: by,
        r: rBall,
        rY: rBallY,
        bin: j,
        idx: idx,
        path: balls[idx],
      })
    }
  }

  if (hoveredPeg) {
    for (var hp = 0; hp < landedBallScreens.length; hp++) {
      var lb2 = landedBallScreens[hp]
      if (ballPassesThroughPeg(lb2.path, hoveredPeg.row, hoveredPeg.idx))
        drawGlow(ctx, lb2.x, lb2.y, lb2.r)
    }
  }

  if (state.showTheory) {
    var expected = computeExpected(L)
    var maxE = Math.max.apply(null, expected)
    if (maxE > 0) {
      var pts = []
      for (var j2 = 0; j2 <= L.N; j2++) {
        var tx = binX(L, j2)
        var ty = L.barsBottomY - (expected[j2] / maxE) * (barsAreaH - 10)
        pts.push({ x: tx, y: ty })
      }

      var ctrl = getMonotoneCubicControlPoints(pts, L.barsBottomY)

      ctx.save()

      // Smooth gradient fill under Monotone Cubic curve
      var grad = ctx.createLinearGradient(0, L.landY, 0, L.barsBottomY)
      grad.addColorStop(0, 'rgba(100, 116, 139, 0.18)')
      grad.addColorStop(1, 'rgba(100, 116, 139, 0.02)')

      ctx.beginPath()
      ctx.moveTo(pts[0].x, L.barsBottomY)
      ctx.lineTo(pts[0].x, pts[0].y)
      for (var i = 0; i < pts.length - 1; i++) {
        var c = ctrl[i]
        ctx.bezierCurveTo(
          c.cp1x,
          c.cp1y,
          c.cp2x,
          c.cp2y,
          pts[i + 1].x,
          pts[i + 1].y,
        )
      }
      ctx.lineTo(pts[pts.length - 1].x, L.barsBottomY)
      ctx.closePath()
      ctx.fillStyle = grad
      ctx.fill()

      // Monotone Cubic curve stroke (dashed)
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (var i2 = 0; i2 < pts.length - 1; i2++) {
        var c2 = ctrl[i2]
        ctx.bezierCurveTo(
          c2.cp1x,
          c2.cp1y,
          c2.cp2x,
          c2.cp2y,
          pts[i2 + 1].x,
          pts[i2 + 1].y,
        )
      }
      ctx.strokeStyle = COLOR_THEORY
      ctx.lineWidth = 2.0
      ctx.setLineDash([5, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Point dots on peak points
      for (var pIdx = 0; pIdx < pts.length; pIdx++) {
        ctx.beginPath()
        ctx.arc(pts[pIdx].x, pts[pIdx].y, 2.0, 0, Math.PI * 2)
        ctx.fillStyle = COLOR_THEORY
        ctx.fill()
      }

      ctx.restore()
    }
  }

  ctx.fillStyle = '#5f5e5a'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  for (var j3 = 0; j3 <= L.N; j3++)
    ctx.fillText(j3, binX(L, j3), L.barsBottomY + 16)

  for (var bi = 0; bi < activeBalls.length; bi++) {
    var pos = activeBalls[bi].position
    var r = activeBalls[bi].r || 6
    drawSteelBall(ctx, pos.x, pos.y, r)
  }

  if (currentHover) {
    var found = null
    for (var hi = 0; hi < landedBallScreens.length; hi++) {
      var lb = landedBallScreens[hi]
      if (lb.bin === currentHover.bin && lb.idx === currentHover.idx) {
        found = lb
        break
      }
    }
    if (found) {
      drawHoverPath(ctx, L, found)
      ctx.beginPath()
      ctx.arc(found.x, found.y, found.r + 3, 0, Math.PI * 2)
      ctx.strokeStyle = COLOR_SELECTED
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else if (hideTooltipCallback) {
      hideTooltipCallback()
    }
  }
}
