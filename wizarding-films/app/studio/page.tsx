import type { Metadata } from 'next';
import StudioLoader from '@/studio/StudioLoader';

export const metadata: Metadata = { title: 'Studio · The Wizarding Films', robots: { index: false, follow: false } };
export default function StudioPage() { return <StudioLoader />; }
