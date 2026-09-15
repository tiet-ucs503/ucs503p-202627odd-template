import { Link } from "react-router-dom";

function WorkerProfile() {
  return (
    <div className="page profile-page">
      <div className="profile-back">
        <Link to="/search">← Back to search</Link>
      </div>

      <section className="profile-card">
        <div className="profile-main">
          <div className="profile-avatar">RK</div>

          <div className="profile-heading">
            <span className="verified-badge">✓ Verified Worker</span>

            <h1>Raj Kumar</h1>

            <p className="profile-category">Electrician</p>

            <div className="profile-rating">
              <span>★</span>
              <strong>4.5</strong>
              <span>Excellent rating</span>
            </div>
          </div>
        </div>

        <div className="profile-divider"></div>

        <div className="profile-info-grid">
          <div className="info-item">
            <span className="info-label">Experience</span>
            <strong>8 Years</strong>
          </div>

          <div className="info-item">
            <span className="info-label">Location</span>
            <strong>Patiala</strong>
          </div>

          <div className="info-item">
            <span className="info-label">Charges</span>
            <strong>₹300/hour</strong>
          </div>

          <div className="info-item">
            <span className="info-label">Service</span>
            <strong>Electrical Work</strong>
          </div>
        </div>

        <div className="profile-divider"></div>

        <div className="profile-about">
          <h2>About the worker</h2>

          <p>
            Experienced electrician providing reliable electrical installation,
            maintenance and repair services for residential and local
            requirements.
          </p>
        </div>

        <div className="profile-actions">
          <button type="button" className="btn btn-primary call-button">
            ☎ Call Now
          </button>
        </div>
      </section>
    </div>
  );
}

export default WorkerProfile;
