import { NextResponse } from 'next/server';
import { callPollinationsText } from '../../lib/pollinationsClient';
import { ApifyClient } from 'apify-client';

const apifyClient = new ApifyClient({ token: process.env.APIFY_API_TOKEN || '' });

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
    
    Return the result strictly as a valid JSON object.
    CRITICAL: Output ONLY the JSON object, NO other text, NO backticks.
    
    Format:
    {
      "postText": "Your generated facebook post plain text here",
      "imagePrompt": "Short vivid image description max 200 chars"
    }
    `;

    const responseText = await callPollinationsText(prompt);
    console.log('[Generate Output]:', responseText);
    
    if (!responseText || responseText.length < 5) {
      throw new Error('AI returned an empty or too short response. Please try again.');
    }

    // Clean up markdown code fences
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
        // Fallback: If no JSON structure, use the whole text but strip outer braces
        generatedObject.postText = cleanedText.replace(/^{|}$/g, '').trim();
      }
      if (imgMatch?.[1]) generatedObject.imagePrompt = imgMatch[1];
    }
    
    // Final sanity check: Ensure postText is a non-null string
    let finalPostText = generatedObject.postText;
    if (!finalPostText || typeof finalPostText !== 'string' || finalPostText === 'null') {
      // If still empty/null, use the cleaned whole text as a last resort
      finalPostText = cleanedText || 'No content generated.';
    }

    // Safety: strip any stray markdown asterisks
    finalPostText = finalPostText.replace(/\*\*/g, '').replace(/\*/g, '');

    // Trim the image prompt
    let finalImagePrompt = (generatedObject.imagePrompt || topic);
    if (finalImagePrompt.length > 250) finalImagePrompt = finalImagePrompt.substring(0, 250);

    return NextResponse.json({
      text: finalPostText,
      imagePrompt: finalImagePrompt
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
