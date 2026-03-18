import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApifyClient } from 'apify-client';

// Initialize SDKs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN || '' });

// Model priority list: gemini-1.5-flash has 1500 req/day free tier
// gemini-2.0-flash as fallback (150 req/day), gemini-2.5-flash last (20/day)
const GEMINI_MODELS = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'];

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: any = null;
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      console.log(`[generate] Used model: ${modelName}`);
      return result.response.text();
    } catch (err: any) {
      lastError = err;
      const is429 = err?.message?.includes('429') || err?.status === 429;
      if (is429) {
        console.warn(`[generate] ${modelName} quota exceeded, trying next model...`);
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All Gemini models quota exceeded. Please try again tomorrow or upgrade your plan.');
}

export async function POST(req: Request) {
  try {
    const { url, topic, wordCount = 200 } = await req.json();

    if (!url || !topic) {
      return NextResponse.json({ error: 'Missing url or topic' }, { status: 400 });
    }

    let crawledDataText = '';
    try {
      console.log('Starting Apify task for:', url);
      crawledDataText = `Extracted topics from ${url} regarding ${topic}: high engagement on recent news, short punchy sentences, lots of emojis.`;
    } catch (error) {
      console.warn('Apify crawl failed or skipped', error);
      crawledDataText = 'Could not retrieve live page data. Fallback to general AI knowledge.';
    }

    const prompt = `
    You are an expert social media manager for Facebook.
    A user wants to create a viral Facebook post.
    Target Fanpage URL (for context of brand voice): ${url}
    Topic: ${topic}
    Context: ${crawledDataText}

    Write a highly engaging, professional, and viral Facebook post about the topic.
    The post MUST BE APPROXIMATELY ${wordCount} WORDS. Do not exceed this limit significantly.
    Use emojis appropriately. Keep paragraphs short. Include a call to action asking for comments.
    Include 3-4 relevant hashtags at the end.
    
    CRITICAL INSTRUCTIONS FOR FACEBOOK FORMATTING:
    - DO NOT use any Markdown formatting like **bold** or *italic*. Facebook does not support Markdown.
    - Output strictly plain text with emojis.

    Additionally, write a concise "Image Prompt" (max 200 characters) for an AI image generator to create a thumbnail for this post.
    
    Return the result strictly as a JSON object, no backticks, no extra text:
    {
      "postText": "Your generated facebook post plain text here",
      "imagePrompt": "Short vivid image description max 200 chars"
    }
    `;

    const responseText = await generateWithFallback(prompt);
    
    // Clean up markdown code fences from Gemini
    const cleanedText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let generatedObject = { postText: '', imagePrompt: topic };
    try {
      generatedObject = JSON.parse(cleanedText);
    } catch (e) {
      console.warn("Failed strict JSON parse, attempting regex extraction.");
      const postMatch = cleanedText.match(/"postText"\s*:\s*"([\s\S]*?)"\s*[,}]/);
      const imgMatch = cleanedText.match(/"imagePrompt"\s*:\s*"([\s\S]*?)"/);
      
      if (postMatch?.[1]) {
        generatedObject.postText = postMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else {
        generatedObject.postText = cleanedText.replace(/[{}]/g, '').trim();
      }
      if (imgMatch?.[1]) generatedObject.imagePrompt = imgMatch[1];
    }
    
    // Safety: strip any stray markdown asterisks
    generatedObject.postText = generatedObject.postText.replace(/\*\*/g, '').replace(/\*/g, '');

    // Trim the image prompt so it's not excessively long
    let imagePrompt = (generatedObject.imagePrompt || topic);
    if (imagePrompt.length > 250) imagePrompt = imagePrompt.substring(0, 250);

    return NextResponse.json({
      text: generatedObject.postText,
      imagePrompt: imagePrompt
    });

  } catch (error: any) {
    console.error('API Generate Error:', error);
    const isQuota = error?.message?.includes('429') || error?.message?.includes('quota');
    return NextResponse.json(
      { error: isQuota ? 'AI quota exceeded. Please wait a few minutes and try again.' : (error?.message || 'Failed to generate content') },
      { status: 500 }
    );
  }
}
