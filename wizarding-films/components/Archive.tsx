import { KIND_LABEL, isPublished, type Film, type IllustrationData } from '@/lib/content';
import { SCENE_CONTENT, ILLUSTRATIONS } from '@/lib/archiveContent';

/** The same stroke data the 3D line renderer uses, drawn as a small inline SVG. */
function StrokeSvg({ ill }: { ill: IllustrationData }) {
  const pts = ill.strokes.flatMap((s) => s.p.filter((_, i) => i % 3 !== 2));
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 40, w = maxX - minX + pad * 2, h = maxY - minY + pad * 2;
  return (
    <svg viewBox={`${minX - pad} ${-maxY - pad} ${w} ${h}`} role="img" aria-label={ill.alt}>
      {ill.strokes.map((s, i) => {
        let d = '';
        for (let k = 0; k < s.p.length; k += 3) d += `${k ? 'L' : 'M'}${s.p[k]} ${-s.p[k + 1]}`;
        const avg = s.w.reduce((a, b) => a + b, 0) / s.w.length;
        return <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={(avg / 255) * 14} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </svg>
  );
}

export function FilmArchive({ film, headingLevel = 2 }: { film: Film; headingLevel?: 1 | 2 }) {
  const content = SCENE_CONTENT[film.id];
  const ills = ILLUSTRATIONS[film.id] ?? [];
  const H = headingLevel === 1 ? 'h1' : 'h2';
  const notes = content.hotspots.filter((h) => isPublished(h));
  return (
    <section className="film" id={film.slug} aria-labelledby={`${film.slug}-title`}>
      <div className="kicker">Film {film.number} · {film.year}</div>
      <H id={`${film.slug}-title`}>{film.title}</H>
      {film.altTitle && <p><em>{film.altTitle}</em></p>}
      <p>{film.summary}</p>
      <dl>
        <dt>Released</dt><dd><time dateTime={film.released}>{new Date(film.released).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</time></dd>
        <dt>Director</dt><dd>{film.director}</dd>
        <dt>In the 3D journey</dt><dd>{film.setting}</dd>
      </dl>
      <a className="enter" href={`/?scene=${film.id}`}>Enter this film in 3D →</a>
      {notes.map((h) => {
        const ill = ills.find((i) => i.hotspot === h.id && isPublished(i));
        return (
          <article className="note" key={h.id} id={h.id}>
            <div className="kicker">{KIND_LABEL[h.kind]}</div>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
            {ill && <figure><StrokeSvg ill={ill} /><figcaption>{ill.alt}</figcaption></figure>}
          </article>
        );
      })}
    </section>
  );
}
