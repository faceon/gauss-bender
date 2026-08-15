# Gauss Bender

> **Bend the Bell Curve** — An interactive Galton board where you reshape probability in real-time.

Tilt individual pegs to bend the resulting distribution away from the classic Gaussian bell curve, exploring probability, variance, and standard deviation through live visual simulation.

---

## Quick Start

```bash
npx serve .
```

Open the printed local URL (e.g. `http://localhost:3000`) in your browser.

---

## Features

- **Interactive Pegs**: Click or drag pegs to tilt them and control ball deflection.
- **Adjustable Board**: Customize row counts (1–50) and global deflection probabilities.
- **Live Statistics & Expected Curve**: Real-time Mean, Variance, and Std Dev tracking with a dynamic theoretical curve overlay.
- **Path Inspection**:
  - Hover over landed balls to trace their step-by-step bounce trajectory.
  - Hover over pegs to highlight all balls that passed through them.
- **Batch Drops**: Drop balls individually or in batches, and clear the board at any time.
