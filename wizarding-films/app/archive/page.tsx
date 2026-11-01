import type { Metadata } from 'next';
import { FILMS } from '@/lib/content';
import { FilmArchive } from '@/components/Archive';
import { Disclaimer } from '@/components/Disclaimer';

export const revalidate = 3600; // scheduled content drops appear without a redeploy
export const metadata: Metadata = { title: 'Film archive · The Wizarding Films', description: 'Facts, behind-the-scenes notes and key moments from all eight Harry Potter films, as plain text. An unofficial fan tribute.' };

export default function ArchivePage() {
  return (
    <main className="archive">
      <header>
        <h1>The film archive</h1>
        <p>Everything from the 3D journey as plain, accessible text: release details, film facts, behind-the-scenes notes and key moments from all eight films.</p>
        <p><a href="/">← Back to the 3D journey</a></p>
      </header>
      <nav aria-label="Films"><ol>{FILMS.map((f) => <li key={f.id}><a href={`#${f.slug}`}>{f.title.replace('Harry Potter and the ', '')}</a> ({f.year})</li>)}</ol></nav>
      {FILMS.map((f) => <FilmArchive key={f.id} film={f} />)}
      <footer className="site-footer"><Disclaimer /></footer>
    </main>
  );
}
