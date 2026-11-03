/**
 * Who took each photograph the app shows, and under what licence.
 *
 * All of them are from Wikimedia Commons and free to use with a credit, which
 * is what the `/credits` page gives. The same list, with the file names, is in
 * `public/images/CREDITS.md` for anyone reading the repository; a test checks
 * the two agree.
 */
export interface PhotoCredit {
  /** File name under `public/images/destinations`, without the extension. */
  slug: string;
  /** What the picture is of, for people reading the list. */
  subject: string;
  photographer: string;
  licence: string;
  licenceUrl: string;
  /** Where the original is, on Wikimedia Commons. */
  sourceUrl: string;
}

const CC = "https://creativecommons.org";

export const PHOTO_CREDITS: PhotoCredit[] = [
  {
    slug: "thailand",
    subject: "Koh Phi Phi, Thailand",
    photographer: "Luxure",
    licence: "CC BY 3.0 AU",
    licenceUrl: `${CC}/licenses/by/3.0/au/`,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:KohPhiPhi.JPG",
  },
  {
    slug: "bali",
    subject: "Rice terraces, East Bali",
    photographer: "Vyacheslav Argenberg",
    licence: "CC BY 4.0",
    licenceUrl: `${CC}/licenses/by/4.0/`,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Bali,_Rice_fields_in_the_forest,_East_Bali,_Indonesia.jpg",
  },
  {
    slug: "italy",
    subject: "Manarola, Cinque Terre",
    photographer: "Anyul Rivas",
    licence: "CC BY 2.0",
    licenceUrl: `${CC}/licenses/by/2.0/`,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Cinque_Terre_-_Manarola.jpg",
  },
  {
    slug: "japan",
    subject: "Mount Fuji from Lake Kawaguchiko",
    photographer: "Midori",
    licence: "CC BY 3.0",
    licenceUrl: `${CC}/licenses/by/3.0/`,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Lake_Kawaguchiko_Sakura_Mount_Fuji_3.JPG",
  },
  {
    slug: "goa",
    subject: "Mandrem Beach, Goa",
    photographer: "Vyacheslav Argenberg",
    licence: "CC BY 4.0",
    licenceUrl: `${CC}/licenses/by/4.0/`,
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Mandrem_Beach,_Goa,_India.jpg",
  },
  {
    slug: "portugal",
    subject: "The Douro at Porto",
    photographer: "flowcomm",
    licence: "CC BY 2.0",
    licenceUrl: `${CC}/licenses/by/2.0/`,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Douro_River,_Porto,_Portugal_(53973584942).jpg",
  },
  {
    slug: "plan",
    subject: "Lake Louise at sunrise, Alberta",
    photographer: "TerryDOtt",
    licence: "CC BY 2.0",
    licenceUrl: `${CC}/licenses/by/2.0/`,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sunrise_Reflections_-_Lake_Louise,_Alberta,_Canada.jpg",
  },
  {
    slug: "travis",
    subject: "A coastline from a plane window",
    photographer: "CAPTAIN RAJU",
    licence: "CC0",
    licenceUrl: `${CC}/publicdomain/zero/1.0/`,
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sky_Aerial_View_From_Airplane_Window_(Dhaka_to_Addis_Ababa)_in_2025.01.jpg",
  },
  {
    slug: "elsewhere",
    subject: "Sunrise on Yellowstone Lake",
    photographer: "Yellowstone National Park",
    licence: "Public domain",
    licenceUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sunrise_on_Yellowstone_Lake_(Flat_Mountain_Arm)_(32985162453).jpg",
  },
];
