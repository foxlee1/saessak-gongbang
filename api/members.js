module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!url || !key) return res.status(500).json({ error: 'Supabase 연결 정보가 없어요.' });
  if (!token) return res.status(401).json({ error: '로그인이 필요해요.' });
  const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!r.ok) return res.status(401).json({ error: '다시 로그인해 주세요.' });
  const user = await r.json();
  return res.status(200).json({
    email: user.email,
    // 회원 전용 내용: 사장님이 준 내용만. 없으면 "준비 중"
    content: '회원 전용 내용은 준비 중이에요.',
  });
};
