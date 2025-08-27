import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Row { rank:number; userId:string; user:string; totalScore:number; attempts:number }

export function GlobalLeaderboard() {
  const [rows,setRows] = useState<Row[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  useEffect(()=>{ setLoading(true); api.leaderboard().then(d=>{ setRows(d.items||[]); }).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); },[]);
  return (
    <div className="card">
      <h2>Leaderboard</h2>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {!loading && !rows.length && <div className="hint">Noch keine Scores.</div>}
      {!!rows.length && (
        <table className="lb-table">
          <thead><tr><th>#</th><th>User</th><th>Score</th><th>Attempts</th></tr></thead>
          <tbody>
            {rows.map(r=> <tr key={r.userId}><td>{r.rank}</td><td>{r.user}</td><td>{r.totalScore}</td><td>{r.attempts}</td></tr>)}
          </tbody>
        </table>
      )}
    </div>
  );
}