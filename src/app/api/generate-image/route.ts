import { NextResponse } from 'next/server';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'about',
  'is', 'are', 'was', 'be', 'been', 'that', 'this', 'from', 'by', 'as', 'it', 'its',
  'show', 'create', 'square', 'image', 'thumbnail', 'realistic', 'bold', 'style', 'mood',
  'lighting', 'facebook', 'cover', 'photo', 'visual', 'scene'
]);

function extractKeywords(text: string, limit: number): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .filter((word, index, words) => words.indexOf(word) === index)
    .slice(0, limit);
}

function buildSearchQuery(prompt: string, topic: string, customPrompt: string): string {
  const topicKeywords = extractKeywords(topic, 4);
  const detailKeywords = extractKeywords(customPrompt || prompt, 4).filter(
    keyword => !topicKeywords.includes(keyword)
  );

  return [...topicKeywords, ...detailKeywords].slice(0, 6).join(',');
}

function buildGenerationPrompt(prompt: string, topic: string, customPrompt: string): string {
  const baseTopic = topic.trim() || 'the requested topic';
  const descriptivePrompt = (customPrompt || prompt).trim();

  return [
    `Create a square social media image that clearly matches the topic "${baseTopic}".`,
    descriptivePrompt ? `Visual direction: ${descriptivePrompt}.` : '',
    'Keep the main subject, setting, and mood aligned with the topic.',
    'Make it bold, clean, realistic, and eye-catching for Facebook.',
    'Do not add text overlays, logos, watermarks, collages, or unrelated objects.'
  ]
    .filter(Boolean)
    .join(' ');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
    const finalPrompt = buildGenerationPrompt(prompt, topic, customPrompt);

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: finalPrompt.substring(0, 480),
      config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' }
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) throw new Error('No image bytes from Imagen');

    console.log('Imagen 3 success!');
    return NextResponse.json({ imageUrl: `data:image/jpeg;base64,${imageBytes}`, source: 'imagen3' });
  } catch (imagenError) {
    console.warn('Imagen 3 unavailable:', getErrorMessage(imagenError).substring(0, 80));
  }

  // --- Strategy 2: Use Unsplash Source API (topic-relevant photography, proxied) ---
  try {
    const searchQuery = buildSearchQuery(prompt, topic, customPrompt) || 'creative,concept';
    
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
    console.log(`Unsplash image fetched for "${searchQuery}". Bytes: ${arrayBuffer.byteLength}`);

    return NextResponse.json({
      imageUrl: `data:${contentType};base64,${base64}`,
      source: 'unsplash',
      query: searchQuery
    });
  } catch (unsplashError) {
    console.warn('Unsplash failed:', getErrorMessage(unsplashError));
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
  } catch (picsumError) {
    console.warn('Picsum failed:', getErrorMessage(picsumError));
  }

  return NextResponse.json({ error: 'All image generation strategies failed' }, { status: 500 });
}
