import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createPost } from '../api/posts';
import { uploadImage } from '../api/uploads';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';

/**
 * CreatePostPage - Compose and publish a new travel story.
 * Workflow:
 * 1. Upload photo if selected (POST /api/uploads/images)
 * 2. Publish post (POST /api/posts)
 */
export default function CreatePostPage() {
  const navigate = useNavigate();

  const [content, setContent] = useState('');
  const [destinationName, setDestName] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    } else {
      setImagePreview(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please write something about your travel experience.');
      return;
    }
    setError('');

    let imageUrl = null;

    // Step 1: Upload image if selected
    if (imageFile) {
      setUploading(true);
      try {
        const upRes = await uploadImage(imageFile);
        imageUrl = upRes.data.url;
      } catch (err) {
        setError(formatError(err, 'Image upload failed. Please try a different photo.'));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Step 2: Publish the post
    setSubmitting(true);
    try {
      const postData = {
        content: content.trim(),
        destination_name: destinationName.trim() || null,
        image_url: imageUrl,
      };
      await createPost(postData);
      navigate('/', { replace: true });
    } catch (err) {
      setError(formatError(err, 'Failed to create post. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const busy = uploading || submitting;

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-container narrow">
        {/* Header */}
        <div className="page-header">
          <Link to="/" className="breadcrumb-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Back to Feed</span>
          </Link>
          <span className="badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>New Journey</span>
          </span>
          <h1 className="page-title">Share a Travel Story</h1>
          <p className="page-subtitle">
            Inspire the Travel Sphere community with your photos, highlights, and tips.
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="auth-alert-error" role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form Card */}
        <div className="form-card">
          <form onSubmit={handleSubmit} noValidate>
            {/* Story Content */}
            <div className="form-group">
              <label className="form-label" htmlFor="content">
                Your Story or Experience <span className="required-star">*</span>
              </label>
              <textarea
                id="content"
                className="form-textarea"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Where did you go? What was memorable? Share food tips, scenic views, or cultural highlights…"
                required
              />
            </div>

            {/* Destination Field */}
            <div className="form-group">
              <label className="form-label" htmlFor="destName">
                Destination (City, Country, or Region)
              </label>
              <div className="input-wrapper">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                </span>
                <input
                  id="destName"
                  type="text"
                  className="form-input with-icon"
                  value={destinationName}
                  onChange={(e) => setDestName(e.target.value)}
                  placeholder="e.g. Kyoto, Japan or Amalfi Coast, Italy"
                />
              </div>
            </div>

            {/* Image Upload Area */}
            <div className="form-group">
              <label className="form-label">Photo (optional)</label>

              {!imagePreview ? (
                <label className="upload-dropzone" htmlFor="imgFile">
                  <input
                    id="imgFile"
                    type="file"
                    accept="image/*"
                    className="file-hidden-input"
                    onChange={handleFileChange}
                  />
                  <div className="upload-icon-circle">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <span className="upload-main-text">Click to upload a travel photo</span>
                  <span className="upload-sub-text">JPG, PNG, or WebP up to 10MB</span>
                </label>
              ) : (
                <div className="preview-container">
                  <img src={imagePreview} alt="Upload preview" className="preview-img" />
                  <div className="preview-overlay">
                    <span className="preview-name">{imageFile?.name}</span>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="btn-remove-preview"
                      title="Remove image"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Submit CTA */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary-block"
                disabled={busy}
              >
                {uploading ? (
                  <>
                    <span className="spinner-inline"></span>
                    <span>Uploading photo…</span>
                  </>
                ) : submitting ? (
                  <>
                    <span className="spinner-inline"></span>
                    <span>Publishing story…</span>
                  </>
                ) : (
                  <span>Publish Story</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}