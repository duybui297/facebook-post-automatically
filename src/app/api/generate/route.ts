import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Gemini model fallback chain (ordered by free-tier daily quota)
const MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: any = null;
  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      console.log(`[generate] Success with model: ${modelName}`);
      return result.response.text();
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || '';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('Resource has been exhausted') || msg.includes('not found')) {
        console.warn(`[generate] ${modelName} unavailable: ${msg.substring(0, 80)}, trying next...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All Gemini models exhausted. Try again later.');
}

export async function POST(req: Request) {
  try {
    const { url, topic, wordCount = 200 } = await req.json();

    if (!url || !topic) {
      return NextResponse.json({ error: 'Missing url or topic' }, { status: 400 });
    }

    const prompt = `
You are an expert social media manager for Facebook.
A user wants to create a viral Facebook post.
Target Fanpage URL (for context of brand voice): ${url}
Topic: ${topic}

Write a highly engaging, professional, and viral Facebook post about the topic.
The post MUST BE APPROXIMATELY ${wordCount} WORDS. Do not exceed this limit significantly.
Use emojis appropriately. Keep paragraphs short. Include a call to action asking for comments.
Include 3-4 relevant hashtags at the end.

CRITICAL INSTRUCTIONS FOR FACEBOOK FORMATTING:
- DO NOT use any Markdown formatting like **bold** or *italic*. Facebook does not support Markdown.
- Output strictly plain text with emojis.

Additionally, write a concise "Image Prompt" (max 200 characters) for an AI image generator to create a thumbnail for this post. The image prompt must mention the main subject, scene, and mood.

Return the result strictly as a JSON object, no backticks, no extra text:
{
  "postText": "Your generated facebook post plain text here",
  "imagePrompt": "Short vivid image description max 200 chars"
}
`;

    const responseText = await generateWithFallback(prompt);
    console.log('[Generate Raw]:', responseText.substring(0, 200));

    // Clean up markdown code fences
    const cleaned = responseText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    let postText = '';
    let imagePrompt = topic;

    try {
      const parsed = JSON.parse(cleaned);
      postText = parsed.postText || '';
      imagePrompt = parsed.imagePrompt || topic;
    } catch {
      console.warn('JSON parse failed, using regex fallback');
      const postMatch = cleaned.match(/"postText"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      const imgMatch = cleaned.match(/"imagePrompt"\s*:\s*"([\s\S]*?)"/);
      postText = postMatch?.[1]?.replace(/\\n/g, '\n').replace(/\\"/g, '"') || cleaned.replace(/[{}]/g, '').trim();
      if (imgMatch?.[1]) imagePrompt = imgMatch[1];
    }

    // Ensure postText is valid
    if (!postText || postText === 'null' || postText.length < 10) {
      postText = cleaned.replace(/[{}]/g, '').trim() || 'Content generation failed. Please try again.';
    }

    // Strip markdown artifacts
    postText = postText.replace(/\*\*/g, '').replace(/\*/g, '');
    if (imagePrompt.length > 250) imagePrompt = imagePrompt.substring(0, 250);

    return NextResponse.json({ text: postText, imagePrompt });

  } catch (error: any) {
    console.error('API Generate Error:', error);
    const msg = error?.message || 'Failed to generate content';
    const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('exhausted');
    return NextResponse.json(
      { error: isQuota ? 'AI quota exceeded. Please wait and try again.' : msg },
      { status: 500 }
    );
  }
}
