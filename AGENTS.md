# AGENTS.md

## Critical Invariant Conditions

1. **Separation of Physics and Path Determination**
   - Matter.js handles visual bouncing only.
   - The path (L/R) is deterministically decided when a ball reaches the y-coordinate threshold (`y >= topY + nextRow * rowHeight`). Through `while` loop evaluation, **every ball must pass through exactly N steps of path decisions**.

2. **Peg Rotation vs Probability Sign Mapping**
   - Peg tilted right / positive angle $\rightarrow$ `pegProb` increases (higher probability of ball going Left).
   - Maintain the sign in `drawPeg()`: `angle = (pLeft - 0.5) * 2 * maxAngle`.

3. **Canvas Resolution and Coordinate Scaling**
   - Fixed logical resolution `640x414` (`width: 100%` responsive).
   - Coordinate calculations must use `getBoundingClientRect()` scaling (`getCanvasCoords`).

4. **Tech Stack Constraints**
   - Maintain browser native ES Modules (`import`/`export`). No bundlers or transpilers allowed.
