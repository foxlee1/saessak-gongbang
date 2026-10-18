// 회원 로그인 공통 — 공개 키만 쓴다(/api/auth-config가 내려 줌). 로그인 표는 sessionStorage(탭을 닫으면 로그아웃).
const Auth = {
  cfg: null,
  async config() {
    if (this.cfg) return this.cfg;
    const r = await fetch('/api/auth-config', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || '로그인 설정을 불러오지 못했어요.');
    return (this.cfg = d);
  },
  async call(path, body, token) {
    const { url, key } = await this.config();
    const r = await fetch(url + '/auth/v1/' + path, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {}),
    });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data: d };
  },
  token() { try { return sessionStorage.getItem('sb_token') || ''; } catch { return ''; } },
  save(t) { try { t ? sessionStorage.setItem('sb_token', t) : sessionStorage.removeItem('sb_token'); } catch {} },
};
function say(id, text, ok) { const m = document.getElementById(id); m.hidden = false; m.className = 'msg ' + (ok ? 'ok' : 'err'); m.textContent = text; }
