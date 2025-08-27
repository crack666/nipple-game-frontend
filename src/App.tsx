import { useEffect, useState, FormEvent } from 'react';
import { api } from './api/client';
import { CreatePuzzle } from './components/CreatePuzzle';
import { RecentPuzzles } from './components/RecentPuzzles';
import { PlayPuzzle } from './components/PlayPuzzle';

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

  useEffect(() => { api.health().then(h => setHealth(h.status)).catch(() => setHealth('offline')); }, []);

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
    try {
      const res = mode === 'login' ? await api.login(username, password) : await api.register(username, password);
      setAccessToken(res.accessToken);
      setUser(res.user);
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'Fehler');
    } finally { setLoading(false); }
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
        <h1>Bild Rätsel</h1>
        <div className="status-pill" data-state={health}>{health}</div>
      </header>
      {!user && (
        <div className="card auth-card">
          <div className="mode-toggle">
            <button className={mode==='login'? 'active': ''} onClick={()=>setMode('login')}>Login</button>
            <button className={mode==='register'? 'active': ''} onClick={()=>setMode('register')}>Registrieren</button>
          </div>
          <form onSubmit={submit} className="form-grid">
            <label>Benutzername
              <input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" required />
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
          <div className="card">
            <h2>Angemeldet</h2>
              <p>Hallo <strong>{user.username}</strong></p>
              <div className="btn-row">
                <button onClick={me}>/auth/me</button>
                <button onClick={refresh}>Refresh</button>
                <button onClick={logout}>Logout</button>
              </div>
              <p className="token-preview">Access Token: {accessToken?.slice(0,24)}...</p>
          </div>
          <CreatePuzzle accessToken={accessToken!} onCreated={()=> setRefreshFlag(f=>f+1)} />
          {playingId && <PlayPuzzle id={playingId} accessToken={accessToken} onClose={()=> setPlayingId(null)} />}
          <RecentPuzzles refreshKey={refreshFlag} onSelect={(id)=> setPlayingId(id)} />
        </>
      )}
      <footer className="app-footer">MVP – UI wird weiter ausgebaut</footer>
    </div>
  );
}

export default App;
