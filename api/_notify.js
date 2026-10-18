// 예약 알림 메일 (Resend). RESEND_API_KEY와 NOTIFY_EMAIL이 없으면 조용히 건너뛴다.
// 알림이 실패해도 예약은 이미 저장돼 있으니 손님에게는 오류를 보여 주지 않는다.
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = (iso) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

async function send(to, subject, html) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM || '새싹 공방 <onboarding@resend.dev>', to: [to], subject, html }),
  });
  if (!r.ok) console.warn('알림 메일 실패', r.status);
}

module.exports = async function notifyBooking(b) {
  if (!process.env.RESEND_API_KEY) return;
  const t = when(b.starts_at);
  const jobs = [];
  if (process.env.NOTIFY_EMAIL) {
    jobs.push(send(process.env.NOTIFY_EMAIL, `[새 예약] ${t} · ${b.name}`,
      `<p>새 예약이 확정됐어요.</p><ul><li>시간: ${esc(t)}</li><li>이름: ${esc(b.name)}</li><li>연락처: ${esc(b.contact)}</li><li>만들고 싶은 것: ${esc(b.message)}</li></ul><p>관리자 페이지에서 확인해 주세요.</p>`));
  }
  // 손님 연락처가 이메일이면 확정 안내 (보내는 주소 도메인 인증이 끝나야 실제로 나간다)
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact) && process.env.NOTIFY_FROM) {
    jobs.push(send(b.contact, '[새싹 공방] 예약이 확정됐어요',
      `<p>${esc(b.name)}님, 새싹 공방 예약이 확정됐어요.</p><p><b>${esc(t)}</b> · 2시간 · 2인 5만원</p><p>자세한 안내는 따로 연락드릴게요. 궁금한 점은 인스타그램 DM으로 남겨 주세요.</p>`));
  }
  await Promise.allSettled(jobs);
};
