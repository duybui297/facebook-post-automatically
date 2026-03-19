'use client';

import { useState, useEffect } from 'react';
import { FanpageConfig } from '@/types';

function loadLocalPages(): FanpageConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem('fanpages');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLocalPages(pages: FanpageConfig[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('fanpages', JSON.stringify(pages));
}

export default function Settings() {
  const [pages, setPages] = useState<FanpageConfig[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [pageToken, setPageToken] = useState('');

  // On mount: load from server env var first, then merge with localStorage
  useEffect(() => {
    async function loadPages() {
      try {
        const res = await fetch('/api/pages');
        const data = await res.json();
        const serverPages: FanpageConfig[] = data.pages || [];
        const localPages = loadLocalPages();

        // Merge: server pages are base; local pages override if they share a name/url
        const merged = [...serverPages];
        for (const local of localPages) {
          const existsInServer = serverPages.some(s => s.id === local.id || s.url === local.url);
          if (!existsInServer) {
            merged.push(local);
          }
        }

        setPages(merged);
        // Persist merged list back to localStorage
        saveLocalPages(merged);
      } catch {
        // Fallback to just localStorage if API fails
        const localPages = loadLocalPages();
        setPages(localPages);
      } finally {
        setIsLoading(false);
      }
    }
    loadPages();
  }, []);

  const updatePages = (newPages: FanpageConfig[]) => {
    setPages(newPages);
    saveLocalPages(newPages);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !pageToken) return;

    if (isEditing) {
      const updated = pages.map(p => p.id === isEditing ? { id: isEditing, name, url, pageToken } : p);
      updatePages(updated);
      setIsEditing(null);
    } else {
      const newPage: FanpageConfig = { id: Date.now().toString(), name, url, pageToken };
      updatePages([...pages, newPage]);
    }

    setName(''); setUrl(''); setPageToken('');
  };

  const handleEdit = (page: FanpageConfig) => {
    setIsEditing(page.id);
    setName(page.name);
    setUrl(page.url);
    setPageToken(page.pageToken);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this fanpage configuration?')) {
      const filtered = pages.filter(p => p.id !== id);
      updatePages(filtered);
      if (isEditing === id) {
        setIsEditing(null);
        setName(''); setUrl(''); setPageToken('');
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setName(''); setUrl(''); setPageToken('');
  };

  // Generate the value to copy into Vercel env var
  const handleCopyEnvVar = async () => {
    const envValue = JSON.stringify(pages);
    try {
      await navigator.clipboard.writeText(envValue);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch {
      alert(`Copy this to your FANPAGES_DEFAULT env var:\n\n${envValue}`);
    }
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '4rem 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in stagger-1">
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', letterSpacing: '-1px' }}>
          Fanpage <span className="text-gradient">Management</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
          Configure your Facebook Fanpages. Pages added here are saved to your browser and can be pinned to the server via Vercel.
        </p>
      </div>

      {/* Vercel Persist Banner */}
      <div className="glass-panel animate-fade-in stagger-1" style={{ maxWidth: '1000px', margin: '0 auto 2rem', padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderLeft: '3px solid var(--primary)' }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>💾 Lưu vĩnh viễn trên Cloud</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>
            Copy danh sách fanpage hiện tại → Dán vào <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>FANPAGES_DEFAULT</code> trong Vercel Dashboard → Redeploy. Danh sách sẽ tồn tại mãi.
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleCopyEnvVar}
          disabled={pages.length === 0}
          style={{ whiteSpace: 'nowrap', minWidth: '180px' }}
        >
          {copySuccess ? '✅ Đã Copy!' : '📋 Copy Env Value'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', width: '100%', maxWidth: '1000px', margin: '0 auto' }} className="animate-fade-in stagger-2">
        
        {/* Form Column */}
        <div className="glass-panel" style={{ padding: '2.5rem', alignSelf: 'start' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>
            {isEditing ? 'Edit Fanpage' : 'Add New Fanpage'}
          </h2>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="name">Fanpage Name</label>
              <input id="name" type="text" className="input-field" placeholder="e.g. My Awesome Page" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="url">Target Facebook URL</label>
              <input id="url" type="url" className="input-field" placeholder="https://facebook.com/..." value={url} onChange={(e) => setUrl(e.target.value)} required />
            </div>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label className="input-label" htmlFor="token">Page Access Token</label>
              <input id="token" type="password" className="input-field" placeholder="EAALZ..." value={pageToken} onChange={(e) => setPageToken(e.target.value)} required />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {isEditing && (
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancel}>Cancel</button>
              )}
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                {isEditing ? 'Save Changes' : 'Add Fanpage'}
              </button>
            </div>
          </form>
        </div>

        {/* List Column */}
        <div className="glass-panel" style={{ padding: '2.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Saved Fanpages</span>
            <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500, background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.8rem', borderRadius: 'var(--radius-full)' }}>
              {isLoading ? '...' : pages.length}
            </span>
          </h2>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)' }}>⏳ Đang tải...</div>
          ) : pages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--muted)', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
              No fanpages added yet. Add your first fanpage to get started!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {pages.map((page) => (
                <div key={page.id} style={{ padding: '1.25rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s' }} className="hover:border-primary">
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem', fontSize: '1.1rem' }}>{page.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{page.url}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', paddingLeft: '1rem' }}>
                    <button onClick={() => handleEdit(page)} style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(page.id)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
