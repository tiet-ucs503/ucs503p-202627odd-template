import { Link, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { getWorkers } from "../services/workerService";

function Search() {
  const [searchParams] = useSearchParams();
  const [workers, setWorkers] = useState([]);
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [location, setLocation] = useState(searchParams.get("location") || "");

  const fetchWorkers = async () => {
    try {
      const data = await getWorkers(category, location);
      setWorkers(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [searchParams]);

  return (
    <div className="page search-page">
      <section className="search-header">
        <div>
          <span className="section-label">SERVECONNECT DIRECTORY</span>
          <h1>Find a trusted service worker</h1>
          <p>Search for professionals by service category and location.</p>
        </div>
      </section>

      <section className="search-box">
        <div className="search-field">
          <label>Service category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All Services</option>
            <option value="Electrician">Electrician</option>
            <option value="Plumber">Plumber</option>
            <option value="Carpenter">Carpenter</option>
            <option value="Painter">Painter</option>
          </select>
        </div>

        <div className="search-field">
          <label>Location</label>
          <input 
            type="text" 
            placeholder="Enter your city or area" 
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <button type="button" className="btn btn-primary search-button" onClick={fetchWorkers}>
          Search
        </button>
      </section>

      <section className="results-section">
        <div className="results-heading">
          <div>
            <h2>Available workers</h2>
            <p>Explore trusted professionals in your area.</p>
          </div>
          <span className="result-count">{workers.length} workers</span>
        </div>

        <div className="worker-grid">
          {workers.map((worker) => (
            <div className="worker-card" key={worker._id}>
              <div className="worker-card-top">
                <div className="worker-avatar">{worker.userId?.name?.charAt(0) || 'W'}</div>
                <span className="verified-badge">✓ Verified</span>
              </div>

              <h3>{worker.userId?.name || "Service Professional"}</h3>
              <p className="worker-category">{worker.category}</p>

              <div className="worker-details">
                <span>📍 {worker.location}</span>
                <span>{worker.experience} years experience</span>
              </div>

              <div className="worker-bottom">
                <span className="worker-rating">★ {worker.rating || 4.5}</span>
                <span>₹{worker.charges}/hour</span>
              </div>

              <Link to={`/worker/${worker._id}`} className="profile-button">
                View Profile →
              </Link>
            </div>
          ))}
          {workers.length === 0 && (
            <p>No workers found matching your search.</p>
          )}
        </div>
      </section>
    </div>
  );
}

export default Search;
