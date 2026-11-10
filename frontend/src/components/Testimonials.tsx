import { Star, Quote } from 'lucide-react';
import Reveal from '@/components/Reveal';

const reviews = [
  {
    name: 'Priya Sharma',
    role: 'Parent of Aarav, Class 7',
    text: 'Aarav used to hate math homework. Now he asks to do "just one more mission" before bed. His test scores jumped from 62% to 89% in one term.',
    stars: 5,
  },
  {
    name: 'Rajesh Kumar',
    role: 'Father of Diya, Class 6',
    text: 'The ADHD-friendly short bursts are a game changer. Diya can focus for 10 minutes now when before it was 2. The Spider-Man stories keep her hooked.',
    stars: 5,
  },
  {
    name: 'Mrs. Anjali Verma',
    role: 'Math Teacher, Delhi Public School',
    text: 'I use MathVerse: Spider Academy as supplementary practice. Students who never participated suddenly want to solve equations to "defeat the Green Goblin." Remarkable.',
    stars: 5,
  },
];

export default function Testimonials() {
  return (
    <section id="reviews" className="relative py-24 bg-ink-800 overflow-hidden">
      <div className="absolute inset-0 halftone-red opacity-30" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-hero-500 font-comic text-xl tracking-wide">Bugle Reports</span>
          <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide">
            Parents & Teachers Love It
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <Reveal
              key={r.name}
              delay={i * 100}
              as="figure"
              className="relative rounded-2xl border border-white/10 bg-ink-900/60 p-6 hover:border-hero-600/40 hover:-translate-y-1 transition-all duration-300"
            >
              <Quote className="w-8 h-8 text-hero-600/40 mb-3" />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: r.stars }).map((_, si) => (
                  <Star key={si} className="w-4 h-4 text-hero-500 hover:scale-125 transition-transform" fill="currentColor" />
                ))}
              </div>
              <blockquote className="text-gray-300 text-sm leading-relaxed">{r.text}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="grid place-items-center w-10 h-10 rounded-full bg-hero-600/20 text-hero-400 font-bold text-sm hover:scale-110 hover:bg-hero-600 hover:text-white transition-all cursor-default">
                  {r.name.split(' ').map((n) => n[0]).join('')}
                </span>
                <div>
                  <div className="text-white font-semibold text-sm">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.role}</div>
                </div>
              </figcaption>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
