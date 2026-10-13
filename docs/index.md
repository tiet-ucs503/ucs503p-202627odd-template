---
hide:
  - navigation
  - toc
---

<style>
/* Hero Section */
.hero-section {
  text-align: center;
  padding: 3rem 1rem 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #e94560 100%);
  border-radius: 16px;
  margin: -1rem -0.6rem 2.5rem;
  color: #fff;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle, rgba(255,183,77,0.08) 0%, transparent 60%);
  animation: hero-glow 8s ease-in-out infinite alternate;
}

@keyframes hero-glow {
  0% { transform: translate(0, 0); }
  100% { transform: translate(30px, -20px); }
}

.hero-section h1 {
  font-size: 2.8rem;
  font-weight: 800;
  margin-bottom: 0.3rem;
  background: linear-gradient(90deg, #FFB74D, #FF8A65, #FFD54F);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  position: relative;
}

.hero-section .hero-subtitle {
  font-size: 1.15rem;
  color: rgba(255,255,255,0.85);
  margin-bottom: 1.5rem;
  max-width: 680px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
  position: relative;
}

.hero-badges {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  position: relative;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.9rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(8px);
  color: rgba(255,255,255,0.9);
  border: 1px solid rgba(255,255,255,0.15);
}

/* Feature Cards */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.feature-card {
  background: var(--md-default-bg-color);
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 12px;
  padding: 1.5rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.12);
  border-color: #FFB74D;
}

.feature-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #FFB74D, #FF8A65);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover::before {
  opacity: 1;
}

.feature-icon {
  font-size: 2rem;
  margin-bottom: 0.75rem;
  display: block;
}

.feature-card h3 {
  margin: 0 0 0.5rem !important;
  font-size: 1.1rem;
  color: var(--md-typeset-color);
}

.feature-card p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--md-typeset-color);
  opacity: 0.8;
  line-height: 1.5;
}

/* Stats Bar */
.stats-bar {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin: 2.5rem 0;
  padding: 1.5rem;
  background: var(--md-default-bg-color);
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 12px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 1.8rem;
  font-weight: 800;
  color: #FFB74D;
  display: block;
}

.stat-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.7;
  margin-top: 0.2rem;
  display: block;
}

/* Team Section */
.team-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.team-card {
  text-align: center;
  padding: 1.5rem 1rem;
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 12px;
  transition: all 0.3s ease;
  background: var(--md-default-bg-color);
}

.team-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.1);
}

.team-avatar {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFB74D, #FF8A65);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a1a2e;
}

.team-card h4 {
  margin: 0 0 0.25rem !important;
  font-size: 1rem;
}

.team-card .roll-no {
  font-size: 0.8rem;
  opacity: 0.6;
  margin: 0;
}

