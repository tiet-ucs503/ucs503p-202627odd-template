import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUser, updateMe, getFollowers, getFollowing } from '../api/users';
import { followUser, unfollowUser } from '../api/follows';
import { uploadImage } from '../api/uploads';
import { getPosts, deletePost } from '../api/posts';
import { mediaUrl } from '../utils/mediaUrl';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';

/**
 * ProfilePage - Traveler profile on Travel Sphere.
 * Shows stats, bio, destinations visited count, followers/following, and stories.
 */
export default function ProfilePage() {
  const { userId } = useParams();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [socialTab, setSocialTab] = useState(null); // 'followers' | 'following' | null

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  // Edit profile state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', bio: '', profile_picture_url: '' });
  const [editFile, setEditFile] = useState(null);
  const [editPreview, setEditPreview] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const isOwnProfile = Boolean(me && parseInt(userId, 10) === me.id);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError('');
    try {
      const res = await getUser(userId);
      setProfile(res.data);
      setEditForm({
        full_name: res.data.full_name || '',
        bio: res.data.bio || '',
        profile_picture_url: res.data.profile_picture_url || '',
      });
    } catch (err) {
      setProfileError(formatError(err, 'Traveler profile not found.'));
    } finally {
      setProfileLoading(false);
    }
  }, [userId]);

  const loadFollowers = useCallback(async () => {
    try {
      const res = await getFollowers(userId);
      const list = res.data ?? [];
      setFollowers(list);
      if (me) setIsFollowing(list.some((f) => f.id === me.id));
    } catch {
      // Non-fatal
    }
  }, [userId, me]);

  const loadFollowing = useCallback(async () => {
    try {
      const res = await getFollowing(userId);
      setFollowing(res.data ?? []);
    } catch {
      // Non-fatal
    }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await getPosts();
      const all = res.data ?? [];
      setPosts(all.filter((p) => p.user && p.user.id === parseInt(userId, 10)));
    } catch {
      // Non-fatal
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
    loadFollowers();
    loadFollowing();
    loadPosts();
  }, [loadProfile, loadFollowers, loadFollowing, loadPosts]);

  const handleFollow = async () => {
    setFollowBusy(true);
    try {
      await followUser(parseInt(userId, 10));
      setIsFollowing(true);
      loadFollowers();
    } catch (err) {
      alert(formatError(err, 'Could not follow user.'));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleUnfollow = async () => {
    setFollowBusy(true);
    try {
      await unfollowUser(parseInt(userId, 10));
      setIsFollowing(false);
      loadFollowers();
    } catch (err) {
      alert(formatError(err, 'Could not unfollow user.'));
    } finally {
      setFollowBusy(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setEditFile(file);
    if (file) {
      setEditPreview(URL.createObjectURL(file));
    } else {
      setEditPreview(null);
    }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError('');
    setEditSuccess('');

    let pictureUrl = editForm.profile_picture_url;

    if (editFile) {
      try {
        const upRes = await uploadImage(editFile);
        pictureUrl = upRes.data.url;
      } catch (err) {
        setEditError(formatError(err, 'Failed to upload new profile photo.'));
        setEditSaving(false);
        return;
      }
    }

    try {
      // Preserves ability to clear full_name and bio with empty string
      const payload = {
        full_name: editForm.full_name,
        bio: editForm.bio,
      };
      if (pictureUrl) {
        payload.profile_picture_url = pictureUrl;
      }

      await updateMe(payload);
      setEditSuccess('Profile updated successfully!');
      setEditing(false);
      setEditPreview(null);
      setEditFile(null);
      loadProfile();
    } catch (err) {
      setEditError(formatError(err, 'Failed to update profile.'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(formatError(err, 'Failed to delete post.'));
    }
  };

  const userInitial = (profile?.full_name || profile?.username || '?')[0].toUpperCase();

  return (
    <div className="app-shell">
      <Navbar />

      <main className="page-container">
        {/* Loading */}
        {profileLoading && (
          <div className="skeleton-card">
            <div className="skeleton-header">
              <div className="skeleton-circle lg"></div>
              <div className="skeleton-lines">
                <div className="skeleton-line w-40"></div>
                <div className="skeleton-line w-20"></div>
                <div className="skeleton-line w-60"></div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {profileError && (
          <div className="state-card error-card">
            <h3>Profile not found</h3>
            <p>{profileError}</p>
            <Link to="/explore" className="btn-secondary-sm">
              Discover Explorers
            </Link>
          </div>
        )}

        {/* Profile Content */}
        {profile && !profileLoading && (
          <>
            {/* Profile Header Card */}
            <section className="profile-hero-card">
              <div className="profile-hero-top">
                <div className="profile-avatar-wrapper">
                  {profile.profile_picture_url ? (
                    <img
                      src={mediaUrl(profile.profile_picture_url)}
                      alt={profile.username}
                      className="profile-avatar-img"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="profile-avatar-fallback">{userInitial}</div>
                  )}
                </div>

                <div className="profile-info-main">
                  <div className="profile-name-row">
                    <h1 className="profile-display-name">
                      {profile.full_name || profile.username}
                    </h1>
                    <span className="profile-handle-badge">@{profile.username}</span>
                  </div>

                  {profile.bio ? (
                    <p className="profile-bio-text">{profile.bio}</p>
                  ) : (
                    <p className="profile-bio-empty">No bio provided yet.</p>
                  )}

                  {/* Profile Action: Edit or Follow/Unfollow */}
                  <div className="profile-cta-row">
                    {isOwnProfile ? (
                      <button
                        className="btn-secondary-sm"
                        onClick={() => {
                          setEditing(!editing);
                          setEditError('');
                          setEditSuccess('');
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>{editing ? 'Cancel Editing' : 'Edit Profile'}</span>
                      </button>
                    ) : (
                      me && (
                        isFollowing ? (
                          <button
                            onClick={handleUnfollow}
                            disabled={followBusy}
                            className="btn-secondary-sm"
                          >
                            <span>{followBusy ? 'Updating…' : 'Unfollow'}</span>
                          </button>
                        ) : (
                          <button
                            onClick={handleFollow}
                            disabled={followBusy}
                            className="btn-primary-sm"
                          >
                            <span>{followBusy ? 'Updating…' : '+ Follow'}</span>
                          </button>
                        )
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Stats Bar */}
              <div className="profile-stats-grid">
                <div className="stat-box">
                  <span className="stat-number">{profile.post_count ?? 0}</span>
                  <span className="stat-label">Stories</span>
                </div>
                <div className="stat-box">
                  {/* CRITICAL: destinations_visited is an array; use .length */}
                  <span className="stat-number">{profile.destinations_visited?.length ?? 0}</span>
                  <span className="stat-label">Destinations</span>
                </div>
                <button
                  className={`stat-box stat-clickable ${socialTab === 'followers' ? 'active' : ''}`}
                  onClick={() => setSocialTab(socialTab === 'followers' ? null : 'followers')}
                >
                  <span className="stat-number">{followers.length}</span>
                  <span className="stat-label">Followers</span>
                </button>
                <button
                  className={`stat-box stat-clickable ${socialTab === 'following' ? 'active' : ''}`}
                  onClick={() => setSocialTab(socialTab === 'following' ? null : 'following')}
                >
                  <span className="stat-number">{following.length}</span>
                  <span className="stat-label">Following</span>
                </button>
              </div>
            </section>

            {/* Edit Profile Drawer / Form */}
            {editing && (
              <div className="form-card edit-profile-card">
                <h3 className="section-title">Edit Explorer Profile</h3>
                {editError && <div className="auth-alert-error" role="alert">{editError}</div>}
                {editSuccess && <div className="state-success" role="status">{editSuccess}</div>}

                <form onSubmit={handleEditSave} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit_fullname">
                      Full Name
                    </label>
                    <input
                      id="edit_fullname"
                      type="text"
                      className="form-input"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                      placeholder="Your full name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit_bio">
                      Bio
                    </label>
                    <textarea
                      id="edit_bio"
                      className="form-textarea"
                      rows={3}
                      value={editForm.bio}
                      onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                      placeholder="Where are you traveling next? What kind of journeys inspire you?"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit_photo">
                      Update Profile Photo
                    </label>
                    <div className="edit-avatar-picker">
                      {editPreview ? (
                        <img src={editPreview} alt="Preview" className="edit-avatar-thumb" />
                      ) : profile.profile_picture_url ? (
                        <img src={mediaUrl(profile.profile_picture_url)} alt="Current" className="edit-avatar-thumb" />
                      ) : null}
                      <input
                        id="edit_photo"
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={handleFileChange}
                      />
                    </div>
                  </div>

                  <div className="form-actions-row">
                    <button type="submit" className="btn-primary-sm" disabled={editSaving}>
                      {editSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary-sm"
                      onClick={() => setEditing(false)}
                      disabled={editSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Followers / Following List Overlay */}
            {socialTab && (
              <div className="social-panel-card">
                <div className="social-panel-header">
                  <h3 className="section-title">
                    {socialTab === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}
                  </h3>
                  <button
                    className="btn-close-panel"
                    onClick={() => setSocialTab(null)}
                    aria-label="Close panel"
                  >
                    ✕
                  </button>
                </div>

                <div className="social-users-list">
                  {(socialTab === 'followers' ? followers : following).map((u) => {
                    const initial = (u.full_name || u.username || '?')[0].toUpperCase();
                    return (
                      <Link
                        key={u.id}
                        to={`/profile/${u.id}`}
                        className="social-user-item"
                        onClick={() => setSocialTab(null)}
                      >
                        <div className="social-user-avatar">
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
                        <div className="social-user-info">
                          <span className="social-user-name">{u.full_name || u.username}</span>
                          <span className="social-user-handle">@{u.username}</span>
                        </div>
                        <span className="social-user-arrow">→</span>
                      </Link>
                    );
                  })}

                  {(socialTab === 'followers' ? followers : following).length === 0 && (
                    <p className="state-empty-subtle">
                      No {socialTab === 'followers' ? 'followers' : 'following'} yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* User's Travel Stories */}
            <div className="profile-posts-header">
              <h2 className="section-title">
                {isOwnProfile ? 'My Travel Stories' : `Stories by ${profile.full_name || profile.username}`}
              </h2>
              <span className="badge-count">{posts.length}</span>
            </div>

            {postsLoading && (
              <div className="skeleton-feed">
                <div className="skeleton-card">
                  <div className="skeleton-image"></div>
                  <div className="skeleton-body">
                    <div className="skeleton-line w-60"></div>
                  </div>
                </div>
              </div>
            )}

            {!postsLoading && posts.length === 0 && (
              <div className="state-card empty-card">
                <div className="state-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                </div>
                <h3>No stories shared yet</h3>
                <p>
                  {isOwnProfile
                    ? 'Start sharing your adventures and memories with fellow explorers.'
                    : `${profile.full_name || profile.username} has not posted any travel stories yet.`}
                </p>
                {isOwnProfile && (
                  <Link to="/create-post" className="btn-primary-sm">
                    + Share a Story
                  </Link>
                )}
              </div>
            )}

            {!postsLoading && posts.length > 0 && (
              <div className="post-list">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    canDelete={isOwnProfile}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}