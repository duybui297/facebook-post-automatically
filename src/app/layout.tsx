import type { Metadata } from 'next';
import './globals.css';

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
              <span className="text-gradient">AI</span> Poster
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="#" style={{ fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 500 }}>Dashboard</a>
              <a href="#" style={{ fontSize: '0.875rem', color: 'var(--muted)', fontWeight: 500 }}>Settings</a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
