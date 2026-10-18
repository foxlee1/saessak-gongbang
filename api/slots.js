// 손님에게 보여 줄 열린 수업 시간 (앞으로 60일, 남은 자리 수 포함)
const { SB_URL, SB_KEY, sbHeaders } = require('./_sb');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET만 가능해요' });
  res.setHeader('Cache-Control', 'no-store');
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase 연결 정보가 없어요.' });
  const r = await fetch(`${SB_URL}/rest/v1/rpc/open_slots`, { method: 'POST', headers: sbHeaders(), body: '{}' });
  if (!r.ok) return res.status(500).json({ error: '수업 시간을 불러오지 못했어요.' });
  const slots = (await r.json()).map((s) => ({ id: s.id, starts_at: s.starts_at, remaining: Math.max(0, s.remaining) }));
  return res.status(200).json({ slots });
};
