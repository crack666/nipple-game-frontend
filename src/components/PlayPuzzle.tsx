import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

interface PuzzleMeta { id:string; width:number; height:number; blackout:{x:number,y:number,w:number,h:number}; grid:{cols:number;rows:number}; image:string; pointsCount:number; attempt?: any; solutionPoints?: any[]; createdBy?:string; createdByUsername?:string }
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
  // Toggle states for different marker types
  const [showSolution, setShowSolution] = useState(true);
  const [showOwn, setShowOwn] = useState(true);
  const [showTopTips, setShowTopTips] = useState(true); // Show 3 best tips
  const [showWorstTips, setShowWorstTips] = useState(true); // Show 3 worst tips  
  const [showAllOthers, setShowAllOthers] = useState(false); // Show all other tips
  const [highlightedUser, setHighlightedUser] = useState<string | null>(null); // For highlighting specific user's guesses
  
  // Determine if we're in view mode (puzzle already attempted by this user)
  const isViewMode = Boolean(puzzle?.attempt);
  const canPlay = accessToken && !isViewMode;

  const errorMessages: Record<string, string> = {
    'attempt_exists': 'Du hast dieses Puzzle bereits gespielt! Du kannst es aber weiterhin betrachten.',
    'unauthorized': 'Bitte melde dich an, um zu spielen.',
    'puzzle_not_found': 'Puzzle nicht gefunden.',
    'guess_count_mismatch': 'Ungültige Anzahl an Tipps.',
    'bad_indexes': 'Ungültige Tipp-Indizes.',
    'guess_out_of_bounds': 'Tipps müssen innerhalb des Bildes liegen.',
    'attempt_failed': 'Fehler beim Speichern deiner Tipps.',
    'solution_failed': 'Lösung konnte nicht geladen werden.',
    'original_failed': 'Original-Bild konnte nicht geladen werden.'
  };

  const getErrorMessage = (error: string) => errorMessages[error] || error;

  useEffect(()=>{ 
    setLoading(true); 
    api.getPuzzle(id, accessToken || undefined).then(p=>{ 
      setPuzzle(p); 
      if (p.attempt) { 
        // already played -> preload result & solution & own guesses
        setResult({ 
          scoreTotal: p.attempt.scoreTotal, 
          perPoint: p.attempt.perPoint || [], 
          attemptId: p.attempt.id, 
          maxPerPoint: 100, 
          accuracyPercent: p.attempt.accuracyPercent 
        });
        // Load own guesses from attempt
        if (p.attempt.guesses) {
          setGuesses(p.attempt.guesses);
        }
        if (p.solutionPoints) setSolution(p.solutionPoints);
        // load original immediately if solution available & token present
        (async()=>{ 
          if (accessToken && p.solutionPoints) { 
            try { 
              const o = await api.original(accessToken, p.id); 
              setOriginalUrl(o.dataUrl); 
            } catch{/*ignore*/} 
          } 
        })();
      }
    }).catch(e=>setError(e.message||'Fehler')).finally(()=>setLoading(false)); 
  }, [id, accessToken]);
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
  useEffect(()=>{ api.attempts(id, accessToken || undefined).then(d=> { setScoreboard(d.items||[]); if (d.canSeeGuesses && d.items) {
      const agg: any[] = [];
      d.items.forEach((it:any)=>{ 
        // Filter out own guesses - check both userId and username for safety
        const isOwnUser = (userId && (it.userId === userId || it.user === userId));
        if (it.guesses && !isOwnUser) { 
          agg.push(...it.guesses.map((g:any)=>({...g,user:it.user}))); 
        } 
      });
      setOthersGuesses(agg);
    } }).catch(()=>{}); }, [id, result, userId, accessToken]);

  const addGuess = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!puzzle || result || !canPlay) return; // Block if in view mode
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
        } catch(e:any){ setSolError(getErrorMessage(e.message)||'solution_failed'); }
      }
      if (!originalUrl) {
        try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); } catch(e:any){ setOrigErr(getErrorMessage(e.message)||'original_failed'); }
      }
    } catch (e:any) { 
      const msg = getErrorMessage(e.message);
      if (e.message === 'attempt_exists') {
        // Not an error - show solution instead
        setError('');
        try {
          const s = await api.solution(accessToken, puzzle.id); setSolution(s.points);
          const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl);
        } catch{}
      } else {
        setError(msg);
      }
    }
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

  // Smart filtering for others' guesses - show top 3 and worst 3 by default
  const getFilteredOthersGuesses = () => {
    if (!othersGuesses) return [];
    
    // If specific user highlighted, show only their guesses
    if (highlightedUser) {
      return othersGuesses.filter(g => g.user === highlightedUser);
    }
    
    // If "show all" is enabled, return all
    if (showAllOthers) {
      return othersGuesses;
    }
    
    // Smart filtering: show top and worst tips
    const filtered: any[] = [];
    
    if ((showTopTips || showWorstTips) && result) {
      // Calculate accuracy for all tips
      const tipsWithAccuracy = othersGuesses.map(g => {
        const perPoint = result.perPoint?.find((p:any) => p.index === g.index);
        return { ...g, accuracy: perPoint?.score || 0 };
      });
      
      // Sort by accuracy (highest first)
      const sortedTips = tipsWithAccuracy.sort((a, b) => b.accuracy - a.accuracy);
      
      // If there are 6 or fewer tips, show all instead of splitting into best/worst
      if (sortedTips.length <= 6) {
        if (showTopTips || showWorstTips) {
          // Show all tips categorized as "others" to avoid confusion
          filtered.push(...sortedTips.map(tip => ({ ...tip, category: 'others' })));
        }
      } else {
        // Enough tips to meaningfully separate best and worst
        if (showTopTips) {
          // Get top 3 tips
          const bestTips = sortedTips.slice(0, 3).map(tip => ({ ...tip, category: 'best' }));
          filtered.push(...bestTips);
        }
        
        if (showWorstTips) {
          // Get worst 3 tips (from the end of sorted array)
          const worstTips = sortedTips.slice(-3).map(tip => ({ ...tip, category: 'worst' }));
          filtered.push(...worstTips);
        }
      }
    }
    
    // Remove duplicates (in case same tip is both good and bad)
    const uniqueFiltered = filtered.filter((tip, index, self) => 
      index === self.findIndex(t => t.x === tip.x && t.y === tip.y && t.user === tip.user && t.index === tip.index)
    );
    
    return uniqueFiltered;
  };

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2>Spielen</h2>
        <button onClick={onClose}>Schließen</button>
      </div>
      {puzzle?.createdByUsername && (
        <div style={{marginBottom:'0.5rem', padding:'0.25rem 0.5rem', background:'rgba(34,197,94,0.1)', borderRadius:'6px', fontSize:'0.85rem', color:'#22c55e'}}>
          👤 Erstellt von: <strong>{puzzle.createdByUsername}</strong>
        </div>
      )}
      {loading && <div className="hint">lädt...</div>}
      {error && <div className="error-box">{getErrorMessage(error)}</div>}
      {puzzle && (
        <div ref={areaRef}>
          {/* Toggle Controls */}
          {(isViewMode || solution) && (
            <div style={{marginBottom:'0.75rem', padding:'0.5rem', background:'#1a1f26', borderRadius:'8px', fontSize:'0.8rem'}}>
              <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap', alignItems:'center'}}>
                <span style={{fontWeight:600, marginRight:'0.5rem'}}>Anzeigen:</span>
                <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                  <input type="checkbox" checked={showSolution} onChange={e => setShowSolution(e.target.checked)} style={{minWidth:'1rem', minHeight:'1rem'}} />
                  <span style={{color:'#22c55e'}}>● Lösung</span>
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                  <input type="checkbox" checked={showOwn} onChange={e => setShowOwn(e.target.checked)} style={{minWidth:'1rem', minHeight:'1rem'}} />
                  <span style={{color:'#ff4fa3'}}>● Meine Tipps</span>
                </label>
                {/* Smart toggle logic based on number of other tips */}
                {othersGuesses && othersGuesses.length > 6 ? (
                  // Enough tips for meaningful best/worst split
                  <>
                    <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                      <input type="checkbox" checked={showTopTips} onChange={e => setShowTopTips(e.target.checked)} style={{minWidth:'1rem', minHeight:'1rem'}} />
                      <span style={{color:'#3b82f6', fontSize:'0.8rem', lineHeight:'1.2'}}>● Beste Tipps (Top 3)</span>
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                      <input type="checkbox" checked={showWorstTips} onChange={e => setShowWorstTips(e.target.checked)} style={{minWidth:'1rem', minHeight:'1rem'}} />
                      <span style={{color:'#dc2626', fontSize:'0.8rem', lineHeight:'1.2'}}>● Schlechteste Tipps (3)</span>
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                      <input type="checkbox" checked={showAllOthers} onChange={e => setShowAllOthers(e.target.checked)} style={{minWidth:'1rem', minHeight:'1rem'}} />
                      <span style={{color:'#6b7280', fontSize:'0.8rem', lineHeight:'1.2'}}>● Alle anderen Tipps</span>
                    </label>
                  </>
                ) : (
                  // Few tips - just show simple toggle
                  <label style={{display:'flex', alignItems:'center', gap:'0.4rem', cursor:'pointer', padding:'0.25rem', minHeight:'2.5rem', touchAction:'manipulation'}}>
                    <input 
                      type="checkbox" 
                      checked={showTopTips || showWorstTips || showAllOthers} 
                      onChange={e => {
                        if (e.target.checked) {
                          setShowTopTips(true);
                          setShowWorstTips(false);
                          setShowAllOthers(false);
                        } else {
                          setShowTopTips(false);
                          setShowWorstTips(false);
                          setShowAllOthers(false);
                        }
                      }} 
                      style={{minWidth:'1rem', minHeight:'1rem'}} 
                    />
                    <span style={{color:'#6b7280', fontSize:'0.8rem', lineHeight:'1.2'}}>● Andere Tipps ({othersGuesses?.length || 0})</span>
                  </label>
                )}
              </div>
            </div>
          )}
          
          <div style={{position:'relative',border:'1px solid #222',width:containerSize.w? containerSize.w: '100%',height:containerSize.h? containerSize.h: 'auto',overflow:'hidden',margin:'0 auto 0.75rem',touchAction:'none'}} onClick={addGuess}>
            <img ref={imgRef} className={"play-img "+(solution? 'reveal-img '+(!originalUrl? 'blur':''):'')} src={solution ? (originalUrl || puzzle.image) : puzzle.image} style={{display:'block', width:'100%', height:'100%', maxHeight: maxImgHeight? maxImgHeight: undefined, opacity: solution && originalUrl ? 1 : (solution? 0.5:1)}} />
            {/* Solution points (green) once available */}
            {showSolution && solution && solution.map((pt:any)=>{
              const size=18; const off=size/2; return (
                <div key={'sol'+pt.index} style={{position:'absolute',left:imgOffset.x + pt.x*scale - off,top:imgOffset.y + pt.y*scale - off,width:size,height:size,borderRadius:size/2,background:'#22c55e',border:'2px solid #fff',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',color:'#05310f'}}>{pt.index+1}</div>
              );
            })}
            {/* Other users' guesses (yellow) in view mode or after solution */}
            {(showTopTips || showWorstTips || showAllOthers) && (isViewMode || solution) && getFilteredOthersGuesses()?.map((g:any,i:number)=>{ 
              const size=16; // Slightly larger for initials
              const off=size/2; 
              const isHighlighted = highlightedUser === g.user;
              
              // Get user initials (first 2 characters or first letter of each word)
              const getInitials = (name: string) => {
                if (!name) return '?';
                const words = name.trim().split(' ');
                if (words.length === 1) {
                  return words[0].substring(0, 2).toUpperCase();
                } else {
                  return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
                }
              };
              
              // Determine colors based on category
              let backgroundColor, borderColor;
              if (g.category === 'best') {
                backgroundColor = isHighlighted ? 'rgba(59,130,246,0.9)' : 'rgba(59,130,246,0.7)'; // Blue for best
                borderColor = isHighlighted ? '#1d4ed8' : '#2563eb';
              } else if (g.category === 'worst') {
                backgroundColor = isHighlighted ? 'rgba(220,38,38,0.9)' : 'rgba(220,38,38,0.7)'; // Red for worst  
                borderColor = isHighlighted ? '#991b1b' : '#dc2626';
              } else {
                backgroundColor = isHighlighted ? 'rgba(107,114,128,0.9)' : 'rgba(107,114,128,0.7)'; // Gray for others
                borderColor = isHighlighted ? '#374151' : '#6b7280';
              }
              
              const borderWidth = isHighlighted ? '2px' : '1px';
              return <div key={'o'+i} 
                title={`${g.user} - Punkt ${g.index+1}${g.accuracy ? ` (${Math.round(g.accuracy)}%)` : ''}`} 
                style={{
                  position:'absolute',
                  left:imgOffset.x + g.x*scale-off,
                  top:imgOffset.y + g.y*scale-off,
                  width:size,
                  height:size,
                  borderRadius:size/2,
                  background:backgroundColor,
                  border:`${borderWidth} solid ${borderColor}`,
                  fontSize:7,
                  fontWeight:700,
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'center',
                  color:'white',
                  transform: isHighlighted ? 'scale(1.3)' : 'scale(1)',
                  zIndex: isHighlighted ? 10 : 1,
                  transition: 'all 0.2s ease'
                }}>{getInitials(g.user)}</div>; 
            })}
            {/* Player guesses (pink) always */}
            {showOwn && guesses.map(g => { 
              const size = guessSize; 
              const offset = size/2; 
              
              // Check if current user is highlighted (when they highlight themselves in leaderboard)
              const isOwnUserHighlighted = highlightedUser && scoreboard?.find(s => 
                s.user === highlightedUser && userId && (s.userId === userId || s.user === userId)
              );
              const shouldHighlight = isOwnUserHighlighted;
              
              return (
                <div key={'g'+g.index} 
                  style={{
                    position:'absolute',
                    left:imgOffset.x + g.x*scale-offset,
                    top:imgOffset.y + g.y*scale-offset,
                    width:size,
                    height:size,
                    borderRadius:size/2,
                    background:'#ff4fa3',
                    border: shouldHighlight ? '3px solid #ff6600' : '2px solid #fff',
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:Math.max(10,size*0.45),
                    fontWeight:700,
                    color:'#111',
                    boxShadow: shouldHighlight ? '0 0 0 2px #ff6600, 0 0 8px rgba(255,102,0,0.3)' : '0 0 0 1px #3a0c21',
                    transform: shouldHighlight ? 'scale(1.2)' : 'scale(1)',
                    zIndex: shouldHighlight ? 15 : 5,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {g.index+1}
                </div>
              ); 
            })}
          </div>
          {!result && canPlay && <p className="hint">Klicke ins Bild um {puzzle.pointsCount - guesses.length} weitere Punkte zu raten.</p>}
          {!result && isViewMode && <p className="hint">🔍 <strong>Ansichtsmodus</strong> - Du hast dieses Puzzle bereits gespielt. Deine Tipps und die Lösung werden angezeigt.</p>}
          {result && solution && <p className="hint">Auflösung angezeigt – Original lädt {originalUrl? 'fertig':'...'}.</p>}
          {canPlay && (
            <div className="btn-row">
              <button onClick={()=> setGuesses(g=>g.slice(0,-1))} disabled={!guesses.length || !!result}>Zurück</button>
              <button onClick={()=> setGuesses([])} disabled={!guesses.length || !!result}>Reset</button>
              <button onClick={submit} disabled={!accessToken || guesses.length !== puzzle.pointsCount || !!result}>Absenden</button>
            </div>
          )}
      {result && (
        <div style={{marginTop:'0.75rem'}}>
          <h3>Ergebnis</h3>
          <p>Score Gesamt: <strong>{result.scoreTotal}</strong> (max {result.perPoint.length*100}) – Accuracy: <strong>{result.accuracyPercent ?? Math.round((result.scoreTotal/(result.perPoint.length*100))*10000)/100}%</strong></p>
          <ul style={{fontSize:12,columns:2,gap:'1rem'}}>
            {result.perPoint.map((p:any)=>(<li key={p.index}>#{p.index+1}: Dist {p.distance}px Score {p.score}</li>))}
          </ul>
          {solError && <div className="error-box" style={{marginTop:8}}>{getErrorMessage(solError)}</div>}
          {!originalUrl && <p className="hint" style={{marginTop:4}}>Original lädt... (falls nicht erscheint: <button style={{fontSize:11}} onClick={async()=>{ if(!accessToken) return; try { const o = await api.original(accessToken, puzzle.id); setOriginalUrl(o.dataUrl); } catch(e:any){ setOrigErr(getErrorMessage(e.message)||'original_failed'); } }}>erneut laden</button>)</p>}
          {origErr && <div className="error-box" style={{marginTop:4}}>{getErrorMessage(origErr)}</div>}
          
          {/* Admin: Delete Attempts (always visible for testing) */}
          {scoreboard && (
            <div style={{marginTop:'1rem', padding:'0.5rem', background:'#2d1b1b', borderRadius:'8px', border:'1px solid #7f1d1d'}}>
              <h4 style={{margin:'0 0 0.5rem', fontSize:'0.8rem', color:'#ff6b6b'}}>🔧 Admin: Attempts verwalten</h4>
              <div style={{display:'flex', gap:'0.5rem', flexWrap:'wrap'}}>
                {scoreboard.map((attempt:any) => (
                  <button key={attempt.id} 
                    style={{fontSize:'0.7rem', padding:'0.3rem 0.5rem', background:'#7f1d1d'}}
                    onClick={async () => {
                      if (!confirm(`Attempt von ${attempt.user} löschen?`)) return;
                      try {
                        await api.deleteAttempt(accessToken!, puzzle.id, attempt.id);
                        window.location.reload();
                      } catch(e:any) {
                        alert(getErrorMessage(e.message) || 'Löschen fehlgeschlagen');
                      }
                    }}>
                    ❌ {attempt.user}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
          {scoreboard && (
            <div style={{marginTop:'1rem'}}>
              <h3>Puzzle Leaderboard</h3>
              {(isViewMode || solution) && (
                <div style={{marginBottom:'0.5rem', fontSize:'0.8rem', color:'#888'}}>
                  💡 Klicke auf einen Spieler, um nur seine Tipps zu sehen, oder hover über die Zeile für Vorschau
                </div>
              )}
              <table className="lb-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Spieler</th>
                    <th>Score</th>
                    <th>Accuracy</th>
                    {(isViewMode || solution) && <th>Tipps</th>}
                  </tr>
                </thead>
                <tbody>
                  {scoreboard.map((s:any, index:number)=>(
                    <tr 
                      key={s.id} 
                      style={{
                        backgroundColor: (userId && (s.userId === userId || s.user === userId)) ? 'rgba(79,156,255,0.1)' : 
                                        highlightedUser === s.user ? 'rgba(255,165,0,0.1)' : 'transparent',
                        cursor: (isViewMode || solution) ? 'pointer' : 'default',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={() => (isViewMode || solution) && setHighlightedUser(s.user)}
                      onMouseLeave={() => setHighlightedUser(null)}
                      onClick={() => {
                        if (!(isViewMode || solution)) return;
                        setHighlightedUser(highlightedUser === s.user ? null : s.user);
                      }}
                    >
                      <td>#{s.rank}</td>
                      <td>
                        <span style={{fontWeight: highlightedUser === s.user ? 'bold' : 'normal'}}>
                          {s.user}
                        </span>
                        {highlightedUser === s.user && ' 👈'}
                      </td>
                      <td>{s.score}</td>
                      <td>{s.accuracyPercent ?? Math.round((s.score/(puzzle.pointsCount*100))*10000)/100}%</td>
                      {(isViewMode || solution) && (
                        <td>
                          {highlightedUser === s.user ? 
                            <span style={{color:'#ff6600', fontWeight:'bold'}}>● Angezeigt</span> : 
                            <span style={{color:'#888', fontSize:'0.8rem'}}>Klicken</span>
                          }
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(isViewMode || solution) && (
                <div style={{marginTop:'0.5rem', fontSize:'0.75rem', color:'#666'}}>
                  📱 <strong>Mobile:</strong> Tippe auf einen Spieler um seine Tipps zu markieren
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}