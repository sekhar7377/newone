import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FILMS, filmBySlug } from '@/lib/content';
import { FilmArchive } from '@/components/Archive';
import { Disclaimer } from '@/components/Disclaimer';

export const revalidate = 3600;
export function generateStaticParams() { return FILMS.map((f) => ({ slug: f.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const f = filmBySlug((await params).slug);
  return f ? { title: `${f.title} (${f.year}) · The Wizarding Films`, description: `${f.tagline} Facts and behind-the-scenes notes from the ${f.year} film directed by ${f.director}. An unofficial fan tribute.` } : {};
}

export default async function FilmPage({ params }: { params: Promise<{ slug: string }> }) {
  const film = filmBySlug((await params).slug);
  if (!film) notFound();
  const i = FILMS.indexOf(film);
  return (
    <main className="archive">
      <p><a href="/archive">← All films</a></p>
      <FilmArchive film={film} headingLevel={1} />
      <nav aria-label="More films" style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between' }}>
        {i > 0 ? <a href={`/film/${FILMS[i - 1].slug}`}>← {FILMS[i - 1].title.replace('Harry Potter and the ', '')}</a> : <span />}
        {i < FILMS.length - 1 && <a href={`/film/${FILMS[i + 1].slug}`}>{FILMS[i + 1].title.replace('Harry Potter and the ', '')} →</a>}
      </nav>
      <footer className="site-footer"><Disclaimer /></footer>
    </main>
  );
}
