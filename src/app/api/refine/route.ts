import { NextResponse } from 'next/server';
import { callPollinationsText } from '../../lib/pollinationsClient';



export async function POST(req: Request) {
  try {
    const { currentText, feedback } = await req.json();

    if (!currentText || !feedback) {
      return NextResponse.json({ error: 'Missing currentText or feedback' }, { status: 400 });
    }

    const prompt = `
    You are an expert social media content editor for Facebook.
    
    The user has a Facebook post draft and wants to improve it based on their feedback.
    
    CURRENT POST TEXT:
    ---
    ${currentText}
    ---
    
    USER FEEDBACK / REVISION REQUEST:
    "${feedback}"
    
    INSTRUCTIONS:
    - Carefully apply the user's feedback to revise the post.
    - Keep the overall message and emojis if they are good.
    - DO NOT use any Markdown formatting like **bold** or *italic*. Facebook does not support Markdown.
    - Output strictly plain text with emojis only.
    - Return ONLY the revised post text, nothing else. No commentary, no preamble.
    `;

    let revisedText = await callPollinationsText(prompt);
    console.log('[Refine Output]:', revisedText);

    if (!revisedText || revisedText.length < 5) {
      throw new Error('AI returned an empty response. Please try again.');
    }

    // Attempt to remove AI commentary if present (e.g. "Here is your revised post...")
    // We look for text between quotes if present, or just use the last part if it looks like a preamble
    if (revisedText.includes('---')) {
      const parts = revisedText.split('---');
      revisedText = parts[parts.length - 1].trim();
    } else if (revisedText.includes('\n\n')) {
      // If there are multiple paragraphs and the first one is short, it might be a preamble
      const lines = revisedText.split('\n');
      if (lines[0].length < 100 && lines.length > 2) {
        // Very simple heuristic: skip the first line if it looks like a preamble
        if (lines[0].toLowerCase().includes('here is') || lines[0].toLowerCase().includes('revised')) {
          revisedText = lines.slice(1).join('\n').trim();
        }
      }
    }

    // Safety strip of any markdown
    revisedText = revisedText.replace(/\*\*/g, '').replace(/\*/g, '').trim();

    return NextResponse.json({ revisedText });

  } catch (error: any) {
    console.error('Refine API Error:', error);
    const isQuota = error?.message?.includes('429') || error?.message?.includes('quota');
    return NextResponse.json(
      { error: isQuota ? 'AI quota exceeded. Please wait a few minutes and try again.' : (error?.message || 'Failed to refine content') },
      { status: 500 }
    );
  }
}
