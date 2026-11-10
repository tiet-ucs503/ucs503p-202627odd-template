import { ArrowRight, Check } from 'lucide-react';
import Reveal from '@/components/Reveal';

const perks = ['Free 14-day trial', 'No credit card needed', 'Cancel anytime'];

export default function CTA() {
  return (
    <section id="cta" className="relative py-24 bg-ink-900 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-hero-600/20 via-transparent to-hero-600/10" />
      <div className="absolute inset-0 halftone opacity-40" />

      <Reveal className="relative max-w-3xl mx-auto px-5 sm:px-8 text-center">
        <span className="inline-block px-4 py-1.5 rounded-full bg-hero-600 text-white font-comic text-lg tracking-wide comic-shadow hover:scale-105 hover:rotate-2 transition-transform cursor-default">
          THWIP! Your Adventure Starts Now
        </span>

        <h2 className="mt-6 font-comic text-4xl sm:text-6xl text-white tracking-wide leading-tight">
          Ready to Unleash Your
          <span className="block text-hero-500 text-stroke">Spider-Sense?</span>
        </h2>

        <p className="mt-5 text-gray-300 text-lg max-w-xl mx-auto">
          Join thousands of students turning math anxiety into math confidence — one web-slinging mission at a time.
        </p>

        <form
          className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="Enter your email"
            className="flex-1 px-5 py-3.5 rounded-xl bg-ink-800 border border-white/15 text-white placeholder:text-gray-500 focus:outline-none focus:border-hero-500 transition-colors"
          />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-hero-600 hover:bg-hero-500 text-white font-bold rounded-xl comic-shadow transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            Start Free
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {perks.map((p, i) => (
            <span key={p} className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-hero-400 transition-colors" style={{ animationDelay: `${i * 100}ms` }}>
              <Check className="w-4 h-4 text-hero-400" /> {p}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
