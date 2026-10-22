import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDestination, getDestinationPosts, getDestinationTravelers } from '../api/destinations';
import { mediaUrl } from '../utils/mediaUrl';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';

/**
 * DestinationDetailPage - Destination hub on Travel Sphere.
 * Displays destination profile, stories at this place, and fellow travelers who visited.
 */
export default function DestinationDetailPage() {
  const { destinationId } = useParams();
  const navigate = useNavigate();

  const [destination, setDestination] = useState(null);
  const [posts, setPosts] = useState([]);
  const [travelers, setTravelers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('posts'); // 'posts' | 'travelers'

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [destRes, postsRes, travelersRes] = await Promise.all([
          getDestination(destinationId),
          getDestinationPosts(destinationId),
          getDestinationTravelers(destinationId),
        ]);
        if (!cancelled) {
          setDestination(destRes.data);
          setPosts(postsRes.data ?? []);
          setTravelers(travelersRes.data ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatError(err, 'Destination details could not be found.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [destinationId]);

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-container">
        {/* Navigation Breadcrumb */}
        <div className="detail-nav-bar">
          <button onClick={() => navigate(-1)} className="breadcrumb-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back</span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="skeleton-card">
            <div className="skeleton-body">
              <div className="skeleton-line w-40"></div>
              <div className="skeleton-line w-20"></div>
              <div className="skeleton-line w-80"></div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="state-card error-card">
            <h3>Destination not found</h3>
            <p>{error}</p>
            <Link to="/explore" className="btn-secondary-sm">
              Back to Explore
            </Link>
          </div>
        )}

        {/* Destination Content */}
        {destination && !loading && (
          <>
            {/* Destination Hero Header */}
            <div className="destination-hero-card">
              <div className="destination-badge-row">
                <span className="badge">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span>Destination Hub</span>
                </span>
                {destination.country && (
                  <span className="country-badge">{destination.country}</span>
                )}
              </div>

              <h1 className="destination-hero-title">{destination.name}</h1>

              {destination.description && (
                <p className="destination-hero-desc">{destination.description}</p>
              )}

              <div className="dest-meta-stats">
                <span className="dest-stat-chip">
                  <strong>{posts.length}</strong> travel stories
                </span>
                <span className="dest-stat-chip">
                  <strong>{travelers.length}</strong> explorers visited
                </span>
              </div>
            </div>

            {/* Tab switch */}
            <div className="tab-pill-container">
              <button
                className={`tab-pill ${tab === 'posts' ? 'active' : ''}`}
                onClick={() => setTab('posts')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <span>Stories ({posts.length})</span>
              </button>
              <button
                className={`tab-pill ${tab === 'travelers' ? 'active' : ''}`}
                onClick={() => setTab('travelers')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Travelers Visited ({travelers.length})</span>
              </button>
            </div>

            {/* ── Stories Tab ── */}
            {tab === 'posts' && (
              <div>
                {posts.length === 0 ? (
                  <div className="state-card empty-card">
                    <div className="state-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </div>
                    <h3>No stories for {destination.name} yet</h3>
                    <p>Be the first to share your journey and photos from this destination.</p>
                    <Link to="/create-post" className="btn-primary-sm">
                      + Share a Story Here
                    </Link>
                  </div>
                ) : (
                  <div className="post-list">
                    {posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        canDelete={false}
                        onDelete={() => {}}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Travelers Tab ── */}
            {tab === 'travelers' && (
              <div>
                {travelers.length === 0 ? (
                  <div className="state-card empty-card">
                    <h3>No travelers recorded yet</h3>
                    <p>No explorers have posted stories from {destination.name} yet.</p>
                  </div>
                ) : (
                  <div className="explorer-grid">
                    {travelers.map((u) => {
                      const initial = (u.full_name || u.username || '?')[0].toUpperCase();
                      return (
                        <div key={u.id} className="explorer-card">
                          <Link to={`/profile/${u.id}`} className="explorer-card-link">
                            <div className="explorer-avatar">
                              {u.profile_picture_url ? (
                                <img
                                  src={mediaUrl(u.profile_picture_url)}
                                  alt={u.username}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="avatar-fallback">{initial}</span>
                              )}
                            </div>
                            <div className="explorer-info">
                              <h4 className="explorer-name">{u.full_name || u.username}</h4>
                              <span className="explorer-handle">@{u.username}</span>
                              {u.bio && <p className="explorer-bio">{u.bio}</p>}
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}