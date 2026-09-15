import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { registerWorker } from "../services/workerService";

function WorkerRegistration() {
  const { token, user } = useAuth();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    category: "",
    experience: "",
    charges: "",
    location: "",
    profilePhoto: null,
    certifications: null,
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleFileChange(event) {
    const { name, files } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: files[0],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!formData.phone.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      alert("Phone number must be exactly 10 digits.");
      return;
    }

    if (!formData.category) {
      alert("Please select a service category.");
      return;
    }

    if (formData.experience === "") {
      alert("Please enter your experience.");
      return;
    }

    if (Number(formData.experience) < 0) {
      alert("Experience cannot be negative.");
      return;
    }

    if (formData.charges === "") {
      alert("Please enter your charges.");
      return;
    }

    if (Number(formData.charges) <= 0) {
      alert("Charges must be greater than 0.");
      return;
    }

    if (!formData.location.trim()) {
      alert("Please enter your location.");
      return;
    }

    if (!token) {
      alert("You must be logged in to register as a worker.");
      return;
    }

    if (user?.role !== "worker") {
      alert("Only users with the worker role can create a worker profile.");
      return;
    }

    const workerData = {
      phone: formData.phone,
      category: formData.category,
      experience: Number(formData.experience),
      charges: Number(formData.charges),
      location: formData.location,
    };

    try {
      const data = await registerWorker(workerData, token);

      console.log("Worker registration successful:", data);

      alert("Worker registration submitted successfully!");
    } catch (error) {
      console.error("Worker registration error:", error);

      alert(error.message);
    }
  }

  return (
    <div className="page worker-registration-page">
      <div className="registration-header">
        <span className="section-label">JOIN SERVECONNECT</span>

        <h1>Register as a service worker</h1>

        <p>
          Create your professional profile and connect with customers looking
          for your services.
        </p>
      </div>

      <form className="worker-form" onSubmit={handleSubmit}>
        <div className="form-section">
          <h2>Personal information</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Full name</label>

              <input
                type="text"
                name="name"
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Phone number</label>

              <input
                type="tel"
                name="phone"
                placeholder="Enter your phone number"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Professional information</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Service category</label>

              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select your service
                </option>

                <option>Electrician</option>
                <option>Plumber</option>
                <option>Carpenter</option>
                <option>Painter</option>
              </select>
            </div>

            <div className="form-group">
              <label>Experience</label>

              <input
                type="number"
                name="experience"
                placeholder="Years of experience"
                value={formData.experience}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Charges</label>

              <input
                type="number"
                name="charges"
                placeholder="₹ per hour"
                value={formData.charges}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Location</label>

              <input
                type="text"
                name="location"
                placeholder="City / Area"
                value={formData.location}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Profile information</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Profile photo</label>

              <input
                type="file"
                name="profilePhoto"
                accept="image/*"
                onChange={handleFileChange}
              />

              <small>Upload a clear professional photo.</small>
            </div>

            <div className="form-group">
              <label>Certifications</label>

              <input
                type="file"
                name="certifications"
                onChange={handleFileChange}
              />

              <small>Upload relevant certificates if available.</small>
            </div>
          </div>
        </div>

        <div className="form-submit">
          <button type="submit" className="btn btn-primary">
            Submit Registration
          </button>
        </div>
      </form>
    </div>
  );
}

export default WorkerRegistration;
