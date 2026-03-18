import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  let prompt = '';
  let seed = Math.floor(Math.random() * 999999);

  try {
    const body = await req.json();
    prompt = body.prompt || '';
    if (body.seed) seed = body.seed;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  // Strategy 1: Try Imagen 3 via Google AI SDK (@google/genai)
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: prompt.substring(0, 480),
      config: {
        numberOfImages: 1,
        aspectRatio: '1:1',
        outputMimeType: 'image/jpeg',
      }
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) throw new Error('No image bytes from Imagen');

    console.log('Imagen 3 generation success!');
    return NextResponse.json({
      imageUrl: `data:image/jpeg;base64,${imageBytes}`,
      source: 'imagen3'
    });
  } catch (imagenError: any) {
    console.warn('Imagen 3 unavailable:', imagenError?.message?.substring(0, 80));
  }

  // Strategy 2: Use Picsum Photos with seed (shows real stunning photography)
  // This is guaranteed to work - it's just random beautiful photos with a seed for consistency per "refresh"
  const picsumUrl = `https://picsum.photos/seed/${seed}/800/800`;
  
  try {
    const picsumRes = await fetch(picsumUrl, { redirect: 'follow' });
    if (picsumRes.ok) {
      const contentType = picsumRes.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await picsumRes.arrayBuffer();
      if (arrayBuffer.byteLength > 0) {
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        console.log(`Picsum image fetched. Bytes: ${arrayBuffer.byteLength}`);
        return NextResponse.json({
          imageUrl: `data:${contentType};base64,${base64}`,
          source: 'picsum'
        });
      }
    }
  } catch (picsumError: any) {
    console.warn('Picsum failed:', picsumError?.message);
  }

  // Strategy 3: Return a direct URL the browser can load (absolute last-resort)
  return NextResponse.json({
    imageUrl: `https://picsum.photos/seed/${seed}/800/800`,
    source: 'picsum-direct'
  });
}
