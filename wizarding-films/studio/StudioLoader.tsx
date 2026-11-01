'use client';
import dynamic from 'next/dynamic';
// The studio (and its three/examples controls) never ships with the public site.
const StudioApp = dynamic(() => import('./StudioApp'), { ssr: false, loading: () => <p style={{ padding: 24 }}>Loading studio…</p> });
export default function StudioLoader() { return <StudioApp />; }
