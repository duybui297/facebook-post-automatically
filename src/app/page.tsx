'use client';

import { useState } from 'react';

type Step = 'idle' | 'crawling' | 'generating' | 'review' | 'publishing' | 'success';

interface GeneratedPost {
  text: string;
  imageUrl: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [topic, setTopic] = useState('');
  const [step, setStep] = useState<Step>('idle');
  
  const [post, setPost] = useState<GeneratedPost | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !topic) return;
    
    setStep('crawling');
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, topic })
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      setStep('generating');
      const data = await response.json();
      
      setPost({
        text: data.text,
        imageUrl: data.imageUrl
      });
      
      setStep('review');
    } catch (error) {
      console.error(error);
      alert('Error generating content. Please check API keys.');
      setStep('idle');
    }
  };

  const handlePublish = async () => {
    if (!post) return;
    setStep('publishing');
    
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: post.text, imageUrl: post.imageUrl })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to publish');
      }

      setStep('success');
    } catch (error: any) {
      console.error(error);
      alert('Error publishing to Facebook: ' + error.message);
      setStep('review');
    }
  };

  const handleReset = () => {
    setStep('idle');
    setPost(null);
    setUrl('');
    setTopic('');
  };

  return (
    <div className="container" style={{ minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '4rem 0' }}>
      
      {/* Header for all steps */}
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

      <div style={{ maxWidth: step === 'review' ? '900px' : '560px', width: '100%', margin: '0 auto', transition: 'max-width 0.5s ease' }}>
        
        {/* Step: IDLE (Inputs) */}
        {step === 'idle' && (
          <div className="glass-panel animate-fade-in stagger-2" style={{ padding: '2.5rem' }}>
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label className="input-label" htmlFor="fanpageUrl">Target Fanpage URL</label>
                <input 
                  id="fanpageUrl"
                  type="url" 
                  className="input-field" 
                  placeholder="https://facebook.com/example"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: '2rem' }}>
                <label className="input-label" htmlFor="topic">Content Topic</label>
                <input 
                  id="topic"
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Technology Trends"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1.125rem' }}>
                Start AI Engine
              </button>
            </form>
          </div>
        )}

        {/* Step: PROCESSING (Crawling/Generating/Publishing) */}
        {(step === 'crawling' || step === 'generating' || step === 'publishing') && (
          <div className="glass-panel animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(79, 70, 229, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
              <div className="loader-spinner" style={{ width: '30px', height: '30px', borderTopColor: 'var(--primary)', borderRightColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: 'transparent', borderWidth: '3px' }}></div>
            </div>
            
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              {step === 'crawling' && 'Crawling Fanpage Data...'}
              {step === 'generating' && 'AI Generating Post & Image...'}
              {step === 'publishing' && 'Publishing to Facebook...'}
            </h2>
            
            <p style={{ color: 'var(--muted)', maxWidth: '400px', margin: '0 auto' }}>
              {step === 'crawling' && 'Analyzing the latest trending posts and extracting key engagement metrics.'}
              {step === 'generating' && 'Using advanced LLMs to write compelling copy and DALL-E 3 for stunning visuals.'}
              {step === 'publishing' && 'Sending your newly minted content straight to your Facebook page.'}
            </p>
          </div>
        )}

        {/* Step: REVIEW (Show generated content) */}
        {step === 'review' && post && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* Left: Editor/Text */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--primary)' }}>✨</span> AI Generated Text
              </h3>
              <textarea 
                className="input-field" 
                style={{ flex: 1, minHeight: '300px', resize: 'vertical', lineHeight: '1.6' }}
                value={post.text}
                onChange={(e) => setPost({...post, text: e.target.value})}
              />
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('idle')}>Discard</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handlePublish}>🚀 Publish to Facebook</button>
              </div>
            </div>

            {/* Right: Image Preview */}
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--secondary)' }}>🎨</span> AI Generated Image
              </h3>
              <div style={{ flex: 1, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--surface)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={post.imageUrl} alt="AI Generated" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                Image generated based on topic: <strong>{topic}</strong>
              </p>
            </div>
            
          </div>
        )}

        {/* Step: SUCCESS */}
        {step === 'success' && (
          <div className="glass-panel animate-fade-in" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2.5rem', boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)' }}>
              ✅
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--secondary)' }}>Post Published Successfully!</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '2.5rem' }}>
              Your AI-generated content is now live on Facebook. It is optimized for maximum engagement.
            </p>
            <button className="btn btn-primary" onClick={handleReset}>
              Create Another Post
            </button>
          </div>
        )}
        
      </div>
    </div>
  );
}
