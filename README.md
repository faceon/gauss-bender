# Bell Curve Bender

An interactive, physics-based Galton board simulator designed to explore probability distributions, variance, and standard deviation.

---

## Quick Start

No build step required. Run a local server and open in your browser:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

---

## Features

- **Adjustable Board**: Set row count $N$ ($1$–$50$) and global deflection probability $P(\text{left})$ ($0.00$–$1.00$).
- **Interactive Pegs**: Drag or click pegs to tilt them and set individual probabilities (tilting right deflects balls left).
- **Physics Simulation**: Realistic Matter.js ball drops combined with exact, deterministic path resolution.
- **Live Statistics & Expected Curve**: Real-time calculation of Mean, Variance, and Std Dev with an optional theoretical curve overlay (computed via Dynamic Programming).
- **Path Inspection**:
  - Hover over landed balls to view their step-by-step $L$/$R$ trajectory.
  - Hover over pegs to highlight all balls that passed through them.
- **Batch Drop & Clear**: Drop balls individually (`+1`), in custom batches (e.g. 50), or clear the board at any time.
