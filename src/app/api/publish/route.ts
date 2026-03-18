import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text, pageToken, imageUrl } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Missing content text' }, { status: 400 });
    }
    if (!pageToken) {
      return NextResponse.json({ error: 'Missing pageToken for the target Fanpage' }, { status: 400 });
    }

    let uploadedPhotoId: string | null = null;

    // --- Step 1: Upload image to Facebook if we have one ---
    // Facebook does NOT accept base64 or external URLs directly for feed photos
    // We must upload the image bytes via /me/photos with published=false to get a photo_id
    if (imageUrl && imageUrl.startsWith('data:image/')) {
      try {
        // Parse out the base64 data
        const matches = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (matches && matches[2]) {
          const mimeType = matches[1]; // e.g. "image/jpeg"
          const base64Data = matches[2];
          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Build multipart form to upload image
          const boundary = `----FormBoundary${Date.now()}`;
          
          // Build multipart body manually
          const preamble = [
            `--${boundary}`,
            `Content-Disposition: form-data; name="access_token"`,
            '',
            pageToken,
            `--${boundary}`,
            `Content-Disposition: form-data; name="published"`,
            '',
            'false',
            `--${boundary}`,
            `Content-Disposition: form-data; name="source"; filename="post_image.jpg"`,
            `Content-Type: ${mimeType}`,
            '',
            ''
          ].join('\r\n');

          const epilogue = `\r\n--${boundary}--\r\n`;

          const preambleBuffer = Buffer.from(preamble, 'utf-8');
          const epilogueBuffer = Buffer.from(epilogue, 'utf-8');
          const bodyBuffer = Buffer.concat([preambleBuffer, imageBuffer, epilogueBuffer]);

          const photoUploadResponse = await fetch(
            `https://graph.facebook.com/v19.0/me/photos`,
            {
              method: 'POST',
              headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length.toString(),
              },
              body: bodyBuffer
            }
          );

          const photoData = await photoUploadResponse.json();
          if (photoUploadResponse.ok && photoData.id) {
            uploadedPhotoId = photoData.id;
            console.log('Photo uploaded to Facebook. ID:', uploadedPhotoId);
          } else {
            console.warn('Photo upload to Facebook failed:', photoData?.error?.message || JSON.stringify(photoData));
          }
        }
      } catch (imgError: any) {
        console.warn('Image upload step failed (will publish text only):', imgError?.message);
      }
    }

    // --- Step 2: Publish the post ---
    // If we have a photo_id, attach it; otherwise post text only.
    const publishUrl = `https://graph.facebook.com/v19.0/me/feed`;
    const formData = new URLSearchParams();
    formData.append('message', text);
    formData.append('access_token', pageToken);
    
    if (uploadedPhotoId) {
      // Attach the already-uploaded photo
      formData.append('attached_media[0]', JSON.stringify({ media_fbid: uploadedPhotoId }));
    }

    const fbResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const data = await fbResponse.json();

    if (!fbResponse.ok) {
      console.error('FB Publish Error:', data);
      throw new Error(data.error?.message || 'Failed to publish to Facebook');
    }

    console.log('Published successfully. Post ID:', data.id, '| With image:', !!uploadedPhotoId);
    return NextResponse.json({ success: true, postId: data.id, withImage: !!uploadedPhotoId });

  } catch (error: any) {
    console.error('API Publish Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to publish post' },
      { status: 500 }
    );
  }
}
