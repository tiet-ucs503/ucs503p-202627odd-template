// The characters that appear in a battle: their artwork and colours.
// The animated image is the character; effects are drawn around it, never over it.
// Full class names are written out so Tailwind can see them at build time.

export interface Character {
  id: string;
  name: string;
  /** Mission number shown in the battle header (villains only). */
  index: number;
  image: string;
  /** Which part of the image stays in view when it is cropped to the portrait. */
  focus: string;
  text: string;
  border: string;
  bg: string;
  health: string;
  /** Glow colour around the portrait, as "r,g,b". */
  glow: string;
}

export const SPIDERMAN: Character = {
  id: 'spiderman', name: 'SPIDER-MAN', index: 0, image: '/spiderman-gif.gif', focus: 'center',
  text: 'text-white', border: 'border-hero-600', bg: 'bg-hero-950/50',
  health: 'from-red-700 via-hero-500 to-red-400', glow: '220,38,38',
};

export const VILLAIN_CHARACTERS: Record<string, Character> = {
  goblin: {
    id: 'goblin', name: 'GREEN GOBLIN', index: 1, image: '/goblin-gif.gif', focus: 'center',
    text: 'text-green-400', border: 'border-green-500', bg: 'bg-green-950/50',
    health: 'from-green-700 via-green-500 to-green-300', glow: '34,197,94',
  },
  'doc-ock': {
    id: 'doc-ock', name: 'DOCTOR OCTOPUS', index: 2, image: '/doc-ock-spider-man.gif', focus: 'center 25%',
    text: 'text-slate-400', border: 'border-slate-500', bg: 'bg-slate-950/50',
    health: 'from-slate-700 via-slate-500 to-slate-300', glow: '148,163,184',
  },
  mysterio: {
    id: 'mysterio', name: 'MYSTERIO', index: 3, image: '/mysterio-im-here.gif', focus: 'center 20%',
    text: 'text-purple-400', border: 'border-purple-500', bg: 'bg-purple-950/50',
    health: 'from-purple-700 via-purple-500 to-purple-300', glow: '168,85,247',
  },
  venom: {
    id: 'venom', name: 'VENOM', index: 4, image: '/venom-gif.gif', focus: 'center',
    text: 'text-slate-100', border: 'border-slate-300', bg: 'bg-black/50',
    health: 'from-black via-slate-700 to-slate-400', glow: '226,232,240',
  },
  lizard: {
    id: 'lizard', name: 'THE LIZARD', index: 5, image: '/lizard-gif.webp', focus: 'top',
    text: 'text-lime-400', border: 'border-lime-500', bg: 'bg-lime-950/50',
    health: 'from-lime-700 via-lime-500 to-lime-300', glow: '132,204,22',
  },
  kingpin: {
    id: 'kingpin', name: 'KINGPIN', index: 6, image: '/the-kingpin-wilson-fisk.gif', focus: 'top',
    text: 'text-red-500', border: 'border-red-600', bg: 'bg-red-950/50',
    health: 'from-red-800 via-red-600 to-red-400', glow: '220,38,38',
  },
};

export const villainFor = (id: string): Character => VILLAIN_CHARACTERS[id] ?? VILLAIN_CHARACTERS.goblin;
