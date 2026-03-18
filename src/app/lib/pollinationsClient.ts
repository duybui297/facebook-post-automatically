export async function callPollinationsText(prompt: string): Promise<string> {
  const url = `https://text.pollinations.ai/`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a professional social media manager.' },
        { role: 'user', content: prompt }
      ],
      model: 'openai' // 'openai' is handled by Pollinations as a high-quality free proxy
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pollinations API error: ${response.status} ${errorText}`);
  }

  const text = await response.text();
  return text;
}
