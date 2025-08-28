// Für Dev nutzen wir Vite Proxy => relative Pfade, damit Cookies (SameSite=Lax) gesendet werden
const BASE = '';

async function j(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string,string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json'; // nur setzen wenn tatsächlich Payload
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error || res.statusText);
  return res.json();
}

export const api = {
  health: () => fetch(BASE + '/health').then(r=>r.json()),
  register: (u: string, p: string) => j('POST','/auth/register',{username:u,password:p}),
  login: (u: string, p: string) => j('POST','/auth/login',{username:u,password:p}),
  refresh: () => j('POST','/auth/refresh'),
  logout: () => j('POST','/auth/logout'),
  me: (token: string) => j('GET','/auth/me', undefined, token),
  recentPuzzles: () => fetch(BASE + '/puzzles/recent', { credentials:'include' }).then(r=>r.json()),
  getPuzzle: (id: string, token?: string) => {
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(BASE + '/puzzles/' + id, { headers, credentials: 'include' }).then(r=>r.json());
  },
  attemptPuzzle: (token: string, id: string, guesses: any[]) => fetch(BASE + '/puzzles/' + id + '/attempt', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token }, body: JSON.stringify({ guesses }) }).then(async r=>{ if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'attempt_failed'); return r.json(); }),
  attempts: (id: string, token?: string) => {
    const headers: Record<string,string> = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(BASE + '/puzzles/' + id + '/attempts', { headers, credentials: 'include' }).then(r=>r.json());
  },
  solution: (token: string, id: string) => fetch(BASE + '/puzzles/' + id + '/solution', { headers: { Authorization: 'Bearer ' + token } }).then(async r=> { if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'solution_failed'); return r.json(); }),
  original: (token: string, id: string) => fetch(BASE + '/puzzles/' + id + '/original', { headers: { Authorization: 'Bearer ' + token } }).then(async r=> { if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'original_failed'); return r.json(); }),
  mine: (token: string) => fetch(BASE + '/puzzles/mine', { headers: { Authorization: 'Bearer ' + token } }).then(async r=> { if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'mine_failed'); return r.json(); }),
  deletePuzzle: (token: string, id: string) => fetch(BASE + '/puzzles/' + id, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } }).then(async r=> { if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'delete_failed'); return r.json(); }),
  deleteAttempt: (token: string, puzzleId: string, attemptId: string) => fetch(BASE + '/puzzles/' + puzzleId + '/attempts/' + attemptId, { method:'DELETE', headers: { Authorization: 'Bearer ' + token } }).then(async r=> { if(!r.ok) throw new Error((await r.json().catch(()=>({})))?.error || 'delete_attempt_failed'); return r.json(); }),
  leaderboard: () => fetch(BASE + '/leaderboard').then(r=>r.json()),
  createPuzzle: async (token: string, file: File, meta: any) => {
    const fd = new FormData();
    fd.append('image', file);
    fd.append('meta', JSON.stringify(meta));
    const res = await fetch(BASE + '/puzzles', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
    if (!res.ok) throw new Error((await res.json().catch(()=>({})))?.error || 'upload_failed');
    return res.json();
  }
};