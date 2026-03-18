import { NextResponse } from 'next/server';

// Helper: extract 1-3 clean keywords from a long image prompt or topic
function extractKeywords(prompt: string, topic?: string): string {
  // Prioritize topic if provided, as it's the most concise user intent
  const source = topic || prompt;
  // Take first few meaningful words (skip stop words)
  const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'about', 'is', 'are', 'was', 'be', 'been', 'that', 'this', 'from', 'by', 'as', 'it', 'its']);
  const words = source
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
    .slice(0, 4);
  return words.join(',') || 'nature';
}

export async function POST(req: Request) {
  let prompt = '';
  let topic = '';
  let seed = Math.floor(Math.random() * 9999);
  let customPrompt = '';

  try {
    const body = await req.json();
    prompt = body.prompt || '';
    topic = body.topic || '';
    customPrompt = body.customPrompt || '';
    if (body.seed) seed = body.seed;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!prompt && !customPrompt && !topic) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  // --- Strategy 1: Try Imagen 3 via @google/genai (requires billing, may fail) ---
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const finalPrompt = customPrompt || prompt;

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: finalPrompt.substring(0, 480),
      config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) throw new Error('No image bytes from Imagen');

    console.log('Imagen 3 success!');
    return NextResponse.json({ imageUrl: `data:image/jpeg;base64,${imageBytes}`, source: 'imagen3' });
  } catch (imagenError: any) {
    console.warn('Imagen 3 unavailable:', imagenError?.message?.substring(0, 80));
  }

  // --- Strategy 2: Use Unsplash Source API (topic-relevant photography, proxied) ---
  try {
    // Use custom prompt keywords if provided, otherwise derive from topic/prompt
    const searchQuery = customPrompt
      ? extractKeywords(customPrompt)
      : extractKeywords(prompt, topic);
    
    // Unsplash Source API - each seed gives a different photo for the same query
    const unsplashUrl = `https://source.unsplash.com/800x800/?${encodeURIComponent(searchQuery)}&sig=${seed}`;

    const imgResponse = await fetch(unsplashUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    });

    if (!imgResponse.ok) throw new Error(`Unsplash returned HTTP ${imgResponse.status}`);
    const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
    if (!contentType.startsWith('image/')) throw new Error(`Unsplash returned non-image: ${contentType}`);

    const arrayBuffer = await imgResponse.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error('Empty image from Unsplash');

    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const finalQuery = customPrompt ? extractKeywords(customPrompt) : searchQuery;
    console.log(`Unsplash image fetched for "${finalQuery}". Bytes: ${arrayBuffer.byteLength}`);

    return NextResponse.json({
      imageUrl: `data:${contentType};base64,${base64}`,
      source: 'unsplash',
      query: finalQuery
    });
  } catch (unsplashError: any) {
    console.warn('Unsplash failed:', unsplashError?.message);
  }

  // --- Strategy 3: Picsum fallback (random but always works) ---
  try {
    const picsumUrl = `https://picsum.photos/seed/${seed}/800/800`;
    const picsumRes = await fetch(picsumUrl, { redirect: 'follow' });
    if (picsumRes.ok) {
      const arrayBuffer = await picsumRes.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return NextResponse.json({
          imageUrl: `data:image/jpeg;base64,${base64}`,
          source: 'picsum'
        });
      }
    }
  } catch (picsumError: any) {
    console.warn('Picsum failed:', picsumError?.message);
  }

  return NextResponse.json({ error: 'All image generation strategies failed' }, { status: 500 });
}
