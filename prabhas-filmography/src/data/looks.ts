import type { LookImage } from './types';

/**
 * Photos of Prabhas tied to individual films, keyed by film id.
 *
 * Only freely licensed photographs from Wikimedia Commons are used, each with
 * its credit and licence (shown under the image). Film stills and posters are
 * owned by the studios and are not included. Images are resized copies; see
 * ASSETS.md. Films without an entry show the typographic title card.
 */
const BH = 'Bollywood Hungama, via Wikimedia Commons';

export const LOOKS: Partial<Record<string, LookImage>> = {
  'ek-niranjan': {
    src: 'looks/ek-niranjan.jpg',
    alt: 'Prabhas in 2009',
    caption: 'At the Ek Niranjan audio launch, Hyderabad, 25 September 2009',
    credit: 'Dammiadejonwo, via Wikimedia Commons',
    licence: 'Public domain',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Prabhas_2009.jpg',
  },
  'baahubali-2': {
    src: 'looks/baahubali-2.jpg',
    alt: 'Prabhas in costume on set with Sathyaraj and S. S. Rajamouli',
    caption: 'In costume on the set of Baahubali 2, with Sathyaraj and director S. S. Rajamouli',
    credit: BH,
    licence: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Prabhas_and_Sathyaraj_filming_Bahubali_the_Conclusion.jpg',
  },
  saaho: {
    src: 'looks/saaho.jpg',
    alt: 'Prabhas at a Saaho press event',
    caption: 'At a Saaho press event, 2019',
    credit: BH,
    licence: 'CC BY 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Prabhas_at_Saaho_Pre_release_event_(cropped).jpg',
  },
  'kalki-2898-ad': {
    src: 'looks/kalki-2898-ad.jpg',
    alt: 'Prabhas speaking on stage at San Diego Comic-Con',
    caption: 'At San Diego Comic-Con, 20 July 2023, where the film (then Project K) was unveiled',
    credit: 'Gage Skidmore, via Wikimedia Commons',
    licence: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Prabhas_by_Gage_Skidmore.jpg',
  },
};
