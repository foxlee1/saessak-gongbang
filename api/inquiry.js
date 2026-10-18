// 예약 신청 받기 — 남은 자리가 있으면 바로 확정(데이터베이스 함수 book_slot이 자리를 잠그고 센다)
const { SB_URL, SB_KEY, sbHeaders, readBody } = require('./_sb');
const notifyBooking = require('./_notify');
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const ITEMS = ['향초', '디퓨저', '아직 고민 중'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  if (!SB_URL || !SB_KEY) return res.status(500).json({ error: 'Supabase 연결 정보가 없어요. Vercel Storage 연결 후 다시 배포해 주세요.' });
  const b = readBody(req);
  if (b.website) return res.status(200).json({ ok: true }); // 스팸 함정 칸(사람에게는 안 보임)
  const row = {
    p_slot: Number(b.slot_id),
    p_name: clip(b.name, 50),
    p_contact: clip(b.contact, 100),
    p_message: ITEMS.includes(b.message) ? b.message : '아직 고민 중',
    p_consent: b.consent === true,
  };
  if (!Number.isInteger(row.p_slot)) return res.status(400).json({ error: '날짜와 시간을 골라 주세요' });
  if (!row.p_name || !row.p_contact) return res.status(400).json({ error: '이름과 연락처를 적어 주세요' });
  if (!row.p_consent) return res.status(400).json({ error: '개인정보 수집·이용에 동의해 주세요' });

  const r = await fetch(`${SB_URL}/rest/v1/rpc/book_slot`, { method: 'POST', headers: sbHeaders(), body: JSON.stringify(row) });
  if (!r.ok) return res.status(500).json({ error: '저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.' });
  const d = await r.json();
  if (!d.ok) {
    const why = d.reason === 'full' ? '방금 그 시간이 마감됐어요. 다른 시간을 골라 주세요.' : '지금은 예약할 수 없는 시간이에요. 다른 시간을 골라 주세요.';
    return res.status(409).json({ error: why });
  }
  await notifyBooking({ starts_at: d.starts_at, name: row.p_name, contact: row.p_contact, message: row.p_message }).catch(() => {});
  return res.status(200).json({ ok: true, starts_at: d.starts_at });
};
