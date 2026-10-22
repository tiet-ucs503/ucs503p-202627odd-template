import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './IntroLanding.css';

export default function IntroLanding({ onExplore, onLogin, onCreateAccount }) {
  const titleRef = useRef(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <main className="intro-landing-page">
      <header className="intro-landing-header">
        <a className="intro-landing-brand" href="#welcome" aria-label="Travel Sphere home">
          <span className="intro-landing-brand-mark" aria-hidden="true">T</span>
          <span>TRAVEL SPHERE</span>
        </a>
        <span className="intro-landing-edition">A COMMUNITY FOR THE CURIOUS</span>
      </header>

      <section className="intro-landing-hero" id="welcome" aria-labelledby="intro-landing-title">
        <motion.div
          className="intro-landing-copy"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.18, ease: [0.2, 0.75, 0.25, 1] }}
        >
          <p className="intro-landing-kicker"><span /> YOUR NEXT STORY STARTS SOMEWHERE</p>
          <h1 id="intro-landing-title" ref={titleRef} tabIndex={-1}>
            Travel<br /><em>Sphere</em>
          </h1>
          <p className="intro-landing-motto">Plan <span>•</span> Protect <span>•</span> Save <span>•</span> Discover</p>
          <p className="intro-landing-description">
            Find places that stay with you, share the moments that brought you there, and meet travelers who see the world in their own way.
          </p>
          <nav className="intro-landing-actions" aria-label="Get started">
            <button className="intro-landing-action intro-landing-action--primary" type="button" onClick={onExplore}>EXPLORE <span aria-hidden="true">↗</span></button>
            <button className="intro-landing-action" type="button" onClick={onLogin}>LOGIN <span aria-hidden="true">→</span></button>
            <button className="intro-landing-action" type="button" onClick={onCreateAccount}>CREATE ACCOUNT <span aria-hidden="true">→</span></button>
          </nav>
        </motion.div>

        <motion.aside
          className="intro-landing-orbit"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.88, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.2, 0.75, 0.25, 1] }}
        >
          <div className="intro-landing-orbit-ring intro-landing-orbit-ring--outer" />
          <div className="intro-landing-orbit-ring intro-landing-orbit-ring--inner" />
          <div className="intro-landing-orbit-core"><span>TS</span></div>
          <span className="intro-landing-orbit-label intro-landing-orbit-label--top">GO FURTHER</span>
          <span className="intro-landing-orbit-label intro-landing-orbit-label--bottom">TOGETHER</span>
          <i className="intro-landing-orbit-dot intro-landing-orbit-dot--one" />
          <i className="intro-landing-orbit-dot intro-landing-orbit-dot--two" />
        </motion.aside>

        <div className="intro-landing-index" aria-hidden="true"><span>01</span><i /> A WORLD OF STORIES</div>
      </section>

      <footer className="intro-landing-footer">
        <span>DISCOVER DESTINATIONS</span><i />
        <span>SHARE YOUR JOURNEY</span><i />
        <span>FIND YOUR PEOPLE</span>
      </footer>
    </main>
  );
}
