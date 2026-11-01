export const DISCLAIMER = 'An unofficial fan tribute. Not affiliated with, endorsed by or connected to Warner Bros., J.K. Rowling or Wizarding World. All 3D scenes, illustrations, sound and text are original works made for this site.';

export function Disclaimer({ className }: { className?: string }) {
  return <p className={className}>{DISCLAIMER} <a href="/archive">Text-only film archive</a>.</p>;
}
