import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Item { id:string; w:number; h:number; image:string; createdAt:string }

export function RecentPuzzles({ onSelect, refreshKey }: { onSelect?: (id:string)=>void; refreshKey?: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  useEffect(()=>{ setLoading(true); api.recentPuzzles().then(d=>{ setItems(d.items||[]); }).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); }, [refreshKey]);
  return (
    <div className="card">
      <h2>Neueste Puzzles</h2>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {!loading && !error && !items.length && <div className="hint">Keine Puzzles vorhanden.</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:'0.75rem'}}>
        {items.map(p=> (
          <button key={p.id} className="puzzle-thumb" onClick={()=>onSelect?.(p.id)} style={{padding:0,background:'#161b22'}}>
            <div style={{position:'relative',width:'100%',paddingBottom:'70%',overflow:'hidden',borderRadius:10}}>
              <img src={p.image} alt="puzzle" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',filter:'contrast(.9) brightness(.9)'}} />
              <div style={{position:'absolute',left:4,top:4,fontSize:10,background:'rgba(0,0,0,.55)',padding:'2px 5px',borderRadius:6}}>{p.w}x{p.h}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}