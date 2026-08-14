# Bell Curve Bender

An interactive Galton board simulator where you tilt individual pegs to bend the resulting distribution away from the classic bell curve, exploring probability, variance, and standard deviation.

---

## Quick Start

No build step required. Run a local server and open in your browser:

```bash
python3 -m http.server 8743
# Open http://localhost:8743
```

Caches JS/CSS aggressively — after editing files, hard refresh (Cmd/Ctrl+Shift+R) to see changes.

---

## Features

- **Adjustable Board**: Set row count N (1–50) and global (or per-selection) deflection probability P(left) (0.00–1.00).
- **Interactive Pegs**: Drag or click pegs to tilt them and set individual probabilities (tilting right deflects balls left).
- **Matter.js Visuals**: Ball drops render with Matter.js physics; each L/R deflection is decided by probability logic, not collision physics.
- **Live Statistics & Expected Curve**: Real-time calculation of Mean, Variance, and Std Dev with an optional theoretical curve overlay (computed via Dynamic Programming).
- **Path Inspection**:
  - Hover over landed balls to view their step-by-step L/R trajectory.
  - Hover over pegs to highlight all balls that passed through them.
- **Batch Drop & Clear**: Drop balls individually (`+1`), in custom batches (e.g. 50), or clear the board at any time.
