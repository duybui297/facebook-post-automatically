'use client';

import { useState } from 'react';
import { FanpageConfig } from '@/types';

function loadSavedPages(): FanpageConfig[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const saved = localStorage.getItem('fanpages');
  return saved ? JSON.parse(saved) : [];
}

export default function Settings() {
  const [pages, setPages] = useState<FanpageConfig[]>(loadSavedPages);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [pageToken, setPageToken] = useState('');

  const saveToStorage = (newPages: FanpageConfig[]) => {
    setPages(newPages);
    localStorage.setItem('fanpages', JSON.stringify(newPages));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !pageToken) return;

    if (isEditing) {
      const updated = pages.map(p => p.id === isEditing ? { id: isEditing, name, url, pageToken } : p);
      saveToStorage(updated);
      setIsEditing(null);
    } else {
      const newPage: FanpageConfig = {
        id: Date.now().toString(),
        name,
        url,
        pageToken
      };
      saveToStorage([...pages, newPage]);
    }

    // Reset Form
    setName('');
    setUrl('');
    setPageToken('');
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
      saveToStorage(filtered);
      if (isEditing === id) {
        setIsEditing(null);
        setName('');
        setUrl('');
        setPageToken('');
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setName('');
    setUrl('');
    setPageToken('');
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '4rem 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in stagger-1">
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', letterSpacing: '-1px' }}>
          Fanpage <span className="text-gradient">Management</span>
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
          Configure your Facebook Fanpages and their Access Tokens here.
        </p>
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
              <input 
                id="name"
                type="text" 
                className="input-field" 
                placeholder="e.g. My Awesome Page"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="url">Target Facebook URL</label>
              <input 
                id="url"
                type="url" 
                className="input-field" 
                placeholder="https://facebook.com/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>

            <div className="input-group" style={{ marginBottom: '2rem' }}>
              <label className="input-label" htmlFor="token">Page Access Token</label>
              <input 
                id="token"
                type="password" 
                className="input-field" 
                placeholder="EAALZ..."
                value={pageToken}
                onChange={(e) => setPageToken(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              {isEditing && (
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCancel}>
                  Cancel
                </button>
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
              {pages.length}
            </span>
          </h2>

          {pages.length === 0 ? (
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
