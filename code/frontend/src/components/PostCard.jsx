import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { mediaUrl } from '../utils/mediaUrl';

/**
 * PostCard - Image-first, editorial travel story card.
 * Minimalist, typography-driven, and cinematic micro-interactions.
 */
export default function PostCard({ post, canDelete, onDelete }) {
  const handleDelete = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this travel story?')) {
      onDelete(post.id);
    }
  };

  const userInitial = (post.user?.full_name || post.user?.username || '?')[0].toUpperCase();

  return (
    <motion.article
      className="editorial-card"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Visual / Media Anchor */}
      {post.image_url ? (
        <div className="card-media-frame">
          <Link to={`/post/${post.id}`} className="card-media-link" tabIndex={-1}>
            <img
              src={mediaUrl(post.image_url)}
              alt={post.destination_name ? `Journey through ${post.destination_name}` : 'Travel story'}
              className="card-media-img"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.parentElement.parentElement.style.display = 'none';
              }}
            />
            <div className="card-media-vignette" />
          </Link>

          {post.destination_name && (
            <span className="card-media-tag">
              {post.destination_name.toUpperCase()}
            </span>
          )}
        </div>
      ) : (
        post.destination_name && (
          <div className="card-text-location">
            <span className="location-pip" />
            <span className="location-name">{post.destination_name.toUpperCase()}</span>
          </div>
        )
      )}

      {/* Editorial Content */}
      <div className="card-body">
        <Link to={`/post/${post.id}`} className="card-title-link">
          <p className="card-narrative">{post.content}</p>
        </Link>

        {/* Story Metadata & Author */}
        <div className="card-meta-bar">
          {post.user ? (
            <Link to={`/profile/${post.user.id}`} className="card-author">
              <div className="author-glyph">
                {post.user.profile_picture_url ? (
                  <img
                    src={mediaUrl(post.user.profile_picture_url)}
                    alt={post.user.username}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </div>
              <div className="author-names">
                <span className="author-display">{post.user.full_name || post.user.username}</span>
                <span className="author-handle">@{post.user.username}</span>
              </div>
            </Link>
          ) : (
            <span className="author-unknown">Explorer</span>
          )}

          <div className="card-actions">
            <Link to={`/post/${post.id}`} className="card-read-link">
              <span>EXPLORE</span>
              <span className="arrow-glyph">→</span>
            </Link>

            {canDelete && (
              <button
                onClick={handleDelete}
                className="card-delete-btn"
                title="Delete this story"
                aria-label="Delete post"
              >
                DELETE
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
}