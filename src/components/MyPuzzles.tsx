import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Item { id:string; w:number; h:number; image:string; createdAt:string }

export function MyPuzzles({ token, onPlay }: { token:string; onPlay:(id:string)=>void }) {
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<string| null>(null);
  const refresh = ()=>{ setLoading(true); api.mine(token).then(d=>setItems(d.items||[])).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); };
  useEffect(()=>{ refresh(); },[token]);

  const del = async (id:string)=>{
    if(!confirm('Puzzle wirklich löschen?')) return;
    setBusy(id);
    try { await api.deletePuzzle(token,id); refresh(); }
    catch(e:any){ alert(e.message||'Löschen fehlgeschlagen'); }
    finally{ setBusy(null); }
  };

  const share = (id:string) => {
    const url = window.location.origin + '/#play=' + id;
    navigator.clipboard.writeText(url).catch(()=>{});
    alert('Link kopiert: '+url);
  };

  return (
    <div className="card">
      <h2>Meine Puzzles</h2>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {!loading && !items.length && <div className="hint">Noch keine eigenen Puzzles.</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'0.75rem'}}>
        {items.map(p=> (
          <div key={p.id} className="puzzle-man-card">
            <div style={{position:'relative',width:'100%',paddingBottom:'70%',overflow:'hidden',borderRadius:10,marginBottom:6}}>
              <img src={p.image} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
              <div style={{position:'absolute',left:4,top:4,fontSize:10,background:'rgba(0,0,0,.55)',padding:'2px 5px',borderRadius:6}}>{p.w}x{p.h}</div>
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              <button onClick={()=>onPlay(p.id)} style={{flex:'1 0 48%'}}>Play</button>
              <button onClick={()=>share(p.id)} style={{flex:'1 0 48%'}}>Share</button>
              <button onClick={()=>del(p.id)} disabled={busy===p.id} style={{flex:'1 0 100%',background:'#7f1d1d'}}>{busy===p.id? '...':'Löschen'}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}