'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FanpageConfig } from '@/types';

type Step = 'idle' | 'crawling' | 'generating' | 'generating_images' | 'review' | 'publishing' | 'success';

interface ImageSlot {
  url: string;
  loading: boolean;
  error: boolean;
}

export default function Home() {
  const [pages, setPages] = useState<FanpageConfig[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState<number | ''>(200);
  const [imageCount, setImageCount] = useState<number>(1);
  const [step, setStep] = useState<Step>('idle');
  
  const [postText, setPostText] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('fanpages');
    if (saved) {
      const parsedPages = JSON.parse(saved);
      setPages(parsedPages);
      if (parsedPages.length > 0) {
        setSelectedPageId(parsedPages[0].id);
      }
    }
  }, []);

  const generateSingleImage = useCallback(async (prompt: string, index: number) => {
    setImages(prev => {
      const updated = [...prev];
      updated[index] = { url: '', loading: true, error: false };
      return updated;
    });
    try {
      const seed = Math.floor(Math.random() * 999999);
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, seed })
      });
      if (!res.ok) throw new Error('API call failed');
      const data = await res.json();
      setImages(prev => {
        const updated = [...prev];
        updated[index] = { url: data.imageUrl, loading: false, error: false };
        return updated;
      });
    } catch {
      setImages(prev => {
        const updated = [...prev];
        updated[index] = { url: '', loading: false, error: true };
        return updated;
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedPage = pages.find(p => p.id === selectedPageId);
    if (!selectedPage || !topic) return;
    
    setStep('crawling');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: selectedPage.url, topic, wordCount: wordCount || 200 })
      });

      if (!response.ok) throw new Error('Failed to generate content');
      
      setStep('generating');
      const data = await response.json();
      setPostText(data.text);
      setImagePrompt(data.imagePrompt);

      // Now generate all images in parallel
      setStep('generating_images');
      const slots: ImageSlot[] = Array.from({ length: imageCount }, () => ({ url: '', loading: true, error: false }));
      setImages(slots);
      setSelectedImageIndex(0);

      // Generate all images in parallel
      await Promise.all(
        Array.from({ length: imageCount }, (_, i) => generateSingleImage(data.imagePrompt, i))
      );

      setStep('review');
    } catch (error) {
      console.error(error);
      alert('Error generating content. Please check API keys.');
      setStep('idle');
    }
  };

  const handlePublish = async () => {
    const selectedPage = pages.find(p => p.id === selectedPageId);
    if (!selectedPage?.pageToken) {
      alert('Missing Page Access Token. Please update it in Settings.');
      return;
    }
    const chosenImage = images[selectedImageIndex];
    
    setStep('publishing');
    
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: postText, 
          imageUrl: chosenImage?.url || '',
          pageToken: selectedPage.pageToken 
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to publish');
      }

      setStep('success');
    } catch (error: any) {
      alert('Error publishing to Facebook: ' + error.message);
      setStep('review');
    }
  };

  const handleReset = () => {
    setStep('idle');
    setPostText('');
    setImages([]);
    setImagePrompt('');
    setTopic('');
    setSelectedImageIndex(0);
  };

  const processingStep = step === 'crawling' || step === 'generating' || step === 'generating_images' || step === 'publishing';

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '4rem 0' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '3rem' }} className="animate-fade-in stagger-1">
        <h1 style={{ fontSize: step === 'idle' ? '3.5rem' : '2.5rem', marginBottom: '1rem', letterSpacing: '-1px', transition: 'all 0.5s ease' }}>
          Automate Your <span className="text-gradient">Facebook Presence</span>
        </h1>
        {step === 'idle' && (
          <p style={{ color: 'var(--muted)', fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
            Instantly crawl trending content from any fanpage and generate ready-to-post AI content tailored to your audience.
          </p>
        )}
      </div>

      <div style={{ maxWidth: step === 'review' ? '1000px' : '560px', width: '100%', margin: '0 auto', transition: 'max-width 0.5s ease' }}>
        
        {/* IDLE - Form */}
        {step === 'idle' && (
          <div className="glass-panel animate-fade-in stagger-2" style={{ padding: '2.5rem' }}>
            <form onSubmit={handleSubmit}>
              
              <div className="input-group">
                <label className="input-label" htmlFor="fanpage" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Target Fanpage</span>
                  <Link href="/settings" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Manage Pages</Link>
                </label>
                {pages.length === 0 ? (
                  <div style={{ padding: '1rem', background: 'rgba(255,0,0,0.1)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', color: 'var(--accent)', textAlign: 'center' }}>
                    Please <Link href="/settings" style={{ textDecoration: 'underline', fontWeight: 'bold' }}>add a Fanpage</Link> in settings first.
                  </div>
                ) : (
                  <select 
                    id="fanpage"
                    className="input-field" 
                    value={selectedPageId}
                    onChange={(e) => setSelectedPageId(e.target.value)}
                    required
                    style={{ appearance: 'none' }}
                  >
                    {pages.map(p => (
                      <option key={p.id} value={p.id} style={{ color: '#000' }}>{p.name} ({p.url})</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="input-group">
                <label className="input-label" htmlFor="topic">Content Topic</label>
                <input id="topic" type="text" className="input-field" placeholder="e.g. Technology Trends" value={topic} onChange={(e) => setTopic(e.target.value)} required disabled={pages.length === 0} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="input-group" style={{ marginBottom: '2rem' }}>
                  <label className="input-label" htmlFor="wordCount">Target Word Count</label>
                  <input id="wordCount" type="number" min="50" max="2000" className="input-field" placeholder="e.g. 200" value={wordCount} onChange={(e) => setWordCount(parseInt(e.target.value) || '')} required disabled={pages.length === 0} />
                </div>
                <div className="input-group" style={{ marginBottom: '2rem' }}>
                  <label className="input-label" htmlFor="imageCount">Number of Images (max 4)</label>
                  <select id="imageCount" className="input-field" value={imageCount} onChange={(e) => setImageCount(parseInt(e.target.value))} disabled={pages.length === 0} style={{ appearance: 'none' }}>
                    {[1, 2, 3, 4].map(n => (
                      <option key={n} value={n} style={{ color: '#000' }}>{n} image{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem', opacity: pages.length === 0 ? 0.5 : 1 }} disabled={pages.length === 0}>
                Start AI Engine
              </button>
            </form>
          </div>
        )}

        {/* PROCESSING */}
        {processingStep && (
          <div className="glass-panel animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
              <div className="loader-spinner" style={{ width: '30px', height: '30px', borderTopColor: 'var(--primary)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderWidth: '3px' }}></div>
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {step === 'crawling' && 'Crawling Fanpage Data...'}
              {step === 'generating' && 'AI Writing Your Post...'}
              {step === 'generating_images' && `AI Generating ${imageCount} Image${imageCount > 1 ? 's' : ''} with Imagen 2...`}
              {step === 'publishing' && 'Publishing to Facebook...'}
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: '400px', margin: '0 auto' }}>
              {step === 'crawling' && 'Analyzing the latest trending posts and extracting key engagement metrics.'}
              {step === 'generating' && 'Using Gemini to write compelling, emoji-rich copy in your target word count.'}
              {step === 'generating_images' && 'Calling Google Imagen 2 to generate high-quality unique images for your post.'}
              {step === 'publishing' && 'Sending your newly minted content straight to your Facebook page.'}
            </p>
          </div>
        )}

        {/* REVIEW */}
        {step === 'review' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* Left: Text Editor */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--primary)' }}>✨</span> AI Generated Text
              </h3>
              <textarea 
                className="input-field" 
                style={{ flex: 1, minHeight: '300px', resize: 'vertical', lineHeight: '1.6' }}
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
              />
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('idle')}>Discard</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePublish}>🚀 Publish to Facebook</button>
              </div>
            </div>

            {/* Right: Image Panel */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: 'var(--secondary)' }}>🎨</span> AI Generated Images
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Click to select</span>
              </h3>

              {/* Image Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: images.length <= 1 ? '1fr' : '1fr 1fr', gap: '0.75rem', flex: 1 }}>
                {images.map((img, i) => (
                  <div
                    key={i}
                    onClick={() => !img.loading && !img.error && setSelectedImageIndex(i)}
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      border: `2px solid ${selectedImageIndex === i ? 'var(--primary)' : 'var(--border)'}`,
                      background: 'var(--surface)',
                      aspectRatio: '1/1',
                      cursor: img.loading || img.error ? 'default' : 'pointer',
                      transition: 'border-color 0.2s',
                      boxShadow: selectedImageIndex === i ? '0 0 12px rgba(99, 102, 241, 0.4)' : 'none'
                    }}
                  >
                    {img.loading ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <div className="loader-spinner" style={{ width: '24px', height: '24px', borderTopColor: 'var(--primary)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderWidth: '3px' }}></div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Generating...</span>
                      </div>
                    ) : img.error ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '2rem' }}>⚠️</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Generation failed</span>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.url} alt={`Generated ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}

                    {/* Selected badge */}
                    {selectedImageIndex === i && !img.loading && !img.error && (
                      <div style={{ position: 'absolute', top: '0.4rem', left: '0.4rem', background: 'var(--primary)', borderRadius: '999px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>
                        ✓ Selected
                      </div>
                    )}

                    {/* Refresh button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); generateSingleImage(imagePrompt, i); }}
                      disabled={img.loading}
                      style={{
                        position: 'absolute', bottom: '0.4rem', right: '0.4rem',
                        background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '999px', color: '#fff', cursor: img.loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex',
                        alignItems: 'center', gap: '0.25rem', backdropFilter: 'blur(4px)',
                        opacity: img.loading ? 0.5 : 1
                      }}
                      title="Regenerate this image"
                    >
                      🔄 Refresh
                    </button>
                  </div>
                ))}
              </div>

              <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                Powered by Google Imagen 2 · Select the image to publish
              </p>
            </div>
          </div>
        )}

        {/* SUCCESS */}
        {step === 'success' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2.5rem', boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
              ✅
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--secondary)' }}>Post Published Successfully!</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '2.5rem' }}>
              Your AI-generated content is now live on Facebook. Optimized for maximum engagement.
            </p>
            <button className="btn btn-primary" onClick={handleReset}>Create Another Post</button>
          </div>
        )}
        
      </div>
    </div>
  );
}
