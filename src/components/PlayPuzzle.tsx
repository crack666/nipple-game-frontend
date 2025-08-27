import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

interface PuzzleMeta { id:string; width:number; height:number; blackout:{x:number,y:number,w:number,h:number}; grid:{cols:number;rows:number}; image:string; pointsCount:number; attempt?: any; solutionPoints?: any[] }
interface Guess { x:number; y:number; index:number }

export function PlayPuzzle({ id, accessToken, userId, onClose }: { id:string; accessToken:string|null; userId?:string; onClose:()=>void }) {
  const [puzzle, setPuzzle] = useState<PuzzleMeta|null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [result, setResult] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]|null>(null);
  const [solution, setSolution] = useState<any[]|null>(null);
  const [othersGuesses, setOthersGuesses] = useState<any[]|null>(null);
  const [originalUrl, setOriginalUrl] = useState<string|null>(null);
  const [origErr, setOrigErr] = useState('');
  const [solError, setSolError] = useState('');
  const imgRef = useRef<HTMLImageElement|null>(null);
  const [natural, setNatural] = useState({ w:0,h:0 });
  const [scale, setScale] = useState(1);

  useEffect(()=>{ setLoading(true); api.getPuzzle(id).then(p=>{ setPuzzle(p); if (p.attempt) { // already played -> preload result & solution
        setResult({ scoreTotal: p.attempt.scoreTotal, perPoint: p.attempt.perPoint || [], attemptId: p.attempt.id, maxPerPoint: 100, accuracyPercent: p.attempt.accuracyPercent });
        if (p.solutionPoints) setSolution(p.solutionPoints);
        // load original immediately if solution available & token present
        (async()=>{ if (accessToken && p.solutionPoints) { try { const o = await api.original(accessToken, p.id); setOriginalUrl(o.dataUrl); } catch{/*ignore*/} } })();
      }}).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); }, [id, accessToken]);
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
  useEffect(()=>{ api.attempts(id).then(d=> { setScoreboard(d.items||[]); if (d.canSeeGuesses && d.items) {
      const agg: any[] = [];
      d.items.forEach((it:any)=>{ if (it.guesses && (!userId || it.userId !== userId)) { agg.push(...it.guesses.map((g:any)=>({...g,user:it.user}))); } });
      setOthersGuesses(agg);
    } }).catch(()=>{}); }, [id, result, userId]);

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
    try {
      const s = await api.solution(accessToken, puzzle.id); setSolution(s.points);
      try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); }
      catch(e:any){ setOrigErr(e.message||'original_failed'); }
    }
    catch(e:any){ setSolError(e.message||'solution_failed'); }
  };

  // Auto reveal original+solution after submission when already have result (backend returns attempt) but no solution yet
  useEffect(()=>{ if (puzzle && result && !solution && puzzle.solutionPoints) { setSolution(puzzle.solutionPoints); if (accessToken) { api.original(accessToken, puzzle.id).then(o=> setOriginalUrl(o.dataUrl)).catch(()=>{}); } } }, [puzzle, result, solution, accessToken]);

  // Firework on good hits (score >=90 per point) after result
  useEffect(()=>{ if (!result || !imgRef.current) return; const container = imgRef.current.parentElement; if(!container) return; const good = result.perPoint?.filter((p:any)=>p.score>=90) || []; good.forEach((p:any,i:number)=>{ const el = document.createElement('div'); el.className='fx-hit'; const scale = (imgRef.current!.clientWidth / (natural.w||1)) || 1; const x = (p.distance!==null && guesses[p.index]) ? guesses[p.index].x*scale : (p.x||0); const y = (p.distance!==null && guesses[p.index]) ? guesses[p.index].y*scale : (p.y||0); el.style.left = (x*scale -5)+'px'; el.style.top = (y*scale -5)+'px'; container.appendChild(el); setTimeout(()=> el.remove(), 1200 + i*50); }); }, [result]);

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
            <div style={{position:'absolute',left:puzzle.blackout.x*scale,top:puzzle.blackout.y*scale,width:puzzle.blackout.w*scale,height:puzzle.blackout.h*scale,background:'#000',opacity:1}} />
            {guesses.map(g => {
              const size = guessSize; const offset = size/2;
              return (
                <div key={g.index} style={{position:'absolute',left:g.x*scale-offset+1,top:g.y*scale-offset+1,width:size,height:size,borderRadius:size/2,background:'#ff4fa3',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(10,size*0.45),fontWeight:700,color:'#111',boxShadow:'0 0 0 1px #3a0c21'}}>{g.index+1}</div>
              );
            })}
          </div>
          {!result && <p className="hint">Klicke ins Bild um {puzzle.pointsCount - guesses.length} weitere Punkte zu raten.</p>}
          {result && !solution && <p className="hint">Ergebnis gespeichert. Du kannst jetzt die Lösung anzeigen.</p>}
          <div className="btn-row">
            <button onClick={()=> setGuesses(g=>g.slice(0,-1))} disabled={!guesses.length || !!result}>Zurück</button>
            <button onClick={()=> setGuesses([])} disabled={!guesses.length || !!result}>Reset</button>
            <button onClick={submit} disabled={!accessToken || guesses.length !== puzzle.pointsCount || !!result}>Absenden</button>
          </div>
      {result && (
            <div style={{marginTop:'0.75rem'}}>
              <h3>Ergebnis</h3>
        <p>Score Gesamt: <strong>{result.scoreTotal}</strong> (max {result.perPoint.length*100}) – Accuracy: <strong>{result.accuracyPercent ?? Math.round((result.scoreTotal/(result.perPoint.length*100))*10000)/100}%</strong></p>
              <ul style={{fontSize:12,columns:2,gap:'1rem'}}>
                {result.perPoint.map((p:any)=>(<li key={p.index}>#{p.index+1}: Dist {p.distance}px Score {p.score}</li>))}
              </ul>
              <div className="btn-row">
                <button onClick={reveal} disabled={!accessToken || !!solution}>Lösung anzeigen</button>
              </div>
              {solError && <div className="error-box" style={{marginTop:8}}>{solError}</div>}
              {solution && (
                <div style={{marginTop:'0.75rem'}}>
                  <h4>Auflösung</h4>
                  <p className="hint">Deine geratenen Punkte (pink) vs. echte Punkte (grün). Originalbild wird angezeigt sobald verfügbar.</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'1rem'}}>
                    <div style={{flex:'1 1 320px',minWidth:280}}>
                      <div style={{position:'relative',border:'1px solid #222',maxWidth:'100%',overflow:'hidden'}}>
                        <img className={"reveal-img "+(!originalUrl? 'blur':'')} src={originalUrl || puzzle.image} style={{display:'block',maxWidth:'100%',opacity: originalUrl ? 1 : 0.4}} />
                        {solution.map((pt:any)=>(
                          <div key={pt.index} style={{position:'absolute',left:pt.x-7,top:pt.y-7,width:18,height:18,borderRadius:12,background:'#22c55e',border:'2px solid #fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#05310f'}}>{pt.index+1}</div>
                        ))}
                        {othersGuesses && othersGuesses.map((g:any,i)=>{
                          const size=14; const off=size/2;
                          return <div key={'o'+i} title={g.user} style={{position:'absolute',left:g.x-off,top:g.y-off,width:size,height:size,borderRadius:size/2,background:'rgba(255,255,0,0.6)',border:'1px solid #333',fontSize:8,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#222'}}>{g.index+1}</div>;
                        })}
                        {guesses.map(g => {
                          const size = 18; const offset = size/2;
                          return (
                            <div key={'g'+g.index} style={{position:'absolute',left:g.x-offset,top:g.y-offset,width:size,height:size,borderRadius:size/2,background:'#ff4fa3',border:'2px solid #fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#111',boxShadow:'0 0 0 1px #3a0c21'}}>{g.index+1}</div>
                          );
                        })}
                      </div>
                      {!originalUrl && <p className="hint" style={{marginTop:4}}>Original lädt... (falls nicht erscheint: <button style={{fontSize:11}} onClick={async()=>{ if(!accessToken) return; try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); } catch(e:any){ setOrigErr(e.message||'original_failed'); } }}>erneut laden</button>)</p>}
                      {origErr && <div className="error-box" style={{marginTop:4}}>{origErr}</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {scoreboard && (
            <div style={{marginTop:'1rem'}}>
              <h3>Leaderboard</h3>
              <ol style={{fontSize:12,margin:0,paddingLeft:'1.1rem',columns:2,gap:'1.5rem'}}>
                {scoreboard.map((s:any)=>(<li key={s.id}>#{s.rank} {s.user} – {s.score} ({s.accuracyPercent ?? Math.round((s.score/(puzzle.pointsCount*100))*10000)/100}%)</li>))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}