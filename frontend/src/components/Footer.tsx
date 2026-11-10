import { Instagram, Youtube, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-ink-900 border-t border-white/10 pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          <div className="lg:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">

              <span className="font-comic text-2xl tracking-wide text-white">
                Math<span className="text-hero-500">Verse</span>
              </span>
            </a>
            <p className="text-sm text-gray-400 max-w-xs">
              Gamified math adventures for grades 6–8. Powered by superhero stories, built for ADHD focus.
            </p>
          </div>

          {[
            { title: 'Platform', links: ['Spider Academy', 'Missions', 'Boss Battles', 'Rewards'] },
            { title: 'Subjects', links: ['Class 6 Math', 'Class 7 Math', 'Class 8 Math', 'CBSE Aligned'] },
            { title: 'Company', links: ['About Us', 'Blog', 'Careers', 'Contact'] },
          ].map((col) => (
            <div key={col.title}>
              <h4 className="font-semibold text-white text-sm uppercase tracking-wide mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-gray-400 hover:text-hero-400 transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">© 2026 MathVerse Heroes. All rights reserved.</p>
          <div className="flex gap-3">
            {[Instagram, Youtube, Twitter].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="grid place-items-center w-9 h-9 rounded-lg bg-ink-800 border border-white/10 text-gray-400 hover:text-hero-400 hover:border-hero-600/40 transition-all"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
