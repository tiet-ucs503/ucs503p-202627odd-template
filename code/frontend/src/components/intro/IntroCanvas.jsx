import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import CanvasSpotlight from './CanvasSpotlight';
import IntroLanding from './IntroLanding';
import { CANVAS_ITEMS, CANVAS_WORLD } from '../../data/introCanvasData';
import './IntroCanvas.css';

function CanvasItem({ item, index }) {
  const isPhoto = item.type === 'photo' || item.type === 'story';
  const imageHeight = [210, 245, 185, 225][index % 4];
  const style = {
    left: item.x,
    top: item.y,
    width: item.width,
    '--item-rotation': `${item.rotation || 0}deg`,
  };

  return (
    <motion.article
      className={`intro-canvas-item intro-canvas-item--${item.type}`}
      style={style}
      rotate={item.rotation || 0}
      tabIndex={0}
      role="button"
      aria-label={`${item.title}, ${item.location}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: Math.min(index * 0.045, 0.55), ease: [0.2, 0.75, 0.25, 1] }}
      whileHover={{ scale: 1.045 }}
      whileFocus={{ scale: 1.035 }}
    >
      {isPhoto && (
        <>
          <div className="intro-canvas-image-wrap" style={{ height: imageHeight }}>
            <img src={item.image} alt={item.title} draggable="false" />
            <span className="intro-canvas-image-title">{item.title}</span>
          </div>
          <div className="intro-canvas-caption">
            <span>{item.location}</span>
            {item.caption && <p>{item.caption}</p>}
            {item.author && <small>STORY BY {item.author.toUpperCase()}</small>}
          </div>
        </>
      )}

      {item.type === 'note' && (
        <div className="intro-canvas-note">
          <span>{item.tag}</span>
          <h2>{item.title}</h2>
          <p>{item.content}</p>
          <small>{item.location}</small>
        </div>
      )}

      {item.type === 'explorer' && (
        <div className="intro-canvas-explorer">
          <div className="intro-canvas-explorer-avatar">
            <img src={item.authorAvatar} alt="" draggable="false" />
          </div>
          <span className="intro-canvas-eyebrow">FIELD NOTES / EXPLORER</span>
          <h2>{item.author}</h2>
          <p className="intro-canvas-explorer-title">{item.title}</p>
          <p>{item.bio}</p>
          <small>{item.location} <span>·</span> {item.stats}</small>
        </div>
      )}
    </motion.article>
  );
}

/** A self-contained, scrollable introduction canvas. Routing can compose it later. */
export default function IntroCanvas({ onExplore, onLogin, onCreateAccount }) {
  const viewportRef = useRef(null);
  const transitionStartedRef = useRef(false);
  const [showLanding, setShowLanding] = useState(false);

  const continueToLanding = () => {
    if (transitionStartedRef.current) return;
    transitionStartedRef.current = true;
    setShowLanding(true);
  };

  const handleCanvasKeyDown = (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.closest?.('.intro-canvas-item')) {
      event.preventDefault();
      continueToLanding();
    }
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    // Begin around the populated center while retaining the full scrollable world.
    viewport.scrollLeft = Math.max(0, (CANVAS_WORLD.width - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (CANVAS_WORLD.height - viewport.clientHeight) / 2);
    return undefined;
  }, []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {showLanding ? (
        <motion.div
          key="intro-landing"
          className="intro-landing-stage"
          initial={{ opacity: 0, scale: 1.035, filter: 'blur(5px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <IntroLanding onExplore={onExplore} onLogin={onLogin} onCreateAccount={onCreateAccount} />
        </motion.div>
      ) : (
        <motion.main
          key="intro-canvas"
          className="intro-canvas-viewport"
          ref={viewportRef}
          aria-label="Travel Sphere interactive canvas"
          onClick={continueToLanding}
          onKeyDown={handleCanvasKeyDown}
          initial={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.965, filter: 'blur(7px)' }}
          transition={{ duration: 0.72, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="intro-canvas-world" style={{ width: CANVAS_WORLD.width, height: CANVAS_WORLD.height }}>
            <div className="intro-canvas-grain" aria-hidden="true" />
            <div className="intro-canvas-vignette" aria-hidden="true" />
            {CANVAS_ITEMS.map((item, index) => (
              <CanvasItem key={item.id} item={item} index={index} />
            ))}
          </div>
          <CanvasSpotlight />
          <button className="intro-canvas-instruction" type="button" onClick={continueToLanding}>
            TAP ANYWHERE TO CONTINUE
          </button>
        </motion.main>
      )}
    </AnimatePresence>
  );
}
