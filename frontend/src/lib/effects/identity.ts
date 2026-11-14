// What makes each character's sound its own.
//
// A character is not "the same sound at a different pitch". Each differs from
// every other in at least three of these five ways, and a test checks both
// that, and that each character's recipes really are built the way this says.

export interface SoundIdentity {
  /** How the sound is made. */
  timbre: string;
  /** Roughly how high or low it sits. */
  register: 'very-low' | 'low-mid' | 'mid' | 'mid-high' | 'high';
  /** Its shape over time. */
  envelope: string;
  /** Its signature rhythm. */
  rhythm: string;
  /** Where it sits between the speakers, and how much echo it carries. */
  space: string;
  /** The start of this character's recipe names. */
  recipePrefix: string;
}

export const IDENTITY: Record<string, SoundIdentity> = {
  spiderman: {
    timbre: 'filtered noise snap with a plucked tone',
    register: 'mid-high',
    envelope: 'instant attack, short tail',
    rhythm: 'single snap',
    space: 'left, dry',
    recipePrefix: 'spidey-',
  },
  goblin: {
    timbre: 'sawtooth with fast wobble and ring modulation',
    register: 'mid',
    envelope: 'swells in, cuts off',
    rhythm: 'three-chirp cackle',
    space: 'right, light echo',
    recipePrefix: 'goblin-',
  },
  'doc-ock': {
    timbre: 'square clicks and metallic FM',
    register: 'low-mid',
    envelope: 'sharp click, ringing tail',
    rhythm: 'even four-beat servo pulse',
    space: 'right, dry and close',
    recipePrefix: 'ock-',
  },
  mysterio: {
    timbre: 'pure tones slightly out of tune with each other',
    register: 'mid',
    envelope: 'slow swell, long shimmer',
    rhythm: 'no beat, drifting',
    space: 'wide, heavy echo',
    recipePrefix: 'mysterio-',
  },
  venom: {
    timbre: 'sub-bass under dark noise with a sliding filter',
    register: 'very-low',
    envelope: 'slow growl, sudden snap',
    rhythm: 'one long gesture',
    space: 'right, dark, no echo',
    recipePrefix: 'venom-',
  },
  lizard: {
    timbre: 'high-passed noise hiss and a broadband crack',
    register: 'high',
    envelope: 'hiss builds, crack is instant',
    rhythm: 'hiss, pause, crack',
    space: 'right, thin and dry',
    recipePrefix: 'lizard-',
  },
  kingpin: {
    timbre: 'pitch-dropping thud with a wooden click',
    register: 'very-low',
    envelope: 'hard hit, short boom',
    rhythm: 'one or two slow, deliberate beats',
    space: 'centre-right, big echoing room',
    recipePrefix: 'kingpin-',
  },
};

export const IDENTITY_FIELDS = ['timbre', 'register', 'envelope', 'rhythm', 'space'] as const;
