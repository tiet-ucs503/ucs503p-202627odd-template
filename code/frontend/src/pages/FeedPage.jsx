import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getFeed } from '../api/feed';
import { deletePost } from '../api/posts';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';

/**
 * FeedPage - Main social feed on Travel Sphere.
 * Shows posts from followed users via GET /api/feed.
 */
export default function FeedPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeed = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getFeed(0, 20);
      setItems(res.data.items ?? []);
    } catch (err) {
      setError(formatError(err, 'Unable to load your travel feed. Please verify the backend is running.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handleDelete = async (postId) => {
    try {
      await deletePost(postId);
      setItems((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(formatError(err, 'Failed to delete post.'));
    }
  };

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-container">
        {/* Welcome Context Banner */}
        <section className="feed-hero-banner">
          <div className="feed-hero-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
            </svg>
            <span>Explorer Feed</span>
          </div>
          <h1 className="feed-hero-title">
            Welcome back, {user?.full_name ? user.full_name.split(' ')[0] : user?.username || 'Explorer'}
          </h1>
          <p className="feed-hero-subtitle">
            Catch up on the latest journeys, tips, and moments from travelers you follow.
          </p>
          <div className="feed-hero-actions">
            <Link to="/create-post" className="btn-primary-sm">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Share a Story</span>
            </Link>
            <Link to="/explore" className="btn-secondary-sm">
              <span>Explore All</span>
            </Link>
          </div>
        </section>

        {/* Loading State: Skeletons */}
        {loading && (
          <div className="skeleton-feed">
            {[1, 2, 3].map((n) => (
              <div key={n} className="skeleton-card">
                <div className="skeleton-header">
                  <div className="skeleton-circle"></div>
                  <div className="skeleton-lines">
                    <div className="skeleton-line w-40"></div>
                    <div className="skeleton-line w-20"></div>
                  </div>
                </div>
                <div className="skeleton-image"></div>
                <div className="skeleton-body">
                  <div className="skeleton-line w-80"></div>
                  <div className="skeleton-line w-60"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="state-card error-card">
            <div className="state-icon error-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>Could not load feed</h3>
            <p>{error}</p>
            <button onClick={loadFeed} className="btn-secondary-sm">
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && items.length === 0 && (
          <div className="state-card empty-card">
            <div className="state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                <path d="M2 12h20"></path>
              </svg>
            </div>
            <h3>Your travel feed is empty</h3>
            <p>
              You haven't followed any explorers yet, or they haven't posted. Check out global posts to find inspiring adventurers!
            </p>
            <div className="empty-actions">
              <Link to="/explore" className="btn-primary-sm">
                Discover Explorers & Posts
              </Link>
              <Link to="/create-post" className="btn-secondary-sm">
                Post Your Own Journey
              </Link>
            </div>
          </div>
        )}

        {/* Feed Posts */}
        {!loading && !error && items.length > 0 && (
          <div className="post-list">
            {items.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                canDelete={Boolean(user && post.user && user.id === post.user.id)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}