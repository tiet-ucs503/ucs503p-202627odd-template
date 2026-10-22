import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getPosts, deletePost } from '../api/posts';
import { searchUsers } from '../api/users';
import { searchDestinations } from '../api/destinations';
import { followUser, unfollowUser } from '../api/follows';
import { mediaUrl } from '../utils/mediaUrl';
import { formatError } from '../utils/formatError';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';

const CATEGORIES = [
  { id: 'all', label: 'ALL' },
  { id: 'destinations', label: 'DESTINATIONS' },
  { id: 'stories', label: 'STORIES' },
  { id: 'explorers', label: 'EXPLORERS' },
];

export default function ExplorePage() {
  const { user } = useAuth();

  // Active Category: 'all' | 'destinations' | 'stories' | 'explorers'
  const [activeCategory, setActiveCategory] = useState('all');

  // Posts state
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');

  // User search state
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userSearched, setUserSearched] = useState(false);

  // Destination search state
  const [destQuery, setDestQuery] = useState('');
  const [destResults, setDestResults] = useState([]);
  const [destLoading, setDestLoading] = useState(false);
  const [destSearched, setDestSearched] = useState(false);

  useEffect(() => {
    // Load initial global posts
    getPosts()
      .then((res) => setPosts(res.data ?? []))
      .catch((err) => setPostsError(formatError(err, 'Could not load global posts.')))
      .finally(() => setPostsLoading(false));

    // Pre-populate initial destinations for editorial showcase
    searchDestinations('')
      .then((res) => setDestResults(res.data ?? []))
      .catch(() => {});

    // Pre-populate initial explorers for editorial showcase
    searchUsers('')
      .then((res) => setUserResults(res.data ?? []))
      .catch(() => {});
  }, []);

  const handleUserSearch = async (e) => {
    e.preventDefault();
    if (!userQuery.trim()) return;
    setUserLoading(true);
    setUserSearched(true);
    try {
      const res = await searchUsers(userQuery.trim());
      setUserResults(res.data ?? []);
    } catch {
      setUserResults([]);
    } finally {
      setUserLoading(false);
    }
  };

  const handleDestSearch = async (e) => {
    e.preventDefault();
    if (!destQuery.trim()) return;
    setDestLoading(true);
    setDestSearched(true);
    try {
      const res = await searchDestinations(destQuery.trim());
      setDestResults(res.data ?? []);
    } catch {
      setDestResults([]);
    } finally {
      setDestLoading(false);
    }
  };

  const handleFollow = async (targetUser) => {
    try {
      await followUser(targetUser.id);
      setUserResults((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, _following: true } : u))
      );
    } catch (err) {
      alert(formatError(err, 'Could not follow user.'));
    }
  };

  const handleUnfollow = async (targetUser) => {
    try {
      await unfollowUser(targetUser.id);
      setUserResults((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, _following: false } : u))
      );
    } catch (err) {
      alert(formatError(err, 'Could not unfollow user.'));
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

  return (
    <div className="editorial-app-shell">
      <Navbar />

      <main className="editorial-canvas">
        {/* ── TOP HERO SECTION ── */}
        <section className="editorial-hero">
          <motion.div
            className="hero-supertitle"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <span>TRAVEL SPHERE ARCHIVE</span>
            <span className="hero-divider">/</span>
            <span>VOL. 01</span>
          </motion.div>

          <motion.h1
            className="hero-monumental"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            EXPLORE
            <br />
            <span className="hero-italic">THE WORLD</span>
          </motion.h1>

          <motion.div
            className="hero-motto-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <span className="hero-motto">PLAN • PROTECT • SAVE • DISCOVER</span>
          </motion.div>
        </section>

        {/* ── CATEGORY SELECTOR ── */}
        <nav className="editorial-category-nav" aria-label="Explore Categories">
          <div className="category-track">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`category-btn ${isActive ? 'is-active' : ''}`}
                >
                  <span className="category-text">{cat.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="categoryIndicator"
                      className="category-line"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── DYNAMIC CONTENT CANVAS ── */}
        <AnimatePresence mode="wait">
          {/* TAB: ALL (CURATED COMPOSITE CANVAS) */}
          {activeCategory === 'all' && (
            <motion.div
              key="all"
              className="canvas-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Asymmetric Canvas Lead */}
              {posts.length > 0 && (
                <section className="canvas-lead-section">
                  <div className="canvas-lead-grid">
                    {/* Primary Hero Feature Story */}
                    <div className="canvas-primary-feature">
                      <PostCard
                        post={posts[0]}
                        canDelete={Boolean(user && posts[0].user && user.id === posts[0].user.id)}
                        onDelete={handleDeletePost}
                      />
                    </div>

                    {/* Secondary Spotlight Stack */}
                    <div className="canvas-side-stack">
                      <div className="editorial-sidebar-note">
                        <span className="note-label">FEATURED SPOTLIGHT</span>
                        <h3 className="note-heading">Chronicles of Unknown Horizons</h3>
                        <p className="note-desc">
                          Moments captured by independent travelers across continents. Connect, plan, and protect your journey.
                        </p>
                      </div>

                      {posts[1] && (
                        <div className="canvas-secondary-feature">
                          <PostCard
                            post={posts[1]}
                            canDelete={Boolean(user && posts[1].user && user.id === posts[1].user.id)}
                            onDelete={handleDeletePost}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Destination Ribbon Preview */}
              {destResults.length > 0 && (
                <section className="canvas-section">
                  <div className="section-meta-header">
                    <span className="meta-num">01</span>
                    <h2 className="meta-title">NOTABLE DESTINATIONS</h2>
                    <button
                      onClick={() => setActiveCategory('destinations')}
                      className="meta-action-link"
                    >
                      VIEW ALL ({destResults.length}) →
                    </button>
                  </div>

                  <div className="destination-asymmetric-row">
                    {destResults.slice(0, 3).map((d, index) => (
                      <Link
                        key={d.id}
                        to={`/destination/${d.id}`}
                        className={`dest-canvas-card index-${index}`}
                      >
                        <div className="dest-index-tag">DEST / 0{index + 1}</div>
                        <h3 className="dest-title">{d.name}</h3>
                        {d.country && <span className="dest-country-label">{d.country}</span>}
                        {d.description && <p className="dest-synopsis">{d.description}</p>}
                        <span className="dest-cta">EXPLORE HUB →</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Stories Continuation */}
              {posts.length > 2 && (
                <section className="canvas-section">
                  <div className="section-meta-header">
                    <span className="meta-num">02</span>
                    <h2 className="meta-title">RECENT CHRONICLES</h2>
                    <button
                      onClick={() => setActiveCategory('stories')}
                      className="meta-action-link"
                    >
                      BROWSE ALL STORIES ({posts.length}) →
                    </button>
                  </div>

                  <div className="asymmetric-posts-canvas">
                    {posts.slice(2, 6).map((post, idx) => (
                      <div key={post.id} className={`canvas-item item-span-${(idx % 3) + 1}`}>
                        <PostCard
                          post={post}
                          canDelete={Boolean(user && post.user && user.id === post.user.id)}
                          onDelete={handleDeletePost}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Explorers Preview */}
              {userResults.length > 0 && (
                <section className="canvas-section">
                  <div className="section-meta-header">
                    <span className="meta-num">03</span>
                    <h2 className="meta-title">EXPEDITION MEMBERS</h2>
                    <button
                      onClick={() => setActiveCategory('explorers')}
                      className="meta-action-link"
                    >
                      EXPLORER DIRECTORY →
                    </button>
                  </div>

                  <div className="explorers-minimal-strip">
                    {userResults.slice(0, 4).map((u) => {
                      const initial = (u.full_name || u.username || '?')[0].toUpperCase();
                      return (
                        <div key={u.id} className="explorer-strip-item">
                          <Link to={`/profile/${u.id}`} className="explorer-strip-link">
                            <div className="strip-avatar">
                              {u.profile_picture_url ? (
                                <img
                                  src={mediaUrl(u.profile_picture_url)}
                                  alt={u.username}
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span>{initial}</span>
                              )}
                            </div>
                            <div className="strip-info">
                              <h4 className="strip-name">{u.full_name || u.username}</h4>
                              <span className="strip-handle">@{u.username}</span>
                            </div>
                          </Link>

                          {user && user.id !== u.id && (
                            <div className="strip-action">
                              {u._following ? (
                                <button
                                  onClick={() => handleUnfollow(u)}
                                  className="editorial-action-btn active"
                                >
                                  FOLLOWING
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleFollow(u)}
                                  className="editorial-action-btn"
                                >
                                  + FOLLOW
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </motion.div>
          )}

          {/* TAB: DESTINATIONS */}
          {activeCategory === 'destinations' && (
            <motion.div
              key="destinations"
              className="canvas-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Minimal Search Line */}
              <form onSubmit={handleDestSearch} className="editorial-search-bar">
                <span className="search-label">SEARCH DESTINATION:</span>
                <input
                  type="text"
                  placeholder="Kyoto, Amalfi, Patagonia..."
                  value={destQuery}
                  onChange={(e) => setDestQuery(e.target.value)}
                  className="editorial-search-input"
                />
                <button type="submit" className="editorial-search-btn" disabled={destLoading}>
                  {destLoading ? 'SEEKING…' : 'DISCOVER →'}
                </button>
              </form>

              {/* Destinations Gallery */}
              <div className="destination-editorial-gallery">
                {destResults.map((d, index) => (
                  <Link
                    key={d.id}
                    to={`/destination/${d.id}`}
                    className="editorial-dest-panel"
                  >
                    <div className="panel-header">
                      <span className="panel-number">LOC / 0{index + 1}</span>
                      {d.country && <span className="panel-country">{d.country.toUpperCase()}</span>}
                    </div>

                    <h3 className="panel-title">{d.name}</h3>

                    {d.description && (
                      <p className="panel-description">{d.description}</p>
                    )}

                    <div className="panel-footer">
                      <span className="panel-arrow">ENTER DESTINATION →</span>
                    </div>
                  </Link>
                ))}
              </div>

              {destSearched && !destLoading && destResults.length === 0 && (
                <div className="editorial-empty-state">
                  <span className="empty-glyph">◌</span>
                  <p className="empty-text">No destinations documented under "{destQuery}".</p>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: STORIES */}
          {activeCategory === 'stories' && (
            <motion.div
              key="stories"
              className="canvas-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {postsLoading && (
                <div className="editorial-loading-state">
                  <span className="loading-pulse" />
                  <p>RETRIEVING EXPEDITION CHRONICLES…</p>
                </div>
              )}

              {postsError && (
                <div className="editorial-empty-state">
                  <p>{postsError}</p>
                </div>
              )}

              {!postsLoading && posts.length === 0 && !postsError && (
                <div className="editorial-empty-state">
                  <span className="empty-glyph">◌</span>
                  <p className="empty-text">No stories recorded yet. Be the first explorer to contribute.</p>
                  {user && (
                    <Link to="/create-post" className="editorial-cta-btn">
                      COMPOSE CHRONICLE →
                    </Link>
                  )}
                </div>
              )}

              {!postsLoading && posts.length > 0 && (
                <div className="editorial-stories-mosaic">
                  {posts.map((post, idx) => (
                    <div key={post.id} className={`mosaic-cell cell-scale-${(idx % 4) + 1}`}>
                      <PostCard
                        post={post}
                        canDelete={Boolean(user && post.user && user.id === post.user.id)}
                        onDelete={handleDeletePost}
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB: EXPLORERS */}
          {activeCategory === 'explorers' && (
            <motion.div
              key="explorers"
              className="canvas-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Minimal Search Line */}
              <form onSubmit={handleUserSearch} className="editorial-search-bar">
                <span className="search-label">SEARCH EXPLORERS:</span>
                <input
                  type="text"
                  placeholder="Username or real name..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="editorial-search-input"
                />
                <button type="submit" className="editorial-search-btn" disabled={userLoading}>
                  {userLoading ? 'SEARCHING…' : 'LOCATE →'}
                </button>
              </form>

              {/* Explorers Directory */}
              <div className="explorers-editorial-directory">
                {userResults.map((u) => {
                  const initial = (u.full_name || u.username || '?')[0].toUpperCase();
                  return (
                    <div key={u.id} className="explorer-portrait-card">
                      <Link to={`/profile/${u.id}`} className="portrait-header">
                        <div className="portrait-avatar">
                          {u.profile_picture_url ? (
                            <img
                              src={mediaUrl(u.profile_picture_url)}
                              alt={u.username}
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span>{initial}</span>
                          )}
                        </div>
                        <div className="portrait-ident">
                          <h4 className="portrait-name">{u.full_name || u.username}</h4>
                          <span className="portrait-handle">@{u.username}</span>
                        </div>
                      </Link>

                      {u.bio && <p className="portrait-bio">{u.bio}</p>}

                      {user && user.id !== u.id && (
                        <div className="portrait-action">
                          {u._following ? (
                            <button
                              onClick={() => handleUnfollow(u)}
                              className="editorial-action-btn active"
                            >
                              FOLLOWING
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFollow(u)}
                              className="editorial-action-btn"
                            >
                              + FOLLOW
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {userSearched && !userLoading && userResults.length === 0 && (
                <div className="editorial-empty-state">
                  <span className="empty-glyph">◌</span>
                  <p className="empty-text">No explorer found matching "{userQuery}".</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}