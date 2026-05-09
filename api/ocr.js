export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { bizImage, bizMime, bankImage, bankMime } = req.body;
    if (!bizImage || !bankImage) return res.status(400).json({ error: '이미지 데이터가 없습니다' });
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: bizMime || 'image/jpeg', data: bizImage } },
            { type: 'image', source: { type: 'base64', media_type: bankMime || 'image/jpeg', data: bankImage } },
            { type: 'text', text: '두 이미지에서 정보를 추출해서 JSON만 출력해줘. 다른 텍스트 없이 순수 JSON만.\n{\n"companyName":"법인명/상호",\n"bizNumber":"사업자등록번호",\n"ceoName":"대표자명",\n"address":"사업장주소",\n"bankName":"은행명",\n"accountNumber":"계좌번호",\n"accountHolder":"예금주"\n}' }
          ]
        }]
      })
    });
    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Anthropic API 오류' });
    }
    const data = await response.json();
    const raw = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'OCR 결과 파싱 실패' });
    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
