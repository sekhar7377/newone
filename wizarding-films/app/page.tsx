import Experience from '@/components/Experience';
import { FILMS } from '@/lib/content';
import { DISCLAIMER } from '@/components/Disclaimer';

export default function Home() {
  return (
    <>
      <a className="skip" href="/archive">Skip to the text-only film archive</a>
      <h1 className="sr-only">The Wizarding Films: an unofficial cinematic fan tribute to the eight Harry Potter films</h1>
      <Experience />
      <noscript>
        <div className="archive">
          <p>The 3D journey needs JavaScript. The complete <a href="/archive">film archive</a> works without it.</p>
          <ol>{FILMS.map((f) => <li key={f.id}><a href={`/film/${f.slug}`}>{f.title}</a> ({f.year})</li>)}</ol>
          <p>{DISCLAIMER}</p>
        </div>
      </noscript>
    </>
  );
}
