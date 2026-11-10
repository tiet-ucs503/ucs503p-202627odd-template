import { Gamepad2, BookOpen, Trophy, Rocket } from 'lucide-react';
import Reveal from '@/components/Reveal';

const steps = [
  {
    icon: Gamepad2,
    title: 'Mission Briefing',
    text: 'Receive emergency transmissions from J. Jonah Jameson or intel from Gwen Stacy. Understand the threat and your objectives before swinging in.',
  },
  {
    icon: BookOpen,
    title: 'Math Challenge',
    text: 'Engage villains in high-stakes combat. Use your intelligence to solve multiple-choice and fill-in-the-blank puzzles to weaken their defenses.',
  },
  {
    icon: Trophy,
    title: 'Complete Objective',
    text: 'Outsmart the villain with a correct sequence of answers to save the city, restore systems, or break illusions.',
  },
  {
    icon: Rocket,
    title: 'Unlock Rewards',
    text: "Earn Spider Points to unlock rare Spider-Suits, upgrade your web-shooters, and boost your Spider-Sense Level.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 halftone opacity-40" />
      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <Reveal className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-hero-500 font-comic text-xl tracking-wide">Gameplay Loop</span>
          <h2 className="mt-2 font-comic text-4xl sm:text-5xl text-white tracking-wide">
            How to Save the City
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 100} className="relative">
              {/* connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 border-t-2 border-dashed border-hero-600/30" />
              )}
              <div className="relative bg-ink-800 rounded-2xl border border-white/10 p-6 hover:border-hero-600/40 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <span className="grid place-items-center w-12 h-12 rounded-xl bg-hero-600 text-white comic-shadow shrink-0 group-hover:animate-wiggle">
                    <s.icon className="w-6 h-6" />
                  </span>
                  <span className="font-comic text-4xl text-hero-600/40">{i + 1}</span>
                </div>
                <h3 className="font-comic text-2xl text-white tracking-wide">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
