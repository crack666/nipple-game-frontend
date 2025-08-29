import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../api/client';

interface Props { accessToken: string; onCreated?: (id: string)=>void }
interface Point { x: number; y: number }

export function CreatePuzzle({ accessToken, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  // Blackout & Punkte immer in natürlichen Bildkoordinaten speichern
  const [blackout, setBlackout] = useState({ x:0, y:0, w:100, h:100 });
  const [grid, setGrid] = useState({ cols:10, rows:10 });
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const imgRef = useRef<HTMLImageElement|null>(null);
  const [naturalSize, setNaturalSize] = useState({ w:0, h:0 });
  const [scale, setScale] = useState(1); // Anzeige-Skalierung (displayWidth / naturalWidth)
  const containerRef = useRef<HTMLDivElement|null>(null);
  const [pointMode, setPointMode] = useState(true); // Toggle für Punktsetzung
  const wasDragRef = useRef(false);
  const actionRef = useRef<{mode:'move'|'resize', ox:number, oy:number, start:{x:number,y:number,w:number,h:number}}|null>(null);
  const manualBlackoutRef = useRef(false); // wurde Box bereits manuell verändert?

  const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'];
  const supportedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];

  const onFile = (f: File) => { 
    // Validate file format
    const extension = f.name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(f.type) && !supportedExtensions.includes(extension || '')) {
      setError(`Unsupported format: ${f.type || 'unknown'}. Supported: JPEG, PNG, WebP, GIF, BMP, TIFF`);
      return;
    }
    
    setFile(f); 
    setPoints([]); 
    setStatus(''); 
    setError(''); 
  };

  const addPointAt = (clientX:number, clientY:number) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const dx = clientX - rect.left; const dy = clientY - rect.top;
    if (dx < 0 || dy < 0 || dx > rect.width || dy > rect.height) return;
    const x = Math.round(dx / scale); const y = Math.round(dy / scale);
    setPoints(p => [...p, { x, y }]);
  };

  const submit = async () => {
    if (!file) return;
    setStatus('Uploading...'); setError('');
    try {
  const meta = { blackout: { x: Math.round(blackout.x), y: Math.round(blackout.y), w: Math.round(blackout.w), h: Math.round(blackout.h) }, points, gridCols: grid.cols, gridRows: grid.rows };
      const res = await api.createPuzzle(accessToken, file, meta);
      setStatus('Erstellt: ' + res.id);
      onCreated?.(res.id);
    } catch (e:any) { setError(e.message || 'Fehler'); setStatus(''); }
  };

  // Interaktives Blackout Drag & Resize (in natürlichen Koordinaten)
  const clamp = (v:number, min:number, max:number) => Math.min(Math.max(v, min), max);
  const maxX = (w:number) => naturalSize.w - w;
  const maxY = (h:number) => naturalSize.h - h;
  const maxWidth = (x:number) => naturalSize.w - x;
  const maxHeight = (y:number) => naturalSize.h - y;

  const startMove = (e: React.PointerEvent) => { e.preventDefault(); wasDragRef.current = false; manualBlackoutRef.current = true; actionRef.current = { mode:'move', ox:e.clientX, oy:e.clientY, start:{ ...blackout } }; addDocListeners(); };
  const startResize = (e: React.PointerEvent) => { e.preventDefault(); e.stopPropagation(); wasDragRef.current = false; manualBlackoutRef.current = true; actionRef.current = { mode:'resize', ox:e.clientX, oy:e.clientY, start:{ ...blackout } }; addDocListeners(); };
  const addDocListeners = () => { document.addEventListener('pointermove', onDocMove, { passive:false }); document.addEventListener('pointerup', endAction); };
  const onDocMove = (e: PointerEvent) => {
    if (!actionRef.current) return;
    const { mode, ox, oy, start } = actionRef.current;
  const dx = (e.clientX - ox) / scale; const dy = (e.clientY - oy) / scale;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) wasDragRef.current = true;
  if (mode === 'move') {
      setBlackout(b=>({
        ...b,
        x: Math.round(clamp(start.x + dx, 0, maxX(start.w))),
        y: Math.round(clamp(start.y + dy, 0, maxY(start.h)))
      }));
    } else {
      // Symmetrisches Resize: Box wächst/ schrumpft gleichmäßig in beide Richtungen (Center bleibt stabil, solange kein Rand erreicht)
      setBlackout(_ => {
        let newW = start.w + dx;
        let newH = start.h + dy;
        // Mindestgröße
        newW = Math.max(10, newW);
        newH = Math.max(10, newH);
        // Maximal nicht größer als Bild
        newW = Math.min(newW, naturalSize.w);
        newH = Math.min(newH, naturalSize.h);
        // Ziel-Position: zentriert halten
        let newX = start.x - (newW - start.w)/2;
        let newY = start.y - (newH - start.h)/2;
        // Klammern – wenn an Rand stoßen, Box innerhalb halten (Symmetrie geht dort teilweise verloren, akzeptabel)
        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newW > naturalSize.w) newX = naturalSize.w - newW;
        if (newY + newH > naturalSize.h) newY = naturalSize.h - newH;
        // Final runden
        return {
          x: Math.round(newX),
            y: Math.round(newY),
            w: Math.round(newW),
            h: Math.round(newH)
        };
      });
    }
  };
  const endAction = () => { actionRef.current = null; document.removeEventListener('pointermove', onDocMove); document.removeEventListener('pointerup', endAction); };

  const recalcScale = () => {
    const img = imgRef.current; if (!img) return;
    const displayedW = img.clientWidth;
    if (naturalSize.w) setScale(displayedW / naturalSize.w);
  };
  useEffect(()=>{
    const img = imgRef.current; if (!img || !file) return;
    const onLoad = () => {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      setNaturalSize({ w: nw, h: nh });
      setTimeout(()=>{ recalcScale(); }, 0);
      // Anfangsbox neutral (wird ggf. nach ersten Punkten automatisch angepasst)
      setBlackout({
  w: Math.round(nw * 0.45),
  h: Math.round(nh * 0.45),
  x: Math.round(nw * 0.275),
  y: Math.round(nh * 0.275)
      });
      manualBlackoutRef.current = false;
      setPoints([]);
    };
    if (img.complete) onLoad(); else img.addEventListener('load', onLoad, { once:true });
  }, [file]);
  // Stabilere Skalierung bei Layout-Änderungen
  useEffect(()=>{
    if (!naturalSize.w) return;
    const img = imgRef.current; if (!img) return;
    let raf:number|undefined;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0]; if (!entry) return;
      const w = entry.contentRect.width;
      raf && cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=> setScale(w / naturalSize.w));
    });
    ro.observe(img);
    return ()=> { ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [naturalSize.w]);
  // Automatische Blackout-Anpassung um Punkte herum (solange nicht manuell verschoben)
  useEffect(()=>{
  if (points.length < 2 || !naturalSize.w) return;
    if (manualBlackoutRef.current) return; // User hat angepasst
    let minX = Infinity, minY = Infinity, maxXPt = -Infinity, maxYPt = -Infinity;
    for (const p of points){
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxXPt) maxXPt = p.x; if (p.y > maxYPt) maxYPt = p.y;
    }
    const boxW = Math.max(1, maxXPt - minX);
    const boxH = Math.max(1, maxYPt - minY);
    // Dynamischer Margin: abhängig von Box-Größe, begrenzt durch min/max prozentual
    const marginX = Math.min(
      Math.max(boxW * 0.35, naturalSize.w * 0.03, 24), // mind. 3% oder 24px oder 35% der Box
      naturalSize.w * 0.15 // max 15% des Gesamtbilds
    );
    const marginY = Math.min(
      Math.max(boxH * 0.35, naturalSize.h * 0.03, 24),
      naturalSize.h * 0.15
    );
    let nx = Math.floor(minX - marginX);
    let ny = Math.floor(minY - marginY);
    let nw = Math.ceil(boxW + 2*marginX);
    let nh = Math.ceil(boxH + 2*marginY);
    // Begrenze so, dass immer ein äußerer Rand > 2% bleibt, falls Punkte nicht direkt am Rand liegen
    const edgeSlackX = naturalSize.w * 0.02;
    const edgeSlackY = naturalSize.h * 0.02;
    if (minX > edgeSlackX) nx = Math.max(edgeSlackX, nx);
    if (minY > edgeSlackY) ny = Math.max(edgeSlackY, ny);
    if (maxXPt < naturalSize.w - edgeSlackX) {
      const overRight = (nx + nw) - (naturalSize.w - edgeSlackX);
      if (overRight > 0) nw -= overRight;
    }
    if (maxYPt < naturalSize.h - edgeSlackY) {
      const overBottom = (ny + nh) - (naturalSize.h - edgeSlackY);
      if (overBottom > 0) nh -= overBottom;
    }
    // Korrektur falls über Bild hinaus
    if (nx < 0) { nw += nx; nx = 0; }
    if (ny < 0) { nh += ny; ny = 0; }
    if (nx + nw > naturalSize.w) nw = naturalSize.w - nx;
    if (ny + nh > naturalSize.h) nh = naturalSize.h - ny;
    // Coverage Limits (nicht das ganze Bild verdecken)
    const maxCoverW = naturalSize.w * 0.93; // max 93% Breite
    const maxCoverH = naturalSize.h * 0.93; // max 93% Höhe
    if (nw > maxCoverW) {
      const shrink = nw - maxCoverW;
      nw = maxCoverW;
      nx = Math.min(Math.max(0, nx + shrink/2), naturalSize.w - nw);
    }
    if (nh > maxCoverH) {
      const shrink = nh - maxCoverH;
      nh = maxCoverH;
      ny = Math.min(Math.max(0, ny + shrink/2), naturalSize.h - nh);
    }
  // Finale Sicherheits-Klammerung nach eventuellem Re-Centering
  if (nx < 0) nx = 0;
  if (ny < 0) ny = 0;
  if (nw > naturalSize.w) { nw = naturalSize.w; nx = 0; }
  if (nh > naturalSize.h) { nh = naturalSize.h; ny = 0; }
  if (nx + nw > naturalSize.w) nx = Math.max(0, naturalSize.w - nw);
  if (ny + nh > naturalSize.h) ny = Math.max(0, naturalSize.h - nh);
    // Mindestgröße
    nw = Math.max(nw, 40); nh = Math.max(nh, 40);
    setBlackout(b => {
      // Nur setzen, wenn sich etwas wesentlich geändert hat (Vermeidung von Flicker)
      if (Math.abs(b.x - nx) < 2 && Math.abs(b.y - ny) < 2 && Math.abs(b.w - nw) < 2 && Math.abs(b.h - nh) < 2) return b;
      return { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) };
    });
  }, [points, naturalSize]);

  const removeLastPoint = () => { setPoints(p=>{ const np = p.slice(0,-1); if (!np.length) manualBlackoutRef.current = false; return np; }); };
  const resetPoints = () => { setPoints([]); manualBlackoutRef.current = false; };

  const pointSize = (():number=>{
    // Größer auf kleinen Displays (wenn Scale klein -> Bild war groß & verkleinert)
    if (scale < 0.5) return 28;
    if (scale < 0.75) return 24;
    if (scale < 1) return 20;
    return 18;
  })();
  useEffect(()=>{
    window.addEventListener('resize', recalcScale);
    return ()=> window.removeEventListener('resize', recalcScale);
  }, [naturalSize.w]);

  return (
    <div className="card">
      <h2>Neues Puzzle</h2>
      <div className="form-grid">
        <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/bmp,image/tiff" onChange={e=> e.target.files && onFile(e.target.files[0])} />
        <div className="btn-row" style={{flexWrap:'wrap'}}>
          <label style={{flex:'1 1 auto'}}>Grid C
            <input type="number" min={2} max={100} value={grid.cols} onChange={e=>setGrid(g=>({...g, cols:+e.target.value}))} />
          </label>
          <label style={{flex:'1 1 auto'}}>Grid R
            <input type="number" min={2} max={100} value={grid.rows} onChange={e=>setGrid(g=>({...g, rows:+e.target.value}))} />
          </label>
        </div>
        {file && (
          <div ref={containerRef} style={{position:'relative',border:'1px solid #222',width:'100%',overflow:'hidden',cursor: pointMode ? (actionRef.current?'grabbing':'crosshair'):'default', touchAction:'none'}}
            onPointerDown={(e)=>{
              if (!pointMode) return;
              // Nicht klicken wenn im Blackout (sonst Drag) – prüfen ob innerhalb Blackout
              const img = imgRef.current; if (!img) return;
              const rect = img.getBoundingClientRect();
              const relX = (e.clientX - rect.left)/scale; const relY = (e.clientY - rect.top)/scale;
              // Nur blockieren wenn Blackout sichtbar (>=2 Punkte oder manuell)
              const showBlackout = manualBlackoutRef.current || points.length >= 2;
              if (showBlackout && relX >= blackout.x && relX <= blackout.x + blackout.w && relY >= blackout.y && relY <= blackout.y + blackout.h) return; // inside blackout start area
              addPointAt(e.clientX, e.clientY);
            }}
          >
            <img ref={imgRef} src={URL.createObjectURL(file)} style={{display:'block',width:'100%',height:'auto',userSelect:'none',pointerEvents:'none'}} />
            {(manualBlackoutRef.current || points.length >= 2) && (
              <div onPointerDown={startMove} style={{position:'absolute',left:blackout.x*scale,top:blackout.y*scale,width:blackout.w*scale,height:blackout.h*scale,outline:'2px solid #ffae00',background:'rgba(0,0,0,0.35)',cursor:'move',touchAction:'none'}} onPointerUp={(e)=>{
                if (pointMode && !wasDragRef.current) {
                  // kein Punkt erzeugen
                }
              }}>
                <div onPointerDown={startResize} style={{position:'absolute',right:-8,bottom:-8,width:18,height:18,background:'#ffae00',borderRadius:6,border:'2px solid #1f242d',cursor:'nwse-resize',boxShadow:'0 0 0 2px #ffae00aa',touchAction:'none'}} />
              </div>
            )}
            {points.map((p,i)=>{
              const size = pointSize; const offset = size/2 + 0; // zentrieren
              return (
                <div key={i} title={`#${i}`} style={{position:'absolute',left:p.x*scale-offset+1,top:p.y*scale-offset+1,width:size,height:size,borderRadius:Math.max(10,size/2),background:'#4f9cff',border:'2px solid #fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(10, size*0.45),fontWeight:700,color:'#0f1115',boxShadow:'0 0 0 1px #062446'}}>{i+1}</div>
              );
            })}
          </div>
        )}
        <div className="btn-row">
          <button type="button" onClick={()=> setBlackout(b=>({ ...b, w: clamp(b.w+Math.round(naturalSize.w*0.05),10,maxWidth(b.x)), h: clamp(b.h+Math.round(naturalSize.h*0.05),10,maxHeight(b.y)) }))}>Blackout +</button>
          <button type="button" onClick={()=> setPointMode(m=>!m)}>{pointMode? 'Punkte aus':'Punkte an'}</button>
          <button type="button" onClick={removeLastPoint} disabled={!points.length}>Punkt -</button>
          <button type="button" onClick={resetPoints} disabled={!points.length}>Reset Punkte</button>
          <button type="button" onClick={submit} disabled={!file || points.length===0}>Speichern</button>
        </div>
        {status && <div className="hint">{status}</div>}
        {error && <div className="error-box">{error}</div>}
  <small style={{opacity:.55}}>Scale {scale.toFixed(2)} – Toggle Punkte setzen: {pointMode? 'AN':'AUS'} – Drag Box bewegen, Eck resize. Kein ungewollter Punkt beim Verschieben.</small>
      </div>
    </div>
  );
}
