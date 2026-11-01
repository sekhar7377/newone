// Entry for the static preview build (scripts/build-preview.mjs): the 3D
// experience alone, no Next.js server. Archive and studio need `npm start`.
import { createRoot } from 'react-dom/client';
import Experience from '@/components/Experience';

createRoot(document.getElementById('root')!).render(<Experience />);
