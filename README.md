# MathVerse AI 🕷️📐
### *A Gamified, AI-Powered Mathematics Learning Platform with Real-Time Cognitive Eye-Tracking & Adaptive Knowledge Tracing*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18_%2B_TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch_LSTM-EE4C2C.svg?logo=pytorch&logoColor=white)](https://pytorch.org)
[![MediaPipe](https://img.shields.io/badge/Vision-MediaPipe_478_Landmarks-007ACC.svg?logo=google&logoColor=white)](https://developers.google.com/mediapipe)
[![TailwindCSS](https://img.shields.io/badge/UI-Tailwind_CSS-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Academic_Use-blue.svg)](#)

---

## 🌟 Overview

**MathVerse AI** is an intelligent, gamified learning system designed specifically to support middle-school and high-school students, particularly those with **Attention-Deficit/Hyperactivity Disorder (ADHD)** and math anxiety. By transforming abstract algebraic concepts into narrative superhero boss battles against classic Spider-Man villains (Green Goblin, Doctor Octopus, Mysterio, Venom, Lizard, and Kingpin), MathVerse AI captures and retains learner focus.

Under the hood, MathVerse AI features a multimodal AI pipeline combining **real-time computer vision eye-tracking** and a **Deep Knowledge Tracing (DKT) recurrent neural network** (`AdaptiveDifficultyLSTM`). The platform dynamically monitors cognitive attention states, calculates continuous student mastery probability ($P(\text{Correct})$), dynamically adapts curriculum question difficulty, and provides scaffolded hints through an AI tutor persona, **Spider-Gwen**.

---

## 🚀 Core Features & Technical Innovations

### 1. 👁️ Real-Time Computer Vision Eye-Tracking Engine
* **478 3D Facial Landmarks:** Powered by Google MediaPipe Tasks `FaceLandmarker` with custom low-level C-binding integration and high-speed in-memory tensor processing.
* **Clinical ADHD Biomarkers Extracted:**
  * **Eye Aspect Ratio (EAR) & Blink Rate:** Tracks physiological blink frequencies and fatigue.
  * **Pupil Dilation Proxy:** Dynamic iris-to-interocular distance ratio tracking cognitive load.
  * **Fixation Duration & Saccadic Velocity:** Distinguishes focused reading from rapid, erratic attention shifts.
  * **Gaze Stability:** Center-proximity tracking measuring visual drift from the problem workspace.
* **Soft Multi-Metric Cognitive Classification:** Classifies student mental engagement into 4 validated states:
  * 🟢 **Focused:** Stable gaze, normal blink frequency, high problem engagement.
  * 🟡 **Drifting:** Visual fixation away from the task canvas, elongated intervals between saccades.
  * 🔴 **Impulsive:** Rapid saccades, low fixation duration, erratic option selections.
  * 🟣 **Overwhelmed:** Extreme fixation or prolonged pupil dilation indicating high cognitive overload.
* **Privacy-First Architecture:** Video frames are analyzed locally in-memory and discarded immediately; only numerical telemetry metrics are tracked.

### 2. 🧠 Deep Knowledge Tracing (DKT) LSTM Model
* **Model Architecture:** Custom `AdaptiveDifficultyLSTM` implemented in PyTorch (`input_size=11, hidden_size=32`).
* **11-Dimensional Multi-Modal Sequence Vector:**
  * Performance signals: Question correctness ($0$ or $1$) and response time in seconds.
  * Cognitive signals: One-hot encoded cognitive state vector (`Focused`, `Drifting`, `Impulsive`, `Overwhelmed`).
  * Optical telemetry: Blink rate, pupil dilation proxy, median fixation duration, saccade frequency, and gaze stability ratio.
* **Temporal Sequence Processing:** Tracks historical question attempts and predicts the student's mastery probability ($0.0 - 1.0$) for the next problem.

### 3. 🎯 Truly Adaptive Difficulty & Spider-Gwen RAG Tutor
* **Bidirectional Dynamic Calibration:**
  * If $P(\text{Correct}) < 0.45$ OR cognitive state is `Drifting` / `Overwhelmed` $\rightarrow$ Dynamically scales to **Easy** with structural hints to prevent frustration and burnout.
  * If $P(\text{Correct}) > 0.75$ AND cognitive state is `Focused` $\rightarrow$ Challenges the student with **Hard** problems and combo rewards.
  * Otherwise $\rightarrow$ Balances at **Medium**.
* **Spider-Gwen Scaffolded Hints:** Contextually grounded in the current mathematical topic (linear equations, area/perimeter, number sequences, radicals, ratios) and calibrated to the student's immediate attention state.

### 4. 🎮 Full Gamification & Battle Mechanics
* **Interactive Spider-Man HUD:** Dynamic health bars, web strike combos, Spider-Sense timers, audio cues (Web-Shooter, Goblin Laugh, victory fanfare), and real-time biometric metrics.
* **Student Progression & Mastery Tracking:** Persistent user leveling, Spider-Points, and topic mastery retention stored in SQLite via SQLAlchemy.
* **Teacher & Parental Analytics Dashboard:** Visualizes cognitive distribution charts, mastery progression, and mission performance history.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Browser ["Frontend (React 18 + TypeScript + Vite)"]
        Cam["Webcam Stream (HTML5 Video & Canvas)"]
        HUD["Battle HUD & Telemetry Status"]
        Quiz["Holographic Math Canvas"]
        Gwen["Spider-Gwen Hint Dialogue"]
    end

    subgraph Backend ["FastAPI Backend Services (Port 8001)"]
        ET["/eye-track/frame\nMediaPipe 478 Landmark Engine"]
        DKT["LSTM Knowledge Tracing\nAdaptiveDifficultyLSTM"]
        RAG["RAG Tutor & Curriculum Service"]
        DB[(SQLite / SQLAlchemy DB\nUsers, Attempts, Mastery)]
    end

    Cam -->|1.2s Base64 Frame| ET
    ET -->|Biometrics: Blink, Gaze, Pupil| DKT
    Quiz -->|Answer & Time Taken| DKT
    DKT -->|Mastery Probability P(Correct)| RAG
    RAG -->|Adaptive Difficulty & Question| Quiz
    RAG -->|Cognitive State Hint| Gwen
    DKT -->|Predicted Mastery %| HUD
    Quiz -->|Attempt Results| DB
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, HTML5 Canvas, Web Audio API |
| **Backend** | Python 3.13, FastAPI, Uvicorn, SQLAlchemy, Pydantic, SQLite |
| **Machine Learning** | PyTorch (`AdaptiveDifficultyLSTM`), NumPy, SciPy |
| **Computer Vision** | Google MediaPipe Tasks (`FaceLandmarker`), OpenCV (`cv2`) |
| **Security & Auth** | JWT Authentication, Bcrypt Password Hashing, CORS Middleware |

---

## 📁 Repository Structure

```
Mathverse-ai_2026-27/
├── backend/
│   ├── main.py                     # FastAPI server entry point & route definitions
│   ├── database.py                 # SQLite engine & database session management
│   ├── models.py                   # SQLAlchemy ORM models (User, MissionAttempt, TopicMastery)
│   ├── schemas.py                  # Pydantic request & response validation schemas
│   ├── face_landmarker.task        # MediaPipe 3.7MB pre-trained 478 landmark model
│   ├── ml/
│   │   ├── eye_tracker.py          # MediaPipe vision engine, EAR, iris, & ADHD classifier
│   │   ├── attention_model.py      # AdaptiveDifficultyLSTM definition & inference
│   │   ├── train_lstm.py           # DKT LSTM training pipeline & synthetic sequence generator
│   │   └── lstm_weights.pt         # Pre-trained PyTorch LSTM weights
│   ├── routers/
│   │   ├── attempts.py             # Attempt submission, behavior analysis, & adaptive engine
│   │   ├── eye_tracking.py         # Frame streaming, telemetry sessions, & state simulation
│   │   ├── missions.py             # Villain profiles, levels, & mission catalog
│   │   ├── users.py                # User profiles, mastery analytics, & leveling
│   │   ├── auth.py                 # User authentication, registration, & JWT tokens
│   │   └── reports.py              # Parent/Teacher analytics & PDF report generation
│   └── services/
│       └── rag_tutor.py            # RAG problem generator & Spider-Gwen adaptive tutor
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── MissionPlayer.tsx   # Interactive battle arena, webcam integration, & HUD
│   │   │   ├── Navbar.tsx          # Navigation header & user status
│   │   │   ├── ParentDashboard.tsx # Cognitive & mastery analytics view
│   │   │   ├── ProfileModal.tsx    # User avatar & rank modal
│   │   │   └── Reveal.tsx          # Motion animations
│   │   ├── context/
│   │   │   ├── AuthContext.tsx     # Session & JWT token state
│   │   │   └── GameContext.tsx     # Spider-Points, level, & mission progress
│   │   ├── lib/
│   │   │   └── api.ts              # Axios / Fetch client wrappers
│   │   ├── App.tsx                 # Core layout & route coordinator
│   │   └── main.tsx                # React DOM entrypoint
│   ├── package.json                # Frontend dependencies
│   └── vite.config.ts              # Vite server & port configuration
├── docs/                           # Documentation and guides
├── journals/                       # Team weekly development logs
├── project-proposal/               # LaTeX project proposal documentation
└── README.md                       # Comprehensive project documentation
```

---

## ⚡ Quick Start Guide

### Prerequisites
* **Python:** 3.10 to 3.13
* **Node.js:** v18.x or later (with `npm`)
* **Webcam:** Working USB or integrated laptop camera (for eye-tracking telemetry)

---

### 1. Backend Setup

```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install required dependencies
pip install -r requirements.txt

# Start the FastAPI server on port 8001
uvicorn main:app --port 8001 --reload
```
* Backend API will be available at: **`http://localhost:8001`**
* Interactive Swagger Docs: **`http://localhost:8001/docs`**

---

### 2. Frontend Setup

```bash
# In a new terminal, navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
* Frontend application will be available at: **`http://localhost:5173`**

---

## 🎮 How to Play & Test Live

1. Open **`http://localhost:5173`** in your browser.
2. Sign up or log in as a student (or click **Quick Start**).
3. Select **Mission 01: Green Goblin Attack**.
4. When prompted by the browser, click **Allow** for Camera access.
5. Watch the top HUD:
   * **OPTICS: LIVE** activates in green.
   * **COGNITION** will dynamically display `Focused`, `Drifting`, `Impulsive`, or `Overwhelmed` based on your face landmarks and iris positions.
   * **Predicted Mastery** reflects real-time probability computed by the LSTM model.
   * Answer correctly to trigger Spider-Man's **Web Strike**; wrong answers trigger the villain's counter-attack!
   * Click **Request Gwen's Intel** for adaptive AI scaffolding hints.

---

## 👥 Academic & Course Information
* **Course:** UCS503P - Software Engineering Project (2026-27 ODD)
* **Institution:** Computer Science and Engineering Department, Thapar Institute of Engineering and Technology, Patiala
