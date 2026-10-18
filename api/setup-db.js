// 한 번만 쓰는 표 만들기 통로 — 표가 생기면 이 파일은 지운다. 데이터는 읽지도 보내지도 않는다.
const { Client } = require('pg');
const SQL = `
create table if not exists public.slots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  starts_at timestamptz not null,
  capacity int not null default 1 check (capacity between 1 and 50),
  is_open boolean not null default true
);
create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null,
  contact text not null,
  message text,
  consent boolean not null default false,
  status text not null default '새 문의' check (status in ('새 문의', '연락함', '완료')),
  updated_at timestamptz,
  slot_id bigint references public.slots(id),
  confirmed boolean not null default false
);
alter table public.slots enable row level security;
alter table public.inquiries enable row level security;
revoke all on public.slots from anon, authenticated;
revoke all on public.inquiries from anon, authenticated;

create or replace function public.book_slot(p_slot bigint, p_name text, p_contact text, p_message text, p_consent boolean)
returns json language plpgsql security definer set search_path = public as $fn$
declare s public.slots; taken int; new_id bigint;
begin
  select * into s from public.slots where id = p_slot for update;
  if not found or not s.is_open or s.starts_at <= now() then
    return json_build_object('ok', false, 'reason', 'closed');
  end if;
  select count(*) into taken from public.inquiries where slot_id = p_slot and confirmed;
  if taken >= s.capacity then
    return json_build_object('ok', false, 'reason', 'full');
  end if;
  insert into public.inquiries (name, contact, message, consent, slot_id, confirmed)
  values (p_name, p_contact, p_message, p_consent, p_slot, true) returning id into new_id;
  return json_build_object('ok', true, 'id', new_id, 'starts_at', s.starts_at);
end $fn$;

create or replace function public.open_slots()
returns table (id bigint, starts_at timestamptz, remaining int)
language sql stable security definer set search_path = public as $fn$
  select s.id, s.starts_at, (s.capacity - count(i.id))::int
  from public.slots s
  left join public.inquiries i on i.slot_id = s.id and i.confirmed
  where s.is_open and s.starts_at > now() and s.starts_at < now() + interval '60 days'
  group by s.id
  order by s.starts_at
$fn$;

revoke execute on function public.book_slot(bigint, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.open_slots() from public, anon, authenticated;
grant execute on function public.book_slot(bigint, text, text, text, boolean) to service_role;
grant execute on function public.open_slots() to service_role;
notify pgrst, 'reload schema';
`;
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST만 가능해요' });
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!url) return res.status(500).json({ error: '데이터베이스 연결 정보가 없어요. Vercel Storage에서 Supabase를 연결해 주세요.' });
  const client = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { rejectUnauthorized: false } });
  try { await client.connect(); await client.query(SQL); return res.status(200).json({ ok: true }); }
  catch (e) { return res.status(500).json({ error: '표를 만들지 못했어요', detail: String(e.message).slice(0, 200) }); }
  finally { await client.end().catch(() => {}); }
};
