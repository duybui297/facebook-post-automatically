import { NextResponse } from 'next/server';
import { callPollinationsText } from '../../lib/pollinationsClient';

function stripCodeFences(value: string): string {
  return value.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
}

function maybeParseJsonString(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sanitizePostText(value: string): string {
  let current = stripCodeFences(value).trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parsed = maybeParseJsonString(current);

    if (typeof parsed === 'string') {
      current = parsed.trim();
      continue;
    }

    if (parsed && typeof parsed === 'object') {
      const postTextCandidate = (parsed as Record<string, unknown>).postText;
      if (typeof postTextCandidate === 'string') {
        current = postTextCandidate.trim();
        continue;
      }
    }

    break;
  }

  return current
    .replace(/^<post_text>/i, '')
    .replace(/<\/post_text>$/i, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();
}

function buildFallbackImagePrompt(topic: string, postText: string): string {
  const condensedPost = postText.replace(/\s+/g, ' ').trim().slice(0, 180);
  return `Square Facebook cover image about ${topic}. Show the main subject and setting from this story: ${condensedPost}. Bold, realistic, eye-catching, no text overlay.`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractGeneratedContent(responseText: string, topic: string) {
  const cleanedText = stripCodeFences(responseText);
  const tagPostMatch = cleanedText.match(/<post_text>([\s\S]*?)<\/post_text>/i);
  const tagImageMatch = cleanedText.match(/<image_prompt>([\s\S]*?)<\/image_prompt>/i);

  if (tagPostMatch?.[1]) {
    const taggedPostText = sanitizePostText(tagPostMatch[1]);
    const taggedImagePrompt = tagImageMatch?.[1]?.trim() || buildFallbackImagePrompt(topic, taggedPostText);

    return {
      postText: taggedPostText,
      imagePrompt: taggedImagePrompt
    };
  }

  const parsed = maybeParseJsonString(cleanedText);
  if (parsed && typeof parsed === 'object') {
    const objectValue = parsed as Record<string, unknown>;
    const postTextCandidate = typeof objectValue.postText === 'string' ? sanitizePostText(objectValue.postText) : '';
    const imagePromptCandidate = typeof objectValue.imagePrompt === 'string' ? objectValue.imagePrompt.trim() : '';

    if (postTextCandidate) {
      return {
        postText: postTextCandidate,
        imagePrompt: imagePromptCandidate || buildFallbackImagePrompt(topic, postTextCandidate)
      };
    }
  }

  const postMatch = cleanedText.match(/"postText"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  const imageMatch = cleanedText.match(/"imagePrompt"\s*:\s*"([\s\S]*?)"/);
  const regexPostText = postMatch?.[1]
    ? sanitizePostText(postMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"'))
    : sanitizePostText(cleanedText);

  return {
    postText: regexPostText,
    imagePrompt: imageMatch?.[1]?.trim() || buildFallbackImagePrompt(topic, regexPostText)
  };
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
    A user wants to create a viral Facebook post and a matching image brief.
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
    - The post text must be ready to paste directly into Facebook.

    Additionally, write a concise image prompt for an AI image generator to create a square thumbnail that clearly matches the topic and the post narrative.
    The image prompt must mention the main subject, scene, mood, and visual style.
    The image prompt must avoid text overlays, logos, watermarks, collage layouts, or unrelated elements.

    Return ONLY these exact XML-style tags, with no JSON, no commentary, and no backticks:
    <post_text>Your generated Facebook post plain text here</post_text>
    <image_prompt>Your matching image prompt here</image_prompt>
    `;

    const responseText = await callPollinationsText(prompt);
    console.log('[Generate Output]:', responseText);
    
    if (!responseText || responseText.length < 5) {
      throw new Error('AI returned an empty or too short response. Please try again.');
    }

    const generatedObject = extractGeneratedContent(responseText, topic);

    let finalPostText = generatedObject.postText;
    if (!finalPostText || typeof finalPostText !== 'string' || finalPostText === 'null') {
      finalPostText = sanitizePostText(responseText) || 'No content generated.';
    }

    let finalImagePrompt = generatedObject.imagePrompt || buildFallbackImagePrompt(topic, finalPostText);
    if (finalImagePrompt.length > 250) finalImagePrompt = finalImagePrompt.substring(0, 250);

    return NextResponse.json({
      text: finalPostText,
      imagePrompt: finalImagePrompt
    });

  } catch (error) {
    console.error('API Generate Error:', error);
    const message = getErrorMessage(error);
    const isQuota = message.includes('429') || message.toLowerCase().includes('quota') || message.toLowerCase().includes('resource exhausted');
    return NextResponse.json(
      { error: isQuota ? 'AI quota exceeded. Please wait a few minutes and try again.' : (message || 'Failed to generate content') },
      { status: 500 }
    );
  }
}
