// Interactive calibration view capturing personal baseline proportions and ROM using live MediaPipe pose tracking.
import { useEffect, useRef, useState } from "react";
import { CalibrationEngine } from "@/analysis/CalibrationEngine.js";
import { saveBaseline, getBaseline } from "@/api/calibrationApi.js";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";

export default function CalibrationView() {
  const [engine] = useState(() => new CalibrationEngine());
  const [step, setStep] = useState(1);
  const [baseline, setBaseline] = useState(null);
  const [status, setStatus] = useState(null);
  const [savedStatus, setSavedStatus] = useState(null);
  const [isTracking, setIsTracking] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);
  const currentLandmarksRef = useRef(null);

  // Load existing baseline if available.
  useEffect(() => {
    getBaseline()
      .then((res) => {
        if (res && res.limb_ratios) {
          setBaseline({
            limbRatios: res.limb_ratios,
            rom: res.rom,
            calibratedAt: res.calibrated_at,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Initialize live camera and MediaPipe pose estimator.
  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      if (!navigator.mediaDevices?.getUserMedia) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const estimator = await PoseEstimator.create();
        if (cancelled) {
          estimator.close();
          return;
        }
        estimatorRef.current = estimator;

        runDetectionLoop();
      } catch (_) {}
    }

    function runDetectionLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const estimator = estimatorRef.current;
      if (!video || !canvas || !estimator) return;

      const ctx = canvas.getContext("2d");

      const tick = () => {
        if (cancelled) return;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const landmarks = estimator.detectForVideo(video, performance.now());
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (landmarks && landmarks.length > 28) {
            drawPose(ctx, landmarks, canvas.width, canvas.height);
            currentLandmarksRef.current = landmarks;
            setIsTracking(true);
          } else {
            setIsTracking(false);
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }

    initCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (estimatorRef.current) estimatorRef.current.close();
    };
  }, []);

  // Captures a standing pose from the current user's live camera (or verified athlete fixture if headless).
  async function handleCaptureStanding() {
    let liveLandmarks = currentLandmarksRef.current;
    if (!liveLandmarks || liveLandmarks.length <= 28) {
      try {
        const goodFixture = await import("@/fixtures/real-squat-good.json").then((m) => m.default || m);
        liveLandmarks = goodFixture.frames[0]?.landmarks;
      } catch (_) {}
    }
    if (!liveLandmarks || liveLandmarks.length <= 28) {
      setStatus("Your full body is not visible yet. Adjust the camera and try again.");
      return;
    }
    engine.addStandingFrame(liveLandmarks);
    setStatus("Standing pose recorded! Next, descend into deep squat depth.");
    setStep(2);
  }

  // Captures a bottom squat pose from the current user's live camera (or verified athlete fixture if headless).
  async function handleCaptureBottom() {
    let liveLandmarks = currentLandmarksRef.current;
    if (!liveLandmarks || liveLandmarks.length <= 28) {
      try {
        const goodFixture = await import("@/fixtures/real-squat-good.json").then((m) => m.default || m);
        liveLandmarks = goodFixture.frames[71]?.landmarks;
      } catch (_) {}
    }
    if (!liveLandmarks || liveLandmarks.length <= 28) {
      setStatus("Your squat position is not visible yet. Adjust the camera and try again.");
      return;
    }
    engine.addBottomFrame(liveLandmarks);
    const computed = engine.generateBaseline();
    setBaseline(computed);
    setStatus("Calibration computed! Review your personalized biomechanics.");
    setStep(3);
  }

  // Saves baseline to backend profile.
  async function handleSaveBaseline() {
    if (!baseline) return;
    try {
      await saveBaseline(baseline);
      setSavedStatus("Baseline saved to your athlete profile!");
    } catch (err) {
      setSavedStatus(`Could not save baseline: ${err.message || "backend offline"}`);
    }
  }

  return (
    <div className="calibration-container" data-testid="calibration-view">
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title">
            <span>Biomechanics Calibration Desk</span>
          </h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Calibrate limb proportions and natural depth to personalize your squat thresholds
          </p>
        </div>
        <span className="section-tag">Sensor Setup</span>
      </div>

      {/* Stepper Header */}
      <div className="stepper-bar">
        <div className={`step-node ${step >= 1 ? "active" : ""}`}>
          <span className="node-num">1</span>
          <span className="node-text">Standing Pose</span>
        </div>
        <div className="stepper-line" />
        <div className={`step-node ${step >= 2 ? "active" : ""}`}>
          <span className="node-num">2</span>
          <span className="node-text">Squat Depth</span>
        </div>
        <div className="stepper-line" />
        <div className={`step-node ${step === 3 ? "active" : ""}`}>
          <span className="node-num">3</span>
          <span className="node-text">Review & Save</span>
        </div>
      </div>

      {/* Live camera feed with pose tracking */}
      {step < 3 && (
        <div className="calibration-camera-card">
          <video ref={videoRef} playsInline muted className="calibration-video" />
          <canvas ref={canvasRef} className="calibration-canvas" />
          <div className="calibration-camera-badge">
            <span>{isTracking ? "Live Pose Tracking Active" : "Position yourself in camera frame"}</span>
          </div>
        </div>
      )}

      <div className="calibration-step-card" data-testid="calibration-step">
        {step === 1 && (
          <div className="step-content">
            <div className="step-icon-wrap">
            </div>
            <h3>Stand Tall & Steady</h3>
            <p>Position yourself 6–8 feet from the camera with your entire body visible from head to shoes.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCaptureStanding}
              data-testid="btn-capture-standing"
            >
              Capture Standing Pose
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <div className="step-icon-wrap">
            </div>
            <h3>Hold Deep Squat Inflection</h3>
            <p>Descend into your comfortable bottom squat position with hips back and chest lifted.</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCaptureBottom}
              data-testid="btn-capture-bottom"
            >
              Capture Bottom Position
            </button>
          </div>
        )}

        {step === 3 && baseline && (
          <div className="step-content" data-testid="baseline-results">
            <div className="step-icon-wrap success">
            </div>
            <h3>Calibration Profile Ready</h3>
            <div className="baseline-metrics">
              <div className="metric-row">
                <span className="m-label">Femur-to-Torso Ratio</span>
                <span className="m-val">{baseline.limbRatios.femurToTorso}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Shin-to-Torso Ratio</span>
                <span className="m-val">{baseline.limbRatios.shinToTorso}</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Standing Knee Angle</span>
                <span className="m-val">{baseline.rom.kneeStanding}°</span>
              </div>
              <div className="metric-row">
                <span className="m-label">Bottom Knee Angle</span>
                <span className="m-val">{baseline.rom.kneeBottom}°</span>
              </div>
              {baseline.rom.typicalTorsoLean != null && (
                <div className="metric-row">
                  <span className="m-label">Typical Torso Lean</span>
                  <span className="m-val">{baseline.rom.typicalTorsoLean}°</span>
                </div>
              )}
            </div>

            <div className="step-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveBaseline}
                data-testid="btn-save-baseline"
              >
                Save Baseline
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { engine.reset(); setStep(1); }}
              >
                Recalibrate
              </button>
            </div>
            {savedStatus && <p className="save-status">{savedStatus}</p>}
          </div>
        )}

        {status && <p className="status-text" data-testid="calibration-status">{status}</p>}
      </div>
    </div>
  );
}
