import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], style: ['normal', 'italic'], variable: '--font-display', display: 'swap' });
const ui = Inter({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: 'The Wizarding Films: A Cinematic Journey',
  description: 'An unofficial fan tribute: fly through eight original, stylised 3D scenes inspired by the eight Harry Potter films, with facts, behind-the-scenes notes and hand-drawn illustrations.',
  openGraph: { title: 'The Wizarding Films: A Cinematic Journey', description: 'An unofficial, immersive fan tribute to the eight films.', type: 'website' },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: '#05070f', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${display.variable} ${ui.variable}`}>
      <body>{children}</body>
    </html>
  );
}
