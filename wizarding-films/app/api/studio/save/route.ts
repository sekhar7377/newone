import { NextResponse } from 'next/server';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Studio "save to CMS". Writes JSON into /content, in development only:
 * production deployments are read-only, and the studio falls back to a download.
 */
const SCENE = /^(hub|film-[1-8])$/;
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'Saving is only enabled in development (npm run dev). Use Download instead.' }, { status: 403 });
  const { scene, kind, data } = await req.json();
  if (!SCENE.test(scene) || (kind !== 'scene' && kind !== 'illustrations')) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const file = path.join(process.cwd(), 'content', kind === 'scene' ? 'scenes' : 'illustrations', `${scene}.json`);
  await writeFile(file, JSON.stringify(data, null, 1) + '\n');
  return NextResponse.json({ ok: true, file: path.relative(process.cwd(), file) });
}
