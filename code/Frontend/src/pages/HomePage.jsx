
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ConstellationGrid from '@/components/ui/constellation-grid';
import { ShieldAlert, LogIn, UserPlus, Search } from 'lucide-react';

gsap.registerPlugin(SplitText);

export default function HomePage() {
  const navigate = useNavigate();


const titleRef = useRef(null);
const descriptionRef = useRef(null);

useEffect(() => {
  let titleSplit;
  let descriptionSplit;

  const ctx = gsap.context(() => {
    gsap.set(
      [titleRef.current, descriptionRef.current],
      { opacity: 1 }
    );

    document.fonts.ready.then(() => {
      if (!titleRef.current || !descriptionRef.current) return;

      titleSplit = SplitText.create(titleRef.current, {
        type: "words,lines",
        mask: "lines",
      });

      descriptionSplit = SplitText.create(descriptionRef.current, {
        type: "words",
        aria: "hidden",
      });

      const tl = gsap.timeline();

      // First: reveal the main title
      tl.from(titleSplit.lines, {
        duration: 0.6,
        yPercent: 100,
        opacity: 0,
        stagger: 0.1,
        ease: "expo.out",
      });

      // Second: reveal the description words
      tl.from(descriptionSplit.words, {
        opacity: 0,
        duration: 0.5,
        stagger: 0.08,
        ease: "sine.out",
      }, "-=0.1");
    });
  });

  return () => {
    ctx.revert();
    titleSplit?.revert();
    descriptionSplit?.revert();
  };
}, []);



  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Background Interactive Constellation Canvas */}
      <ConstellationGrid />

      {/* Top Navigation Bar */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 md:px-12 md:py-6 bg-gradient-to-b from-slate-950/80 to-transparent backdrop-blur-xs">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
          {/* <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/10">
            <ShieldAlert className="w-6 h-6" />
          </div> */}
          <span className="text-2xl font-black tracking-tight text-white font-mono uppercase">
            VerHire
          </span>
        </div>

        {/* Auth Buttons: Login and Sign Up at the top */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-2 rounded-lg hover:bg-slate-800/50 cursor-pointer font-mono"
          >
            <LogIn className="w-4 h-4 text-cyan-400" />
            Login
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="px-3.5 py-1.5 text-sm font-semibold text-slate-950 bg-cyan-500 hover:bg-cyan-300 transition-all rounded-lg shadow-lg shadow-cyan-400/20 flex items-center gap-2 cursor-pointer font-mono uppercase tracking-wider"
          >
            <UserPlus className="w-4 h-4" />
            Sign Up
          </button>
        </div>
      </header>

      {/* Hero Content Overlay: Center Title & Short Description */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
        {/* Main Title */}
        <h1 ref={titleRef} className="text-6xl sm:text-7xl md:text-9xl font-black font-mono tracking-tighter uppercase leading-none text-white drop-shadow-2xl">
          VeriHire
        </h1>

        {/* Short Description */}
        <p ref={descriptionRef} className="animate-me mt-6 text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl font-mono leading-relaxed opacity-80 backdrop-blur-xs px-4">
          Detect, analyze, and flag fake internships before you apply. Protecting students and job seekers from scams, fee-demanding agencies, and deceptive job offers.
        </p>

        {/* Search / Verification Input Bar */}
        <div className="mt-8 w-full max-w-xl pointer-events-auto flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-700/60 shadow-2xl backdrop-blur-md focus-within:border-cyan-400/60 transition-all">
          <div className="pl-3 text-slate-400">
            <Search className="w-5 h-5 text-cyan-400" />
          </div>
          <input
            type="text"
            placeholder="Paste company URL, LinkedIn post, or offer letter link..."
            className="w-full bg-transparent px-2 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none font-mono"
          />
          <button className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider font-mono rounded-xl transition-all shadow-md cursor-pointer whitespace-nowrap">
            Verify Offer
          </button>
        </div>
      </div>
    </div>
  );
}
