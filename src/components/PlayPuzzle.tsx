import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

interface PuzzleMeta { id:string; width:number; height:number; blackout:{x:number,y:number,w:number,h:number}; grid:{cols:number;rows:number}; image:string; pointsCount:number }
interface Guess { x:number; y:number; index:number }

export function PlayPuzzle({ id, accessToken, onClose }: { id:string; accessToken:string|null; onClose:()=>void }) {
  const [puzzle, setPuzzle] = useState<PuzzleMeta|null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [result, setResult] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]|null>(null);
  const [solution, setSolution] = useState<any[]|null>(null);
  const [solError, setSolError] = useState('');
  const imgRef = useRef<HTMLImageElement|null>(null);
  const [natural, setNatural] = useState({ w:0,h:0 });
  const [scale, setScale] = useState(1);

  useEffect(()=>{ setLoading(true); api.getPuzzle(id).then(setPuzzle).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); }, [id]);
  const recalcScale = () => {
    const img = imgRef.current; if (!img) return;
    const w = img.clientWidth;
    if (natural.w) setScale(w / natural.w);
  };
  useEffect(()=>{
    const img = imgRef.current; if (!img) return;
    const onLoad = () => { const nw = img.naturalWidth, nh = img.naturalHeight; setNatural({ w: nw, h: nh }); setTimeout(()=>recalcScale(),0); };
    if (img.complete) onLoad(); else img.addEventListener('load', onLoad, { once:true });
  }, [puzzle?.image]);
  useEffect(()=>{ window.addEventListener('resize', recalcScale); return ()=> window.removeEventListener('resize', recalcScale); }, [natural.w]);
  useEffect(()=>{ api.attempts(id).then(d=> setScoreboard(d.items||[])).catch(()=>{}); }, [id, result]);

  const addGuess = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!puzzle || result) return;
    if (!imgRef.current) return;
    if (guesses.length >= puzzle.pointsCount) return;
    const rect = (e.currentTarget).getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left)/scale);
  const y = Math.round((e.clientY - rect.top)/scale);
    setGuesses(gs => [...gs, { x, y, index: gs.length }]);
  };

  const guessSize = (():number=>{
    if (scale < 0.5) return 30;
    if (scale < 0.75) return 24;
    if (scale < 1) return 20;
    return 18;
  })();

  const submit = async () => {
    if (!accessToken || !puzzle) return;
    try {
      const r = await api.attemptPuzzle(accessToken, puzzle.id, guesses);
      setResult(r);
    } catch (e:any) { setError(e.message||'attempt_failed'); }
  };

  const reveal = async () => {
    if (!accessToken || solution || !puzzle) return;
    try { const s = await api.solution(accessToken, puzzle.id); setSolution(s.points); }
    catch(e:any){ setSolError(e.message||'solution_failed'); }
  };

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Spielen</h2>
        <button onClick={onClose}>Schließen</button>
      </div>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {puzzle && (
        <div>
          <div style={{position:'relative',border:'1px solid #222',width:'100%',overflow:'hidden',marginBottom:'0.75rem',touchAction:'none'}} onClick={addGuess}>
            <img ref={imgRef} src={puzzle.image} style={{display:'block',width:'100%',height:'auto'}} />
            <div style={{position:'absolute',left:puzzle.blackout.x*scale,top:puzzle.blackout.y*scale,width:puzzle.blackout.w*scale,height:puzzle.blackout.h*scale,background:'#0f1115',opacity:.85}} />
            {guesses.map(g => {
              const size = guessSize; const offset = size/2;
              return (
                <div key={g.index} style={{position:'absolute',left:g.x*scale-offset+1,top:g.y*scale-offset+1,width:size,height:size,borderRadius:size/2,background:'#ff4fa3',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(10,size*0.45),fontWeight:700,color:'#111',boxShadow:'0 0 0 1px #3a0c21'}}>{g.index+1}</div>
              );
            })}
          </div>
          <p className="hint">Klicke ins Bild um {puzzle.pointsCount - guesses.length} weitere Punkte zu raten.</p>
          <div className="btn-row">
            <button onClick={()=> setGuesses(g=>g.slice(0,-1))} disabled={!guesses.length || !!result}>Zurück</button>
            <button onClick={()=> setGuesses([])} disabled={!guesses.length || !!result}>Reset</button>
            <button onClick={submit} disabled={!accessToken || guesses.length !== puzzle.pointsCount || !!result}>Absenden</button>
          </div>
          {result && (
            <div style={{marginTop:'0.75rem'}}>
              <h3>Ergebnis</h3>
              <p>Score Gesamt: <strong>{result.scoreTotal}</strong> (max {result.perPoint.length*100})</p>
              <ul style={{fontSize:12,columns:2,gap:'1rem'}}>
                {result.perPoint.map((p:any)=>(<li key={p.index}>#{p.index+1}: Dist {p.distance}px Score {p.score}</li>))}
              </ul>
              <div className="btn-row">
                <button onClick={reveal} disabled={!accessToken || !!solution}>Lösung anzeigen</button>
              </div>
              {solError && <div className="error-box" style={{marginTop:8}}>{solError}</div>}
              {solution && (
                <div style={{marginTop:'0.5rem'}}>
                  <p className="hint">Original-Punkte eingeblendet.</p>
                  <div style={{position:'relative',border:'1px solid #222',maxWidth:'100%',overflow:'hidden'}}>
                    <img src={puzzle.image} style={{display:'block',maxWidth:'100%',opacity:0.35}} />
                    {solution.map((pt:any)=>(
                      <div key={pt.index} style={{position:'absolute',left:pt.x-7,top:pt.y-7,width:18,height:18,borderRadius:12,background:'#22c55e',border:'2px solid #fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#05310f'}}>{pt.index+1}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {scoreboard && (
            <div style={{marginTop:'1rem'}}>
              <h3>Leaderboard</h3>
              <ol style={{fontSize:12,margin:0,paddingLeft:'1.1rem',columns:2,gap:'1.5rem'}}>
                {scoreboard.map((s:any)=>(<li key={s.id}>#{s.rank} {s.user} – {s.score}</li>))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}