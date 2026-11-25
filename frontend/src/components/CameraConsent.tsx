import { Camera, CameraOff, ShieldCheck } from 'lucide-react';

interface CameraConsentProps {
  onEnable: () => void;
  onDecline: () => void;
}

/**
 * Shown before a student's first mission on this device. The camera never
 * starts unless "Enable camera" is chosen here or the HUD toggle is used.
 * Both choices lead to exactly the same game.
 */
export default function CameraConsent({ onEnable, onDecline }: CameraConsentProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-consent-title"
        className="max-w-lg w-full bg-ink-950/95 border border-blue-500/40 rounded-3xl p-6 sm:p-8 text-white"
      >
        <div className="w-14 h-14 rounded-2xl bg-blue-950/80 border border-blue-500/50 flex items-center justify-center mb-4">
          <Camera className="w-7 h-7 text-blue-400" />
        </div>
        <h2 id="camera-consent-title" className="font-comic text-3xl tracking-wide mb-2">
          Use your camera? It&apos;s up to you
        </h2>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          If you switch the camera on, MathVerse checks whether you are looking at the screen while you play.
          The game is exactly the same either way.
        </p>

        <ul className="space-y-2.5 text-sm text-gray-200 mb-5">
          {[
            'It works inside this browser only. No pictures or video are saved or sent anywhere.',
            'It is a rough estimate, not a medical test.',
            'It never changes your score, your points or how hard the questions are.',
            'You can switch it off at any time with the camera button during a mission.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs text-gray-400 leading-relaxed mb-6">
          For parents and teachers: only a few numbers per question are kept (for example, the share of time the
          student was facing the screen). They appear in a separate part of your dashboard. If you are a child,
          it is a good idea to ask a grown-up before switching the camera on.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <button
            onClick={onEnable}
            className="py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" /> Enable camera
          </button>
          <button
            onClick={onDecline}
            className="py-3 px-4 rounded-xl font-bold text-white bg-hero-600 hover:bg-hero-500 transition-colors flex items-center justify-center gap-2"
          >
            <CameraOff className="w-4 h-4" /> Continue without camera
          </button>
        </div>
      </div>
    </div>
  );
}
