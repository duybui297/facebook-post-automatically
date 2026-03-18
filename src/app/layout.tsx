import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Auto-Poster | Facebook',
  description: 'Automated Facebook content creation using AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="bg-mesh"></div>
        <nav style={{ padding: '1.5rem 0', borderBottom: '1px solid var(--border)' }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
              <Link href="/"><span className="text-gradient">AI</span> Poster</Link>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <Link href="/" style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 500 }} className="hover:text-primary transition-colors">Dashboard</Link>
              <Link href="/settings" style={{ fontSize: '0.9rem', color: 'var(--foreground)', fontWeight: 500 }} className="hover:text-primary transition-colors">Settings</Link>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