/* Section Headers */
.section-header {
  margin: 3rem 0 1.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid transparent;
  border-image: linear-gradient(90deg, #FFB74D, transparent) 1;
}

.section-header h2 {
  margin: 0;
}

/* Pipeline Section */
.pipeline-flow {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin: 1.5rem 0;
}

.pipeline-step {
  text-align: center;
  padding: 1.2rem 0.8rem;
  border-radius: 10px;
  background: var(--md-default-bg-color);
  border: 1px solid var(--md-typeset-table-color);
  position: relative;
  transition: all 0.3s ease;
}

.pipeline-step:hover {
  border-color: #FFB74D;
  transform: scale(1.03);
}

.pipeline-step .step-num {
  display: inline-block;
  background: linear-gradient(135deg, #FFB74D, #FF8A65);
  color: #1a1a2e;
  font-weight: 800;
  width: 28px;
  height: 28px;
  line-height: 28px;
  border-radius: 50%;
  font-size: 0.8rem;
  margin-bottom: 0.5rem;
}

.pipeline-step .step-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 0.3rem;
}

.pipeline-step h4 {
  margin: 0 0 0.3rem !important;
  font-size: 0.9rem;
}

.pipeline-step p {
  margin: 0;
  font-size: 0.75rem;
  opacity: 0.7;
  line-height: 1.4;
}
</style>

<!-- Hero Section -->
<div class="hero-section">
  <h1>☀️ Solar Sage AI</h1>
  <p class="hero-subtitle">
    A drone-based Edge-AI system for condition-based solar panel cleaning — replacing blind, water-heavy maintenance with intelligent, targeted action.
  </p>
  <div class="hero-badges">
    <span class="hero-badge">🤖 Edge AI</span>
    <span class="hero-badge">🛩️ Drone-Based</span>
    <span class="hero-badge">👁️ OpenCV</span>
    <span class="hero-badge">⚡ ESP32</span>
    <span class="hero-badge">📊 Dashboard</span>
  </div>
</div>

<!-- Stats -->
<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-value">&lt;1s</span>
    <span class="stat-label">Decision Latency</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">70%+</span>
    <span class="stat-label">Water Savings</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">5</span>
    <span class="stat-label">AI Agents</span>
  </div>
  <div class="stat-item">
    <span class="stat-value">99%</span>
    <span class="stat-label">Uptime Target</span>
  </div>
</div>

---

<div class="section-header">

## 🔍 The Problem

</div>

Solar operators at utility scale face a critical mismatch — panels are cleaned on **fixed schedules**, blind to actual dirt levels. This leads to:

- **💧 Massive water waste** — a 1 GW farm uses 12.5M+ litres/month on washing alone
- **📅 Schedule blindness** — clean panels get washed; genuinely dirty ones wait weeks
- **⚠️ Physical degradation** — frequent contact cleaning causes micro-cracks and shortens panel life
- **📉 Fragmented decisions** — without per-panel data, the dirtiest panels aren't prioritized

---

<div class="section-header">

## 💡 Our Solution

</div>

Solar Sage AI is an autonomous **"Inspect-to-Clean"** system that uses drone imagery and edge AI to clean only what needs cleaning, when it needs cleaning.

<div class="features-grid">
  <div class="feature-card">
    <span class="feature-icon">📷</span>
    <h3>Perception Pipeline</h3>
    <p>RGB & thermal drone payload with OpenCV-based detection to capture and segment panel imagery in real time.</p>
  </div>
  <div class="feature-card">
    <span class="feature-icon">🧠</span>
    <h3>Edge Decision Layer</h3>
    <p>ESP32-driven control system classifying dirt levels and issuing cleaning commands with sub-second latency.</p>
  </div>
  <div class="feature-card">
    <span class="feature-icon">🤖</span>
    <h3>Multi-Agent Backend</h3>
    <p>Confidence, priority, benchmarking, ROI, and water-optimization agents that jointly decide when and where to clean.</p>
  </div>
  <div class="feature-card">
    <span class="feature-icon">🎯</span>
    <h3>Targeted Actuation</h3>
    <p>Servo-controlled, precision water application — replacing blanket cleaning cycles with surgical interventions.</p>
  </div>
  <div class="feature-card">
    <span class="feature-icon">📊</span>
    <h3>Live Dashboard</h3>
    <p>Per-panel dirt scores, efficiency gains, cost savings, and ROI reporting — all in a single monitoring interface.</p>
  </div>
  <div class="feature-card">
    <span class="feature-icon">🔄</span>
    <h3>CI/CD Pipeline</h3>
    <p>Automated builds and tests for the OpenCV pipeline and ESP32 firmware on every change, enabling safe iteration.</p>
  </div>
</div>

---

<div class="section-header">

## ⚙️ Processing Pipeline

</div>

<div class="pipeline-flow">
  <div class="pipeline-step">
    <span class="step-num">1</span>
    <span class="step-icon">🛩️</span>
    <h4>Drone Capture</h4>
    <p>RGB & thermal imagery across the panel field</p>
  </div>
  <div class="pipeline-step">
    <span class="step-num">2</span>
    <span class="step-icon">👁️</span>
    <h4>OpenCV Detection</h4>
    <p>Segment panels, detect surface dirt & debris</p>
  </div>
  <div class="pipeline-step">
    <span class="step-num">3</span>
    <span class="step-icon">🧠</span>
    <h4>AI Decision</h4>
    <p>Score dirt 0–100, rank by cleaning priority</p>
  </div>
  <div class="pipeline-step">
    <span class="step-num">4</span>
    <span class="step-icon">⚡</span>
    <h4>ESP32 Execution</h4>
    <p>Servo & pump signals for targeted cleaning</p>
  </div>
  <div class="pipeline-step">
    <span class="step-num">5</span>
    <span class="step-icon">✅</span>
    <h4>Validate</h4>
    <p>Confirm cleaning, log metrics for ROI</p>
  </div>
</div>

---

<div class="section-header">

## 📐 System Diagrams

</div>

### Use Case Diagram

<figure markdown>
  ![Use Case Diagram](solar_sage_use_case_diagram.png){ width="100%" loading=lazy }
  <figcaption>Solar Sage AI — Use Case Diagram showing actor interactions and system boundaries</figcaption>
</figure>

### Data Flow Diagrams

=== "Level 0 — Context"

    ![DFD Level 0](dfd%20diagrams/dfd_level0.png){ width="100%" loading=lazy }

=== "Level 1 — Subsystems"

    ![DFD Level 1](dfd%20diagrams/dfd_level1.png){ width="100%" loading=lazy }

=== "Level 2 — Detailed"

    ![DFD Level 2](dfd%20diagrams/dfd_level2.png){ width="100%" loading=lazy }

---

<div class="section-header">

## 📏 Evaluation Metrics

</div>

| Metric | Category | Target |
|:-------|:---------|:-------|
| Perception-to-decision latency | **Primary** | < 1 second |
| Cleaning trigger accuracy | **Primary** | Verified against manual inspection |
| Water savings per panel | Secondary | Significant reduction from 2.8 L baseline |
| Cleaning time reduction | Secondary | Per-panel improvement vs. manual |
| Cost savings | Secondary | ₹ savings/panel/month |
| System reliability | Secondary | ≥ 99% uptime |

---

<div class="section-header">

## 👥 Team

</div>

<div class="team-grid">
  <div class="team-card">
    <div class="team-avatar">SG</div>
    <h4>Shorya Gupta</h4>
    <p class="roll-no">1024030752</p>
  </div>
  <div class="team-card">
    <div class="team-avatar">OS</div>
    <h4>Omkar Shukla</h4>
    <p class="roll-no">1024030757</p>
  </div>
  <div class="team-card">
    <div class="team-avatar">SS</div>
    <h4>Sahil Soni</h4>
    <p class="roll-no">1024030760</p>
  </div>
</div>

<p style="text-align:center; margin-top:2rem; opacity:0.6; font-size:0.85rem;">
  UCS503P — Software Engineering Project · Thapar Institute of Engineering & Technology · 2026–27
</p>
