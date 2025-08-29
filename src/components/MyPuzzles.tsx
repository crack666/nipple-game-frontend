import { useEffect, useState } from 'react';
import { api } from '../api/client';

interface Item { id:string; w:number; h:number; image:string; createdAt:string; createdBy?:string; createdByUsername?:string; attempt?: any }

export function MyPuzzles({ token, onPlay, userId }: { token:string; onPlay:(id:string)=>void; userId?:string }) {
  const [items,setItems]=useState<Item[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<string| null>(null);
  const [puzzleDetails, setPuzzleDetails] = useState<Record<string, any>>({});
  
  const refresh = async ()=>{ 
    setLoading(true); 
    try {
      // Load all recent puzzles instead of just own puzzles
      const d = await api.recentPuzzles();
      setItems(d.items||[]);
      // Check attempt status for each puzzle
      const details: Record<string, any> = {};
      for (const item of d.items || []) {
        try {
          const puzzle = await api.getPuzzle(item.id, token);
          details[item.id] = puzzle;
        } catch {}
      }
      setPuzzleDetails(details);
    } catch(e:any) {
      setError(e.message||'Fehler');
    } finally {
      setLoading(false);
    }
  };
  
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

  const deleteAttemptForPuzzle = async (puzzleId: string) => {
    const attempts = await api.attempts(puzzleId);
    const myAttempt = attempts.items?.find((a:any) => a.userId === userId);
    if (!myAttempt) return;
    
    if (!confirm('Deinen Attempt für dieses Puzzle löschen? Du kannst dann wieder spielen.')) return;
    setBusy(puzzleId);
    try {
      await api.deleteAttempt(token, puzzleId, myAttempt.id);
      refresh();
    } catch(e:any) {
      alert(e.message || 'Attempt löschen fehlgeschlagen');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card">
      <h2>Alle Puzzles</h2>
      <p style={{margin: '0 0 1rem 0', color: '#666', fontSize: '0.9rem'}}>
        Entdecke neue Puzzles oder spiele bereits gespielte erneut. Unerledigte Puzzles werden zuerst angezeigt.
      </p>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {!loading && !items.length && <div className="hint">Keine Puzzles verfügbar.</div>}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'0.75rem'}}>
        {items
          .sort((a, b) => {
            const aHasAttempt = puzzleDetails[a.id]?.attempt;
            const bHasAttempt = puzzleDetails[b.id]?.attempt;
            // Unerledigte zuerst, dann erledigte (neueste zuerst)
            if (!aHasAttempt && bHasAttempt) return -1;
            if (aHasAttempt && !bHasAttempt) return 1;
            // Gleicher Status -> nach Datum sortieren (neueste zuerst)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
          .map(p=> {
          const details = puzzleDetails[p.id];
          const hasAttempt = details?.attempt;
          const isOwnPuzzle = details?.createdBy === userId || p.createdBy === userId;
          return (
            <div key={p.id} className="puzzle-man-card" style={{
              border: hasAttempt ? '2px solid rgba(34,197,94,0.3)' : '2px solid rgba(59,130,246,0.6)',
              background: hasAttempt ? 'rgba(34,197,94,0.05)' : 'rgba(59,130,246,0.05)',
              borderRadius: '12px',
              padding: '0.5rem',
              boxShadow: isOwnPuzzle ? '0 0 0 2px rgba(255,165,0,0.3)' : 'none'
            }}>
              <div style={{position:'relative',width:'100%',paddingBottom:'70%',overflow:'hidden',borderRadius:10,marginBottom:6}}>
                <img src={p.image} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}} />
                <div style={{position:'absolute',left:4,top:4,fontSize:10,background:'rgba(0,0,0,.55)',padding:'2px 5px',borderRadius:6}}>{p.w}x{p.h}</div>
                {/* Creator info */}
                <div style={{position:'absolute',left:4,bottom:4,fontSize:9,background:'rgba(0,0,0,.75)',color:'#fff',padding:'2px 5px',borderRadius:4,maxWidth:'calc(100% - 8px)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {isOwnPuzzle ? '👤 ' : ''}von {p.createdByUsername || details?.createdByUsername || 'Unbekannt'}
                </div>
                {hasAttempt ? (
                  <div style={{position:'absolute',right:4,top:4,fontSize:9,background:'rgba(34,197,94,.9)',color:'#fff',padding:'2px 5px',borderRadius:6,fontWeight:'bold'}}>✅ Erledigt</div>
                ) : (
                  <div style={{position:'absolute',right:4,top:4,fontSize:9,background:'rgba(59,130,246,.9)',color:'#fff',padding:'2px 5px',borderRadius:6,fontWeight:'bold'}}>📝 Zu erledigen</div>
                )}
              </div>
              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                <button onClick={()=>onPlay(p.id)} style={{flex:'1 0 48%'}}>
                  {hasAttempt ? 'View' : 'Play'}
                </button>
                <button onClick={()=>share(p.id)} style={{flex:'1 0 48%'}}>Share</button>
                {hasAttempt && (
                  <button onClick={()=>deleteAttemptForPuzzle(p.id)} disabled={busy===p.id} style={{flex:'1 0 100%',background:'#d97706', fontSize:'0.75rem'}}>
                    {busy===p.id? '...':'Attempt löschen'}
                  </button>
                )}
                {/* Only show delete button for own puzzles */}
                {(details?.createdBy === userId || p.createdBy === userId) && (
                  <button onClick={()=>del(p.id)} disabled={busy===p.id} style={{flex:'1 0 100%',background:'#7f1d1d'}}>{busy===p.id? '...':'Puzzle löschen'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}