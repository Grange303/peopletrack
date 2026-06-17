export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured', details: 'ANTHROPIC_API_KEY environment variable is missing' });
  }

  try {
    const { text, targetLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ error: 'Missing text or targetLang', details: `text: ${!!text}, targetLang: ${!!targetLang}` });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `Translate the following text into ${targetLang}. Maintain all formatting including any numbering like [0], [1], [2]. Return ONLY the translated text with no preamble or explanation.\n\n${text}`
        }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(500).json({ error: 'Anthropic API error', details: `Status ${response.status}: ${errBody.substring(0, 200)}` });
    }

    const data = await response.json();
    const translated = data.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || text;

    res.status(200).json({ translated });
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed', details: error.message });
  }
}
