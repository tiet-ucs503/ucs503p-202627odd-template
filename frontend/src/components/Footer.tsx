export default function Footer() {
  return (
    <footer className="bg-ink-900 border-t border-white/10 pt-10 pb-12">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div>
          <span className="font-comic text-2xl tracking-wide text-white">
            Math<span className="text-hero-500">Verse</span>
          </span>
          <p className="text-sm text-gray-400 max-w-md mt-2">
            Maths practice as superhero boss battles: six topics, questions that adapt to how well you know each
            one, and progress reports for parents and teachers.
          </p>
        </div>
        <div className="text-xs text-gray-500 max-w-md leading-relaxed">
          <p>
            A student project for UCS503P Software Engineering, Thapar Institute of Engineering and Technology.
          </p>
          <p className="mt-2">
            The camera is optional and works only inside your browser. No pictures or video are stored or sent.
          </p>
          <p className="mt-2">
            Spider-Man and related characters belong to Marvel. They appear here in a non-commercial course
            project and this site is not affiliated with or endorsed by Marvel.
          </p>
        </div>
      </div>
    </footer>
  );
}
