import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPost, deletePost } from '../api/posts';
import { mediaUrl } from '../utils/mediaUrl';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';

/**
 * PostDetailPage - Individual travel story view.
 * Displays author metadata, destination, editorial story text, and photo.
 */
export default function PostDetailPage() {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPost(postId)
      .then((res) => {
        if (!cancelled) setPost(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(formatError(err, 'Post not found or has been removed.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this travel story?')) return;
    setDeleting(true);
    try {
      await deletePost(postId);
      navigate('/', { replace: true });
    } catch (err) {
      alert(formatError(err, 'Could not delete post.'));
      setDeleting(false);
    }
  };

  const isOwner = Boolean(user && post && post.user && user.id === post.user.id);
  const userInitial = (post?.user?.full_name || post?.user?.username || '?')[0].toUpperCase();

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-container narrow">
        {/* Breadcrumb navigation */}
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
            <div className="skeleton-image"></div>
            <div className="skeleton-body">
              <div className="skeleton-line w-40"></div>
              <div className="skeleton-line w-80"></div>
              <div className="skeleton-line w-60"></div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="state-card error-card">
            <h3>Story not found</h3>
            <p>{error}</p>
            <Link to="/" className="btn-secondary-sm">
              Return to Feed
            </Link>
          </div>
        )}

        {/* Post Detail Card */}
        {post && !loading && (
          <article className="post-detail-card">
            {/* Destination badge */}
            {post.destination_name && (
              <div className="detail-dest-header">
                <span className="destination-badge lg">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  <span>{post.destination_name}</span>
                </span>
              </div>
            )}

            {/* Large Photo */}
            {post.image_url && (
              <div className="detail-img-wrapper">
                <img
                  src={mediaUrl(post.image_url)}
                  alt={post.destination_name ? `Journey in ${post.destination_name}` : 'Travel story'}
                  className="detail-large-img"
                  onError={(e) => {
                    e.currentTarget.parentElement.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Author Bar */}
            <div className="detail-author-bar">
              {post.user ? (
                <Link to={`/profile/${post.user.id}`} className="detail-author-link">
                  <div className="detail-author-avatar">
                    {post.user.profile_picture_url ? (
                      <img
                        src={mediaUrl(post.user.profile_picture_url)}
                        alt={post.user.username}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="avatar-fallback">{userInitial}</span>
                    )}
                  </div>
                  <div className="detail-author-meta">
                    <span className="detail-author-name">
                      {post.user.full_name || post.user.username}
                    </span>
                    <span className="detail-author-handle">@{post.user.username}</span>
                  </div>
                </Link>
              ) : (
                <div className="detail-author-meta">
                  <span className="detail-author-name">Explorer</span>
                </div>
              )}

              {/* Owner actions */}
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="btn-danger-pill"
                  disabled={deleting}
                  title="Delete story"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>{deleting ? 'Deleting…' : 'Delete Story'}</span>
                </button>
              )}
            </div>

            {/* Content text */}
            <div className="detail-story-content">
              <p>{post.content}</p>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}