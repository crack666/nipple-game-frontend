import { useEffect, useState, FormEvent } from 'react';
import { api } from './api/client';
import { CreatePuzzle } from './components/CreatePuzzle';
import { RecentPuzzles } from './components/RecentPuzzles';
import { PlayPuzzle } from './components/PlayPuzzle';
import { TabsLayout } from './components/TabsLayout';
import { GlobalLeaderboard } from './components/GlobalLeaderboard';
import { MyPuzzles } from './components/MyPuzzles';

interface User { id: string; username: string }

export function App() {
  const [health, setHealth] = useState('...');
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFlag, setRefreshFlag] = useState(0); // triggers lists refresh later
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'home'|'play'|'create'|'mine'>('home');
  const [recentCache, setRecentCache] = useState<any[]>([]);

  // Hash deep-link (#play=<id>)
  useEffect(()=>{
    const parse = ()=>{
      const m = location.hash.match(/play=([a-f0-9\-]+)/i); if (m) { setPlayingId(m[1]); setTab('play'); }
    };
    parse();
    window.addEventListener('hashchange', parse);
    return ()=> window.removeEventListener('hashchange', parse);
  },[]);

  useEffect(() => { api.health().then(h => setHealth(h.status)).catch(() => setHealth('offline')); }, []);
  // Cache recent puzzles for random play
  useEffect(()=>{ (async()=>{ try { const r = await api.recentPuzzles(); setRecentCache(r.items||[]); } catch{/*ignore*/} })(); }, [refreshFlag, accessToken]);
  // Auto-select random puzzle when entering play tab without selection
  useEffect(()=>{ if (tab==='play' && !playingId && recentCache.length) {
    const unseen = recentCache.filter(p=>!p.attempted);
    const source = unseen.length? unseen : recentCache; // fallback falls alle gespielt
    const pick = source[Math.floor(Math.random()*source.length)]; if (pick) { setPlayingId(pick.id); location.hash='play='+pick.id; }
  } }, [tab, playingId, recentCache]);

  // Silent Refresh beim ersten Laden: versucht Access Token über Refresh Cookie wiederherzustellen
  useEffect(() => {
    if (user || accessToken) return; // schon eingeloggt
    (async () => {
      try {
        const r = await api.refresh();
        setAccessToken(r.accessToken);
        setUser(r.user);
      } catch {/* ignorieren */}
    })();
  }, [user, accessToken]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Trimming für bessere UX
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    
    // Einfache Client-side Validation
    if (trimmedUsername.length < 3) {
      setError('Benutzername muss mindestens 3 Zeichen lang sein');
      setLoading(false);
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
      setError('Benutzername darf nur Buchstaben, Zahlen, _ und - enthalten');
      setLoading(false);
      return;
    }
    if (trimmedPassword.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein');
      setLoading(false);
      return;
    }
    
    try {
      const res = mode === 'login' 
        ? await api.login(trimmedUsername, trimmedPassword) 
        : await api.register(trimmedUsername, trimmedPassword);
      setAccessToken(res.accessToken);
      setUser(res.user);
      setPassword('');
      setUsername(''); // Username auch leeren für nächste Verwendung
    } catch (err: any) {
      setError(err?.message || 'Fehler');
    } finally { 
      setLoading(false); 
    }
  }

  async function refresh() {
    try {
      const r = await api.refresh();
      setAccessToken(r.accessToken);
      setUser(r.user);
    } catch { setError('Refresh fehlgeschlagen'); }
  }

  async function me() {
    if (!accessToken) return;
    try { const m = await api.me(accessToken); setUser(m.user); } catch { setError('Session ungültig'); }
  }

  async function logout() {
    try { await api.logout(); } catch {/* ignore */}
    setUser(null); setAccessToken(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Battle Nips</h1>
        <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
          {user && (
            <>
              <span style={{fontWeight:500}}>{user.username}</span>
              <div className="btn-row" style={{margin:0, gap:'0.5rem'}}>
                <button onClick={refresh} style={{padding:'0.4rem 0.8rem', fontSize:'0.75rem'}}>Refresh</button>
                <button onClick={logout} style={{padding:'0.4rem 0.8rem', fontSize:'0.75rem'}}>Logout</button>
              </div>
            </>
          )}
          <div className="status-pill" data-state={health}>{health}</div>
        </div>
      </header>
      {!user && (
        <div className="card auth-card">
          <div className="mode-toggle">
            <button className={mode==='login'? 'active': ''} onClick={()=>setMode('login')}>Login</button>
            <button className={mode==='register'? 'active': ''} onClick={()=>setMode('register')}>Registrieren</button>
          </div>
          <form onSubmit={submit} className="form-grid">
            <label>Benutzername
              <input 
                value={username} 
                onChange={e=>setUsername(e.target.value)} 
                autoComplete="username" 
                pattern="[a-zA-Z0-9_-]+"
                title="Nur Buchstaben, Zahlen, _ und - erlaubt"
                required 
              />
              <small className="hint">Nur Buchstaben, Zahlen, _ und - erlaubt</small>
            </label>
            <label>Passwort
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==='login'? 'current-password':'new-password'} required />
            </label>
            {error && <div className="error-box">{error}</div>}
            <button disabled={loading}>{loading? '...' : (mode==='login'? 'Einloggen':'Account anlegen')}</button>
          </form>
          <p className="hint">Session bleibt erhalten (Refresh Cookie). Access Token nur im Speicher.</p>
        </div>
      )}
      {user && (
        <>
          <TabsLayout active={tab} onChange={(k)=> setTab(k as any)} tabs={[
            { key:'home', label:'Home' },
            { key:'play', label:'Spielen' },
            { key:'create', label:'Neues Puzzle' },
            { key:'mine', label:'Alle Puzzles' }
          ]} />
          {tab==='home' && (
            <>
              <GlobalLeaderboard />
              <RecentPuzzles refreshKey={refreshFlag} onSelect={(id)=> { setPlayingId(id); setTab('play'); location.hash = 'play='+id; }} />
            </>
          )}
          {tab==='play' && (
            <>
              {playingId ? (
                <PlayPuzzle id={playingId} accessToken={accessToken} userId={user.id} username={user.username} onClose={()=> { setPlayingId(null); location.hash=''; }} />
              ) : (
                <div className="card"><p className="hint">Zufälliges Puzzle wird geladen...</p></div>
              )}
            </>
          )}
          {tab==='create' && <CreatePuzzle accessToken={accessToken!} onCreated={()=> { setRefreshFlag(f=>f+1); setTab('mine'); }} />}
          {tab==='mine' && <MyPuzzles token={accessToken!} userId={user?.id} onPlay={(id)=> { setPlayingId(id); setTab('play'); location.hash='play='+id; }} />}
        </>
      )}
      <footer className="app-footer">MVP – UI wird weiter ausgebaut</footer>
    </div>
  );
}

export default App;
