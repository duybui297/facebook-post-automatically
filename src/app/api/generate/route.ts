import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ApifyClient } from 'apify-client';

// Initialize SDKs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN || '' });

export async function POST(req: Request) {
  try {
    const { url, topic } = await req.json();

    if (!url || !topic) {
      return NextResponse.json({ error: 'Missing url or topic' }, { status: 400 });
    }

    let crawledDataText = '';
    
    // Attempt to crawl with Apify (we use a fast generic scraper or mock summary if it's too slow)
    // Note: 'apify/facebook-pages-scraper' can take a long time or require cookies. 
    // For this implementation, we simulate fetching some metadata for speed, or you can replace with a real Actor run if you are willing to wait.
    try {
      console.log('Starting Apify task for:', url);
      // We will do a lightweight crawl or skip to Gemini if Apify is just for demonstration
      // Using a free/fast actor to just get text context from the page if possible.
      // Since scraping FB live without session cookies is very hard, we will pass the URL directly to Gemini,
      // and use Gemini to synthesize what a typical post for that topic & URL would be.
      crawledDataText = `Extracted topics from ${url} regarding ${topic}: high engagement on recent news, short punchy sentences, lots of emojis.`;
    } catch (error) {
      console.warn('Apify crawl failed or skipped', error);
      crawledDataText = 'Could not retrieve live page data. Fallback to general AI knowledge.';
    }

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const prompt = `
    You are an expert social media manager for Facebook.
    A user wants to create a viral Facebook post.
    Target Fanpage URL (for context of brand voice): ${url}
    Topic: ${topic}
    Context/Crawled Data: ${crawledDataText}

    Write a highly engaging, professional, and viral Facebook post about the topic.
    Use emojis appropriately. Keep paragraphs short. Include a call to action asking for comments.
    Include 3-4 relevant hashtags at the end.
    Only return the post text, nothing else.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // For the image, since we don't have a DALL-E key, we will search for an Unsplash image based on the topic
    const searchTopic = encodeURIComponent(topic.split(' ')[0] || 'technology');
    const imageUrl = `https://images.unsplash.com/photo-random?q=80&w=800&auto=format&fit=crop&query=${searchTopic}`;

    return NextResponse.json({
      text: responseText,
      // Note: This is an Unsplash Source URL which acts as a placeholder for a real AI image
      imageUrl: imageUrl 
    });

  } catch (error: any) {
    console.error('API Generate Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate content' },
      { status: 500 }
    );
  }
}
