---
hide:
  - toc
---

<style>
.architecture-intro {
  padding: 1.5rem;
  background: var(--md-default-bg-color);
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 12px;
  margin-bottom: 2rem;
  border-left: 4px solid #FFB74D;
}

.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.2rem;
  margin: 1.5rem 0;
}

.tech-card {
  padding: 1.2rem;
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 10px;
  background: var(--md-default-bg-color);
  transition: all 0.3s ease;
}

.tech-card:hover {
  border-color: #FFB74D;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
}

.tech-card h4 {
  margin: 0 0 0.5rem !important;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tech-card p {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.8;
  line-height: 1.5;
}
</style>

# 🏗️ Architecture

<div class="architecture-intro">
Solar Sage AI follows a <strong>five-stage pipeline</strong> architecture, from drone image capture through edge-AI classification to targeted actuation. The system decouples perception from decision-making, enabling scalable multi-drone coordination and low-latency cleaning triggers.
</div>

## System Overview

The architecture is composed of three primary layers:

### 1. Perception Layer
- **Drone Payload** — RGB and thermal cameras capture high-resolution imagery of solar panel arrays
- **OpenCV Pipeline** — Real-time image segmentation isolates individual panels and identifies dirt/debris regions
- **Feature Extraction** — Colour and texture thresholds are computed for each panel surface

### 2. Decision Layer
- **Dirt Scoring Engine** — Each panel receives a score (0–100) based on heuristic feature analysis
- **Multi-Agent System** — Five specialized agents collaborate:
    - **Confidence Agent** — Suppresses low-confidence detections
    - **Priority Agent** — Ranks panels by cleaning urgency
    - **Benchmarking Agent** — Compares against historical baselines
    - **ROI Agent** — Estimates return on cleaning investment
    - **Water Optimization Agent** — Minimizes resource usage

### 3. Actuation Layer
- **ESP32 Controller** — Receives cleaning commands and drives hardware
- **Servo Motors** — Precision-target the water nozzle to specific panel regions
- **Pump Control** — Delivers measured water volume based on dirt severity

## Technology Stack

<div class="tech-grid">
  <div class="tech-card">
    <h4>👁️ Computer Vision</h4>
    <p>OpenCV for panel segmentation, dirt detection, and feature extraction from drone imagery.</p>
  </div>
  <div class="tech-card">
    <h4>⚡ Edge Computing</h4>
    <p>ESP32 microcontroller for sub-second decision-to-actuation latency with zero cloud dependency.</p>
  </div>
  <div class="tech-card">
    <h4>🐍 Python Ecosystem</h4>
    <p>NumPy, Pandas, and scikit-learn for scoring logic, agent coordination, and data analysis.</p>
  </div>
  <div class="tech-card">
    <h4>📊 Web Dashboard</h4>
    <p>Real-time monitoring interface for per-panel metrics, efficiency tracking, and ROI reporting.</p>
  </div>
  <div class="tech-card">
    <h4>🔄 CI/CD</h4>
    <p>GitHub Actions for automated builds, tests, linting, and deployment of firmware and backend.</p>
  </div>
  <div class="tech-card">
    <h4>🛩️ Drone Hardware</h4>
    <p>Standard flight platform with RGB/thermal payload for field-level panel inspection.</p>
  </div>
</div>

## Design Constraints

| Constraint | Rationale |
|:-----------|:----------|
| Sub-1s decision latency | Fully on-edge pipeline; no cloud round-trips |
| Heuristic-first classification | Explainable thresholds over black-box deep learning |
| Standard flight hardware | Deployability with commercially available drones |
| Containerized deployment | Reproducible dashboard and backend environments |
