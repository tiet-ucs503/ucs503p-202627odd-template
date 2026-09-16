// Real-time Squat Biomechanics & Rep Counting Studio
import CameraView from "@/components/CameraView.jsx";

export default function WorkoutPage() {
  return (
    <div className="page-view workout-page" data-testid="workout-page">
      {/* Studio Header */}
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title">
            <span>Rep & Kinematics Lab</span>
          </h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Real-time computer vision kinematics • Live angle HUD • Dynamic rep tracking
          </p>
        </div>
        <span className="section-tag">Active Studio</span>
      </div>

      {/* Live Camera Viewfinder & Biomechanics HUD */}
      <CameraView />
    </div>
  );
}
