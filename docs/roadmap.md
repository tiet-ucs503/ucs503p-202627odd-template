<style>
.milestone-timeline {
  position: relative;
  padding-left: 2rem;
  margin: 1.5rem 0;
}

.milestone-timeline::before {
  content: '';
  position: absolute;
  left: 0.5rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #FFB74D, #FF8A65, var(--md-typeset-table-color));
}

.milestone {
  position: relative;
  margin-bottom: 1.5rem;
  padding: 1rem 1.2rem;
  background: var(--md-default-bg-color);
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.milestone:hover {
  border-color: #FFB74D;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
}

.milestone::before {
  content: '';
  position: absolute;
  left: -1.75rem;
  top: 1.2rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #FFB74D;
  border: 2px solid var(--md-default-bg-color);
}

.milestone h4 {
  margin: 0 0 0.3rem !important;
  font-size: 1rem;
}

.milestone p {
  margin: 0;
  font-size: 0.88rem;
  opacity: 0.8;
  line-height: 1.5;
}

.milestone .phase-tag {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(255,183,77,0.15);
  color: #FFB74D;
  margin-bottom: 0.5rem;
}
</style>

# 🗺️ Roadmap

## Project Phases

<div class="milestone-timeline">
  <div class="milestone">
    <span class="phase-tag">Phase 1 — Foundation</span>
    <h4>Core Perception & Actuation Prototype</h4>
    <p>Drone image capture, OpenCV-based panel segmentation, basic dirt detection, and ESP32 servo/pump control prototype. CI pipeline setup with linting and basic tests.</p>
  </div>

  <div class="milestone">
    <span class="phase-tag">Phase 2 — Integration</span>
    <h4>End-to-End Detect-and-Clean Loop</h4>
    <p>Full pipeline integration: image → detection → scoring → actuation. Dirt scoring on a 0–100 scale with heuristic thresholds. Basic logging for latency measurement.</p>
  </div>

  <div class="milestone">
    <span class="phase-tag">Phase 3 — Intelligence</span>
    <h4>Multi-Agent Decision Layer</h4>
    <p>Deploy five specialized agents (confidence, priority, benchmarking, ROI, water optimization) that collaboratively determine cleaning actions.</p>
  </div>

  <div class="milestone">
    <span class="phase-tag">Phase 4 — Dashboard</span>
    <h4>Monitoring & ROI Reporting</h4>
    <p>Web-based dashboard showing per-panel dirt scores, efficiency gains, cost savings, and historical trends. Containerized deployment with CI/CD.</p>
  </div>

  <div class="milestone">
    <span class="phase-tag">Phase 5 — Validation</span>
    <h4>Field Testing & Benchmarking</h4>
    <p>Water, electrical, and dust tests on a test array. Before/after comparison against manual cleaning baseline. Publish evaluation metrics.</p>
  </div>

  <div class="milestone">
    <span class="phase-tag">Stretch Goal</span>
    <h4>Learned Classification</h4>
    <p>Replace heuristic thresholds with a trained model for improved edge-case accuracy. Multi-drone coordination for larger panel fields.</p>
  </div>
</div>

---

## Visual Timeline — Gantt Chart

The interactive Gantt chart below details all 6 project phases, tasks, dependencies, and milestones from August to December 2026:

```mermaid
gantt
    title Solar Sage AI — Project Timeline (UCS503P)
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d

    section Phase 1 - Research & Proposal
    Literature survey on drone-based solar cleaning   :a1, 2026-08-01, 18d
    Problem statement definition                      :a2, 2026-08-05, 10d
    Solution approach design                          :a3, after a2, 12d
    Project proposal report (LaTeX)                   :a4, 2026-08-15, 16d
    Proposal Submission                               :milestone, m1, 2026-08-31, 0d

    section Phase 2 - System Design
    Use case diagram                                  :b1, 2026-09-01, 10d
    DFD Level 0, 1, 2                                 :b2, 2026-09-05, 12d
    System architecture design                        :b3, 2026-09-10, 14d
    Tech stack finalization (OpenCV, ESP32, Python)    :b4, 2026-09-08, 10d
    GitHub Pages documentation site                   :b5, 2026-09-15, 15d

    section Phase 3 - Core Development
    CI/CD pipeline setup                              :c1, 2026-09-25, 12d
    Drone image capture pipeline                      :c2, 2026-10-01, 15d
    ESP32 servo & pump actuation prototype            :c3, 2026-10-05, 20d
    OpenCV panel segmentation & dirt detection         :c4, 2026-10-10, 22d
    Dirt scoring engine (0-100 heuristic)             :c5, 2026-10-20, 15d
    Multi-agent decision layer                        :c6, 2026-10-15, 25d
    Prototype Demo                                    :milestone, m2, 2026-11-10, 0d

    section Phase 4 - Dashboard & Integration
    Web dashboard (per-panel metrics, efficiency, ROI):d1, 2026-11-01, 18d
    End-to-end detect-and-clean loop integration      :d2, 2026-11-05, 20d
    Containerized deployment                          :d3, 2026-11-20, 10d

    section Phase 5 - Testing & Validation
    Water, electrical & dust tests on test array      :e1, 2026-11-15, 15d
    Baseline vs. automated cleaning comparison        :e2, 2026-11-20, 15d
    Latency and accuracy benchmarking                 :e3, 2026-11-25, 15d
    Bug fixes and optimization                        :e4, 2026-12-01, 12d

    section Phase 6 - Final Report & Demo
    Final project report (LaTeX)                      :f1, 2026-12-01, 15d
    Project demo preparation                          :f2, 2026-12-08, 10d
    Documentation finalization                        :f3, 2026-12-10, 8d
    Final Report Submission                           :milestone, m3, 2026-12-20, 0d
```

---

## Deliverables Summary

### Iteration 1 (Initial)
- [x] Drone image capture setup
- [x] OpenCV-based detection and segmentation
- [x] Basic dirt-level scoring (0–100)
- [x] ESP32 servo and pump actuation prototype
- [x] Basic logging and latency timestamps
- [x] CI: build, firmware/backend tests, linting

### Iteration 2+ (Subsequent)
- [ ] Full multi-agent decision layer
- [ ] Dashboard for per-panel metrics and ROI
- [ ] Extended field validation tests
- [ ] Stretch: learned dirt classification

## Risks & Mitigations

| Risk | Mitigation |
|:-----|:-----------|
| Low-light / glare reducing detection accuracy | Combine RGB with thermal imaging; schedule flights in optimal lighting |
| False-positive cleaning triggers | Confidence agent suppresses low-confidence detections before actuation |
| Hardware / weather delays | Buffer window in final project phase for field-testing |
| Measurement ambiguity | Baseline measurements taken under matched conditions before comparison |
