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
  const [maxImgHeight, setMaxImgHeight] = useState<number|undefined>(undefined);
  const [imgOffset, setImgOffset] = useState({ x:0, y:0 }); // should stay 0,0 now that container matches scaled image
  const [containerSize, setContainerSize] = useState<{w:number;h:number}>({ w:0, h:0 });
  const areaRef = useRef<HTMLDivElement|null>(null);

  useEffect(()=>{ setLoading(true); api.getPuzzle(id).then(p=>{ setPuzzle(p); if (p.attempt) { // already played -> preload result & solution
        setResult({ scoreTotal: p.attempt.scoreTotal, perPoint: p.attempt.perPoint || [], attemptId: p.attempt.id, maxPerPoint: 100, accuracyPercent: p.attempt.accuracyPercent });
        if (p.solutionPoints) setSolution(p.solutionPoints);
        // load original immediately if solution available & token present
        (async()=>{ if (accessToken && p.solutionPoints) { try { const o = await api.original(accessToken, p.id); setOriginalUrl(o.dataUrl); } catch{/*ignore*/} } })();
      }}).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); }, [id, accessToken]);
  const recalcScale = () => {
    if (!natural.w || !natural.h) return;
    const areaW = areaRef.current?.clientWidth || window.innerWidth;
    const chrome = 260; // UI chrome estimate
    const availH = window.innerHeight - chrome;
    const s = Math.min(areaW / natural.w, availH / natural.h, 1); // don't upscale beyond 1
    setScale(s);
    setContainerSize({ w: Math.round(natural.w * s), h: Math.round(natural.h * s) });
    setImgOffset({ x:0, y:0 });
    setMaxImgHeight(availH > 300 ? availH : undefined);
  };
  useEffect(()=>{
    const img = imgRef.current; if (!img) return;
    const onLoad = () => { const nw = img.naturalWidth, nh = img.naturalHeight; setNatural({ w: nw, h: nh }); setTimeout(()=>recalcScale(),0); };
    if (img.complete) onLoad(); else img.addEventListener('load', onLoad, { once:true });
  }, [puzzle?.image]);
  useEffect(()=>{ window.addEventListener('resize', recalcScale); return ()=> window.removeEventListener('resize', recalcScale); }, [natural.w, natural.h]);
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
  // Verwende tatsächliches Bild-Rect (nicht Container), falls Bild kleiner als Container (Letterboxing)
  const imgRect = imgRef.current.getBoundingClientRect();
  const x = Math.round((e.clientX - imgRect.left)/scale);
  const y = Math.round((e.clientY - imgRect.top)/scale);
  if (x < 0 || y < 0 || x > natural.w || y > natural.h) return; // outside actual image
    setGuesses(gs => [...gs, { x, y, index: gs.length }]);
  };
  // Recalculate scale when original image replaces masked (could differ in intrinsic size)
  useEffect(()=>{ if (originalUrl) setTimeout(()=> recalcScale(), 50); }, [originalUrl]);
  // Also update offset/scale on scroll (layout shifts)
  useEffect(()=>{ const onScroll = () => recalcScale(); window.addEventListener('scroll', onScroll, true); return ()=> window.removeEventListener('scroll', onScroll, true); }, [natural.w]);

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
      // Auto solution + original
      if (!solution) {
        try {
          const s = await api.solution(accessToken, puzzle.id); setSolution(s.points);
        } catch(e:any){ setSolError(e.message||'solution_failed'); }
      }
      if (!originalUrl) {
        try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); } catch(e:any){ setOrigErr(e.message||'original_failed'); }
      }
    } catch (e:any) { setError(e.message||'attempt_failed'); }
  };

  // Auto reveal original+solution after submission when already have result (backend returns attempt) but no solution yet
  useEffect(()=>{ if (puzzle && result && !solution && puzzle.solutionPoints) { setSolution(puzzle.solutionPoints); if (accessToken) { api.original(accessToken, puzzle.id).then(o=> setOriginalUrl(o.dataUrl)).catch(()=>{}); } } }, [puzzle, result, solution, accessToken]);

  // Firework effects: per-point (>=90) + overall accuracy (>85%) (trigger once)
  const firedRef = useRef(false);
  useEffect(()=>{
    if (!result || !imgRef.current || firedRef.current) return;
    const container = imgRef.current.parentElement; if(!container) return;
    const good = result.perPoint?.filter((p:any)=>p.score>=90) || [];
    const baseScale = (imgRef.current!.clientWidth / (natural.w||1)) || 1;
    good.forEach((p:any,i:number)=>{
      const el = document.createElement('div');
      el.className='fx-hit';
      const guess = guesses[p.index];
      const x = guess? guess.x*baseScale + imgOffset.x : imgOffset.x;
      const y = guess? guess.y*baseScale + imgOffset.y : imgOffset.y;
      el.style.left = (x -5)+'px';
      el.style.top = (y -5)+'px';
      container.appendChild(el);
      setTimeout(()=> el.remove(), 1200 + i*50);
    });
    const overallAcc = result.accuracyPercent ?? (result.perPoint.length? (result.scoreTotal/(result.perPoint.length*100))*100:0);
    if (overallAcc > 85) {
      // central celebratory burst
      const el = document.createElement('div');
      el.className='fx-hit';
      el.style.left='50%';
      el.style.top='50%';
      el.style.transform='translate(-50%,-50%) scale(1.4)';
      el.style.background='radial-gradient(circle,#fff,#4f9cff,#1d4ed8)';
      container.appendChild(el);
      setTimeout(()=> el.remove(), 1600);
    }
    firedRef.current = true;
  }, [result, natural.w, guesses]);

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Spielen</h2>
        <button onClick={onClose}>Schließen</button>
      </div>
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{error}</div>}
      {puzzle && (
        <div ref={areaRef}>
          <div style={{position:'relative',border:'1px solid #222',width:containerSize.w? containerSize.w: '100%',height:containerSize.h? containerSize.h: 'auto',overflow:'hidden',margin:'0 auto 0.75rem',touchAction:'none'}} onClick={addGuess}>
            <img ref={imgRef} className={"play-img "+(solution? 'reveal-img '+(!originalUrl? 'blur':''):'')} src={solution ? (originalUrl || puzzle.image) : puzzle.image} style={{display:'block', width:'100%', height:'100%', maxHeight: maxImgHeight? maxImgHeight: undefined, opacity: solution && originalUrl ? 1 : (solution? 0.5:1)}} />
            {/* Solution points (green) once available */}
            {solution && solution.map((pt:any)=>{
              const size=18; const off=size/2; return (
                <div key={'sol'+pt.index} style={{position:'absolute',left:imgOffset.x + pt.x*scale - off,top:imgOffset.y + pt.y*scale - off,width:size,height:size,borderRadius:size/2,background:'#22c55e',border:'2px solid #fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#05310f'}}>{pt.index+1}</div>
              );
            })}
            {/* Other users' guesses (yellow) after solution */}
            {solution && othersGuesses && othersGuesses.map((g:any,i:number)=>{ const size=14; const off=size/2; return <div key={'o'+i} title={g.user} style={{position:'absolute',left:imgOffset.x + g.x*scale-off,top:imgOffset.y + g.y*scale-off,width:size,height:size,borderRadius:size/2,background:'rgba(255,255,0,0.6)',border:'1px solid #333',fontSize:8,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#222'}}>{g.index+1}</div>; })}
            {/* Player guesses (pink) always */}
            {guesses.map(g => { const size = guessSize; const offset = size/2; return (
              <div key={'g'+g.index} style={{position:'absolute',left:imgOffset.x + g.x*scale-offset,top:imgOffset.y + g.y*scale-offset,width:size,height:size,borderRadius:size/2,background:'#ff4fa3',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(10,size*0.45),fontWeight:700,color:'#111',boxShadow:'0 0 0 1px #3a0c21'}}>{g.index+1}</div>
            ); })}
          </div>
          {!result && <p className="hint">Klicke ins Bild um {puzzle.pointsCount - guesses.length} weitere Punkte zu raten.</p>}
          {result && solution && <p className="hint">Auflösung angezeigt – Original lädt {originalUrl? 'fertig':'...'}.</p>}
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
          {solError && <div className="error-box" style={{marginTop:8}}>{solError}</div>}
          {!originalUrl && <p className="hint" style={{marginTop:4}}>Original lädt... (falls nicht erscheint: <button style={{fontSize:11}} onClick={async()=>{ if(!accessToken) return; try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); } catch(e:any){ setOrigErr(e.message||'original_failed'); } }}>erneut laden</button>)</p>}
          {origErr && <div className="error-box" style={{marginTop:4}}>{origErr}</div>}
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