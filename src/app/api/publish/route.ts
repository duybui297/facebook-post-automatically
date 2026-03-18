import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, pageToken, /* imageUrl */ } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing content text' }, { status: 400 });
    }

    if (!pageToken) {
      return NextResponse.json({ error: 'Missing pageToken for the target Fanpage' }, { status: 400 });
    }

    // Step 1: Ideally, we should exchange the token for the specific Page ID or we assume the user provides evaluating Page ID.
    // However, Graph API `/me/feed` works if the token is already a Page Access Token!
    const publishUrl = `https://graph.facebook.com/v19.0/me/feed`;
    
    // We send the text. Sending image requires uploading a photo first then attaching, which is more complex.
    // For this implementation, we will publish a text status update (with a link if included in text).
    const formData = new URLSearchParams();
    formData.append('message', text);
    formData.append('access_token', pageToken);

    const fbResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const data = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error('FB API Error:', data);
      throw new Error(data.error?.message || 'Failed to publish to Facebook');
    }

    return NextResponse.json({ success: true, postId: data.id });

  } catch (error: any) {
    console.error('API Publish Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to publish post' },
      { status: 500 }
    );
  }
}
