<style>
.team-hero {
  text-align: center;
  padding: 2rem 1rem;
  margin-bottom: 2rem;
}

.team-hero h1 {
  margin-bottom: 0.5rem;
}

.team-hero p {
  max-width: 500px;
  margin: 0 auto;
  opacity: 0.7;
}

.team-profiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.profile-card {
  padding: 2rem 1.5rem;
  border: 1px solid var(--md-typeset-table-color);
  border-radius: 14px;
  text-align: center;
  background: var(--md-default-bg-color);
  transition: all 0.3s ease;
}

.profile-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  border-color: #FFB74D;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFB74D, #FF8A65);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.2rem;
  font-size: 1.8rem;
  font-weight: 800;
  color: #1a1a2e;
}

.profile-card h3 {
  margin: 0 0 0.2rem !important;
}

.profile-card .roll {
  font-size: 0.85rem;
  opacity: 0.55;
  margin: 0 0 1rem;
}

.profile-card .role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 16px;
  font-size: 0.78rem;
  font-weight: 600;
  background: rgba(255,183,77,0.12);
  color: #FFB74D;
  margin-bottom: 0.8rem;
}

.profile-card .bio {
  font-size: 0.88rem;
  opacity: 0.75;
  line-height: 1.5;
  margin: 0;
}
</style>

# 👥 Team

<div class="team-hero">
  <p>The Solar Sage AI team — three engineering students at Thapar Institute of Engineering & Technology.</p>
</div>

<div class="team-profiles">
  <div class="profile-card">
    <div class="profile-avatar">SG</div>
    <h3>Shorya Gupta</h3>
    <p class="roll">Roll No: 1024030752</p>
    <span class="role-badge">Perception & Vision</span>
    <p class="bio">Working on the drone imagery pipeline, OpenCV-based detection, and panel segmentation algorithms.</p>
  </div>

  <div class="profile-card">
    <div class="profile-avatar">OS</div>
    <h3>Omkar Shukla</h3>
    <p class="roll">Roll No: 1024030757</p>
    <span class="role-badge">Backend & AI Agents</span>
    <p class="bio">Building the multi-agent decision layer, dirt scoring engine, and backend infrastructure.</p>
  </div>

  <div class="profile-card">
    <div class="profile-avatar">SS</div>
    <h3>Sahil Soni</h3>
    <p class="roll">Roll No: 1024030760</p>
    <span class="role-badge">Hardware & Dashboard</span>
    <p class="bio">Developing the ESP32 actuation layer, servo/pump control, and the monitoring dashboard.</p>
  </div>
</div>

---

## Institution

**Thapar Institute of Engineering & Technology**
Patiala, Punjab, India

**Course:** UCS503P — Software Engineering Project (2026–27 Odd Semester)
