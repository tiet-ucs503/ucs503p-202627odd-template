<div align="center">

# Solar Sage AI

### Drone-Based Edge-AI System for Condition-Based Solar Panel Cleaning

[![GitHub Pages](https://img.shields.io/badge/docs-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://omkarshukla101.github.io/ucs503p-202627-solar-sage)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer%20Vision-5C3EE8?style=for-the-badge&logo=opencv)](https://opencv.org)
[![ESP32](https://img.shields.io/badge/ESP32-Edge%20AI-E7352C?style=for-the-badge&logo=espressif)](https://www.espressif.com)

*An autonomous drone-based system that replaces blind, water-heavy solar panel cleaning with intelligent, condition-based maintenance using OpenCV and edge AI.*

**UCS503P - Software Engineering Project | Thapar Institute of Engineering & Technology | 2026-27**

---

</div>

## The Problem

Solar operators at utility scale face a critical mismatch between how panels are maintained and how dirty they actually are:

| Problem | Impact |
|:--------|:-------|
| **Resource intensity** | A 1 GW farm uses 12.5M+ litres/month on washing alone |
| **Schedule blindness** | Clean panels get washed; genuinely dirty ones wait weeks |
| **Physical degradation** | Frequent contact cleaning causes micro-cracks, shortening panel life |
| **Fragmented decisions** | Without per-panel data, the dirtiest panels are not prioritized |

## Our Solution

Solar Sage AI is an autonomous "Inspect-to-Clean" system that uses drone imagery and edge AI to clean only what needs cleaning, when it needs cleaning.

```
Drone Capture --> OpenCV Detection --> AI Scoring --> ESP32 Actuation --> Validation
```

### Key Features

- **Drone Perception** - RGB and thermal payload captures high-resolution panel imagery
- **OpenCV Pipeline** - Real-time panel segmentation and dirt/debris detection
- **Multi-Agent AI** - 5 specialized agents (confidence, priority, benchmarking, ROI, water optimization)
- **Edge Execution** - ESP32-driven servo and pump control with sub-second latency
- **Live Dashboard** - Per-panel dirt scores, efficiency gains, and ROI reporting
- **CI/CD** - Automated builds and tests on every change

## Architecture

```
+-------------------------------------------------------------+
|                     PERCEPTION LAYER                        |
|  Drone (RGB/Thermal) --> OpenCV Segmentation --> Feature    |
|                          & Dirt Detection      Extraction   |
+-------------------------------------------------------------+
|                      DECISION LAYER                         |
|  Dirt Scoring  -->  Multi-Agent System  -->  Cleaning       |
|   (0-100)          (5 specialized agents)    Decision       |
+-------------------------------------------------------------+
|                     ACTUATION LAYER                         |
|  ESP32 Controller --> Servo Motors --> Targeted Water Pump   |
+-------------------------------------------------------------+
```

## Evaluation Metrics

| Metric | Category | Target |
|:-------|:---------|:-------|
| Perception-to-decision latency | **Primary** | < 1 second |
| Cleaning trigger accuracy | **Primary** | Verified against manual inspection |
| Water savings per panel | Secondary | Significant reduction from 2.8 L baseline |
| Cleaning time reduction | Secondary | Per-panel improvement vs. manual |
| Cost savings | Secondary | INR savings/panel/month |
| System reliability | Secondary | >= 99% uptime |

## Tech Stack

| Layer | Technology |
|:------|:-----------|
| Computer Vision | OpenCV (segmentation, dirt detection, feature extraction) |
| Edge Computing | ESP32 (sub-second decision-to-actuation, zero cloud dependency) |
| Backend and AI | Python, NumPy, Pandas, scikit-learn |
| Dashboard | Web-based monitoring interface |
| CI/CD | GitHub Actions (automated builds, tests, deployment) |
| Documentation | MkDocs Material (GitHub Pages) |
| Hardware | Standard drone platform with RGB/thermal payload |

## Project Structure

```
solar-sage/
├── .github/workflows/     # CI/CD pipeline (MkDocs deployment)
├── assets/                # Logos, icons, and stylesheets
├── code/
│   ├── src/bin/           # Main entry point
│   ├── src/lib/           # Core libraries
│   └── inc/               # Header files
├── docs/                  # MkDocs documentation source
│   ├── index.md           # Landing page
│   ├── architecture.md    # System architecture
│   ├── diagrams.md        # UML, DFD, and Gantt chart
│   ├── roadmap.md         # Project roadmap and milestones
│   ├── team.md            # Team information
│   └── dfd diagrams/      # Data flow diagram images
├── journals/              # Team member development journals
├── project-proposal/      # LaTeX project proposal and PDF
├── project-report-*/      # LaTeX reports (prototype and final)
├── mkdocs.yml             # Documentation configuration
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.x
- OpenCV
- ESP32 toolchain
- MkDocs (for documentation)

### Local Development

```bash
# Clone the repository
git clone https://github.com/omkarshukla101/ucs503p-202627-solar-sage.git
cd ucs503p-202627-solar-sage

# Build the code
make

# Serve documentation locally
pip install mkdocs mkdocs-material pymdown-extensions
mkdocs serve
```

### Build Documentation

```bash
make docs
```

## System Diagrams

The full set of system design diagrams is available on our [documentation site](https://omkarshukla101.github.io/ucs503p-202627-solar-sage/diagrams/):

- **Use Case Diagram** - Actor interactions and system boundaries
- **DFD Level 0** - Context diagram
- **DFD Level 1** - Subsystem breakdown
- **DFD Level 2** - Detailed internal data flows
- **Gantt Chart** - Full project timeline (Aug-Dec 2026)

## Reports

| Document | Location |
|:---------|:---------|
| Project Proposal | [`project-proposal/SolarSageReport.pdf`](project-proposal/SolarSageReport.pdf) |
| Prototype Stage Report | `project-report-prototype-stage/` |
| Final Report | `project-report-final/` |

## Team

<table>
  <tr>
    <td align="center"><b>Shorya Gupta</b><br/>1024030752<br/><sub>Perception and Vision</sub></td>
    <td align="center"><b>Omkar Shukla</b><br/>1024030757<br/><sub>Backend and AI Agents</sub></td>
    <td align="center"><b>Sahil Soni</b><br/>1024030760<br/><sub>Hardware and Dashboard</sub></td>
  </tr>
</table>

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<div align="center">

**[Documentation](https://omkarshukla101.github.io/ucs503p-202627-solar-sage)** | **[Issues](https://github.com/omkarshukla101/ucs503p-202627-solar-sage/issues)** | **[Project Board](https://github.com/omkarshukla101/ucs503p-202627-solar-sage/projects)**

*Built at Thapar Institute of Engineering and Technology*

</div>
