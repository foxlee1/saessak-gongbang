// 관리자 — 비밀번호 확인 후 예약 목록·상태, 수업 시간 열기/닫기, 회원 목록
const crypto = require('node:crypto');
const { SB_URL, SB_KEY, sbHeaders, readBody } = require('./_sb');
const same = (a, b) => {
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  return crypto.timingSafeEqual(h(a), h(b));
};
const STATUSES = ['새 문의', '연락함', '완료'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const pass = process.env.ADMIN_PASSWORD;
  if (!pass) return res.status(500).json({ error: 'Vercel 환경변수에 ADMIN_PASSWORD를 넣고 Redeploy 해 주세요.' });
  if (!same(req.headers['x-admin-password'] || '', pass)) return res.status(401).json({ error: '비밀번호가 맞지 않아요.' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase 연결 정보가 없어요.' });
  const view = String(req.query?.view || 'inquiries');
  const b = req.method === 'GET' ? {} : readBody(req);

  // ── 예약(문의) ──
  if (view === 'inquiries') {
    if (req.method === 'GET') {
      const r = await fetch(`${SB_URL}/rest/v1/inquiries?select=*,slots(starts_at)&order=created_at.desc&limit=500`, { headers: sbHeaders() });
      if (!r.ok) return res.status(500).json({ error: '불러오지 못했어요.' });
      return res.status(200).json({ rows: await r.json() });
    }
    if (req.method === 'PATCH') {
      const id = Number(b.id);
      const patch = { updated_at: new Date().toISOString() };
      if (b.status !== undefined) { if (!STATUSES.includes(b.status)) return res.status(400).json({ error: '잘못된 요청이에요.' }); patch.status = b.status; }
      if (b.confirmed !== undefined) patch.confirmed = b.confirmed === true; // 확정 취소 → 자리가 다시 열린다
      if (!Number.isInteger(id) || Object.keys(patch).length < 2) return res.status(400).json({ error: '잘못된 요청이에요.' });
      const r = await fetch(`${SB_URL}/rest/v1/inquiries?id=eq.${id}`, { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
      if (!r.ok) return res.status(500).json({ error: '바꾸지 못했어요.' });
      return res.status(200).json({ ok: true });
    }
  }

  // ── 수업 시간 ──
  if (view === 'slots') {
    if (req.method === 'GET') {
      const since = new Date(Date.now() - 86400000).toISOString();
      const r = await fetch(`${SB_URL}/rest/v1/slots?select=*,inquiries(id,confirmed)&starts_at=gte.${encodeURIComponent(since)}&order=starts_at.asc&limit=300`, { headers: sbHeaders() });
      if (!r.ok) return res.status(500).json({ error: '불러오지 못했어요.' });
      const rows = (await r.json()).map((s) => ({ id: s.id, starts_at: s.starts_at, capacity: s.capacity, is_open: s.is_open, booked: (s.inquiries || []).filter((i) => i.confirmed).length }));
      return res.status(200).json({ rows });
    }
    if (req.method === 'POST') {
      const t = new Date(b.starts_at); const cap = Number(b.capacity);
      if (isNaN(t) || t <= new Date()) return res.status(400).json({ error: '앞으로의 날짜와 시간을 골라 주세요.' });
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) return res.status(400).json({ error: '팀 수는 1~50 사이로 적어 주세요.' });
      const r = await fetch(`${SB_URL}/rest/v1/slots`, { method: 'POST', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ starts_at: t.toISOString(), capacity: cap }) });
      if (!r.ok) return res.status(500).json({ error: '수업 시간을 열지 못했어요.' });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'PATCH') {
      const id = Number(b.id);
      if (!Number.isInteger(id) || typeof b.is_open !== 'boolean') return res.status(400).json({ error: '잘못된 요청이에요.' });
      const r = await fetch(`${SB_URL}/rest/v1/slots?id=eq.${id}`, { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ is_open: b.is_open }) });
      if (!r.ok) return res.status(500).json({ error: '바꾸지 못했어요.' });
      return res.status(200).json({ ok: true });
    }
  }

  // ── 회원 (이메일·가입일·마지막 로그인만) ──
  if (view === 'members' && req.method === 'GET') {
    const r = await fetch(`${SB_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: sbHeaders() });
    if (!r.ok) return res.status(500).json({ error: '회원 목록을 불러오지 못했어요.' });
    const d = await r.json();
    const rows = (d.users || []).map((u) => ({ email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at }));
    return res.status(200).json({ rows });
  }

  return res.status(405).json({ error: '지원하지 않는 요청이에요.' });
};
