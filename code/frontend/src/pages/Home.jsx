import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

function Home() {
  const navigate = useNavigate();
  const [searchCat, setSearchCat] = useState("");
  const [searchLoc, setSearchLoc] = useState("");

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?category=${searchCat}&location=${searchLoc}`);
  };

  return (
    <div className="page">
      {/* Hero Section */}
      <section className="hero">
        <span className="hero-badge">Professional Home Services</span>
        
        <h1>
          Expert services, <span>delivered to your door.</span>
        </h1>
        
        <p>
          Book trusted, background-verified professionals for all your home needs. 
          From cleaning to plumbing, we've got you covered.
        </p>

        <form className="hero-search-container" onSubmit={handleSearch}>
          <input 
            type="text" 
            className="hero-search-input" 
            placeholder="What service do you need? (e.g. Plumber)" 
            value={searchCat}
            onChange={(e) => setSearchCat(e.target.value)}
          />
          <input 
            type="text" 
            className="hero-search-input" 
            style={{ borderLeft: '1px solid var(--border-color)' }}
            placeholder="Your Location" 
            value={searchLoc}
            onChange={(e) => setSearchLoc(e.target.value)}
          />
          <button type="submit" className="hero-search-btn">Search</button>
        </form>
      </section>

      {/* Services Grid */}
      <section className="section">
        <div className="section-header text-center" style={{ textAlign: 'center' }}>
          <h2>What are you looking for?</h2>
          <p>Choose from our wide range of professional services.</p>
        </div>

        <div className="category-grid">
          <div className="category-card" onClick={() => navigate('/search?category=Electrician')}>
            <div className="category-icon">⚡</div>
            <h3>Electrician</h3>
          </div>

          <div className="category-card" onClick={() => navigate('/search?category=Plumber')}>
            <div className="category-icon">🔧</div>
            <h3>Plumber</h3>
          </div>

          <div className="category-card" onClick={() => navigate('/search?category=Carpenter')}>
            <div className="category-icon">🪚</div>
            <h3>Carpenter</h3>
          </div>

          <div className="category-card" onClick={() => navigate('/search?category=Painter')}>
            <div className="category-icon">🎨</div>
            <h3>Painter</h3>
          </div>
          
          <div className="category-card" onClick={() => navigate('/search?category=Cleaning')}>
            <div className="category-icon">🧹</div>
            <h3>Cleaning</h3>
          </div>
          
          <div className="category-card" onClick={() => navigate('/search?category=AC Repair')}>
            <div className="category-icon">❄️</div>
            <h3>AC Repair</h3>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;
