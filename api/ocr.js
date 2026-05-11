export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { doc1Image, doc1Mime, doc2Image, doc2Mime, isIndividual } = req.body;
    if (!doc1Image || !doc2Image) return res.status(400).json({ error: '이미지 데이터가 없습니다' });

    const promptText = isIndividual
      ? `첫 번째 이미지는 신분증, 두 번째 이미지는 통장사본입니다. JSON만 출력해줘. 다른 텍스트 없이 순수 JSON만.
{
  "name": "신분증의 성명",
  "address": "신분증의 주소",
  "idNumber": "주민등록번호 (앞 6자리-뒤 7자리 형식, 없으면 빈 문자열)",
  "bankName": "통장사본의 은행명",
  "accountNumber": "통장사본의 계좌번호",
  "accountHolder": "통장사본의 예금주"
}`
      : `첫 번째 이미지는 사업자등록증, 두 번째 이미지는 통장사본입니다. JSON만 출력해줘. 다른 텍스트 없이 순수 JSON만.
{
  "companyName": "법인명/상호",
  "bizNumber": "사업자등록번호",
  "ceoName": "대표자명",
  "address": "사업장주소",
  "bankName": "은행명",
  "accountNumber": "계좌번호",
  "accountHolder": "예금주"
}`;

    const makeContent = (mime, data) =>
      mime === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data } };

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
        messages: [{ role: 'user', content: [
          makeContent(doc1Mime, doc1Image),
          makeContent(doc2Mime, doc2Image),
          { type: 'text', text: promptText }
        ]}]
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
