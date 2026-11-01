// Server-side access to all scene content for the HTML archive (never shipped to the client bundle).
import type { IllustrationData, SceneContent } from './content';
import s1 from '@/content/scenes/film-1.json'; import s2 from '@/content/scenes/film-2.json'; import s3 from '@/content/scenes/film-3.json'; import s4 from '@/content/scenes/film-4.json';
import s5 from '@/content/scenes/film-5.json'; import s6 from '@/content/scenes/film-6.json'; import s7 from '@/content/scenes/film-7.json'; import s8 from '@/content/scenes/film-8.json';
import i1 from '@/content/illustrations/film-1.json'; import i2 from '@/content/illustrations/film-2.json'; import i3 from '@/content/illustrations/film-3.json'; import i4 from '@/content/illustrations/film-4.json';
import i5 from '@/content/illustrations/film-5.json'; import i6 from '@/content/illustrations/film-6.json'; import i7 from '@/content/illustrations/film-7.json'; import i8 from '@/content/illustrations/film-8.json';

export const SCENE_CONTENT: Record<string, SceneContent> = { 'film-1': s1, 'film-2': s2, 'film-3': s3, 'film-4': s4, 'film-5': s5, 'film-6': s6, 'film-7': s7, 'film-8': s8 } as unknown as Record<string, SceneContent>;
export const ILLUSTRATIONS: Record<string, IllustrationData[]> = { 'film-1': i1, 'film-2': i2, 'film-3': i3, 'film-4': i4, 'film-5': i5, 'film-6': i6, 'film-7': i7, 'film-8': i8 } as unknown as Record<string, IllustrationData[]>;
