import { useEffect, useState } from 'react';
import { api } from '../api/client';
import './PuzzlePieces.css';

interface PuzzlePiece {
  id: string;
  index: number;
  originalX: number;
  originalY: number;
  extractedFromX: number;
  extractedFromY: number;
  width: number;
  height: number;
  imageData: string;
}

interface PlacedPiece {
  pieceId: string;
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  draggedPieceId: string | null;
  dragOffset: { x: number; y: number };
  startPosition: { x: number; y: number };
}

interface PuzzlePiecesProps {
  puzzleId: string;
  accessToken: string;
  puzzleImage: string;
  onSubmitGuesses: (guesses: PlacedPiece[]) => void;
  onClose: () => void;
}

export function PuzzlePieces({ puzzleId, accessToken, puzzleImage, onSubmitGuesses, onClose }: PuzzlePiecesProps) {
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [placedPieces, setPlacedPieces] = useState<PlacedPiece[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedPieceId: null,
    dragOffset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 }
  });

  useEffect(() => {
    loadPieces();
    
    // Prevent page scrolling while component is active
    document.body.classList.add('puzzle-active');
    
    return () => {
      document.body.classList.remove('puzzle-active');
    };
  }, [puzzleId, accessToken]);

  const loadPieces = async () => {
    try {
      setLoading(true);
      const data = await api.getPuzzlePieces(puzzleId, accessToken);
      setPieces(data.pieces || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load puzzle pieces');
    } finally {
      setLoading(false);
    }
  };

  const selectPiece = (pieceId: string) => {
    setSelectedPiece(selectedPiece === pieceId ? null : pieceId);
  };

  const placePiece = (x: number, y: number) => {
    if (!selectedPiece) return;
    
    // Remove piece if already placed
    const newPlacedPieces = placedPieces.filter(p => p.pieceId !== selectedPiece);
    
    // Add piece at new position
    newPlacedPieces.push({ pieceId: selectedPiece, x, y });
    
    setPlacedPieces(newPlacedPieces);
    setSelectedPiece(null); // Deselect after placing
  };

  const removePlacedPiece = (pieceId: string) => {
    setPlacedPieces(placedPieces.filter(p => p.pieceId !== pieceId));
  };

  const submitGuesses = () => {
    onSubmitGuesses(placedPieces);
  };

  const clearAll = () => {
    setPlacedPieces([]);
    setSelectedPiece(null);
    setDragState({
      isDragging: false,
      draggedPieceId: null,
      dragOffset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    });
  };

  // Drag & Drop handlers
  const handleMouseDown = (e: React.MouseEvent, pieceId: string) => {
    e.preventDefault();
    const placedPiece = placedPieces.find(p => p.pieceId === pieceId);
    if (!placedPiece) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      draggedPieceId: pieceId,
      dragOffset: { x: offsetX, y: offsetY },
      startPosition: { x: placedPiece.x, y: placedPiece.y }
    });
  };

  const handleTouchStart = (e: React.TouchEvent, pieceId: string) => {
    e.preventDefault();
    const placedPiece = placedPieces.find(p => p.pieceId === pieceId);
    if (!placedPiece) return;

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;

    setDragState({
      isDragging: true,
      draggedPieceId: pieceId,
      dragOffset: { x: offsetX, y: offsetY },
      startPosition: { x: placedPiece.x, y: placedPiece.y }
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.draggedPieceId) return;
    
    const imageRect = e.currentTarget.getBoundingClientRect();
    const newX = e.clientX - imageRect.left - dragState.dragOffset.x;
    const newY = e.clientY - imageRect.top - dragState.dragOffset.y;

    // Update piece position in real-time
    setPlacedPieces(pieces => 
      pieces.map(p => 
        p.pieceId === dragState.draggedPieceId 
          ? { ...p, x: newX, y: newY }
          : p
      )
    );
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragState.isDragging || !dragState.draggedPieceId) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const imageRect = e.currentTarget.getBoundingClientRect();
    const newX = touch.clientX - imageRect.left - dragState.dragOffset.x;
    const newY = touch.clientY - imageRect.top - dragState.dragOffset.y;

    // Update piece position in real-time
    setPlacedPieces(pieces => 
      pieces.map(p => 
        p.pieceId === dragState.draggedPieceId 
          ? { ...p, x: newX, y: newY }
          : p
      )
    );
  };

  const handleMouseUp = () => {
    setDragState({
      isDragging: false,
      draggedPieceId: null,
      dragOffset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    });
  };

  const handleTouchEnd = () => {
    setDragState({
      isDragging: false,
      draggedPieceId: null,
      dragOffset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    });
  };

  if (loading) return <div className="puzzle-pieces-loading">Loading puzzle pieces...</div>;
  if (error) return <div className="puzzle-pieces-error">Error: {error}</div>;

  return (
    <div className="puzzle-pieces-container">
      {/* Instructions */}
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '20px',
        fontSize: '12px',
        zIndex: 100,
        textAlign: 'center',
        maxWidth: '90%'
      }}>
        📱 Wähle Pieces aus → Platziere sie → Ziehe sie zum Verschieben
      </div>
      
      {/* Main puzzle image area */}
      <div className="puzzle-image-container">
        <div 
          className="puzzle-image-wrapper"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img 
            src={puzzleImage} 
            alt="Puzzle" 
            className="puzzle-base-image"
            onClick={(e) => {
              // Only place new pieces if not dragging and a piece is selected
              if (dragState.isDragging) return;
              
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              placePiece(x, y);
            }}
          />
          
          {/* Render placed pieces */}
          {placedPieces.map(placedPiece => {
            const piece = pieces.find(p => p.id === placedPiece.pieceId);
            if (!piece) return null;
            
            const isDragging = dragState.draggedPieceId === piece.id;
            
            return (
              <div
                key={`placed-${piece.id}`}
                className={`placed-piece ${isDragging ? 'dragging' : ''}`}
                style={{
                  position: 'absolute',
                  left: placedPiece.x - piece.width / 2,
                  top: placedPiece.y - piece.height / 2,
                  width: piece.width,
                  height: piece.height,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  zIndex: isDragging ? 1000 : 10,
                  transform: isDragging ? 'scale(1.1)' : 'scale(1)',
                  transition: isDragging ? 'none' : 'transform 0.2s ease'
                }}
                onMouseDown={(e) => handleMouseDown(e, piece.id)}
                onTouchStart={(e) => handleTouchStart(e, piece.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  removePlacedPiece(piece.id);
                }}
              >
                <img
                  src={piece.imageData}
                  alt={`Piece ${piece.index}`}
                  style={{ 
                    width: '100%', 
                    height: '100%',
                    pointerEvents: 'none', // Prevent image from interfering with drag
                    userSelect: 'none'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Pieces palette */}
      <div className="pieces-palette">
        <div className="pieces-scroll">
          {pieces.map(piece => {
            const isPlaced = placedPieces.some(p => p.pieceId === piece.id);
            const isSelected = selectedPiece === piece.id;
            
            return (
              <div
                key={piece.id}
                className={`piece-item ${isSelected ? 'selected' : ''} ${isPlaced ? 'placed' : ''}`}
                onClick={() => selectPiece(piece.id)}
              >
                <img
                  src={piece.imageData}
                  alt={`Piece ${piece.index + 1}`}
                  className="piece-image"
                />
                <span className="piece-number">{piece.index + 1}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="action-buttons">
        <button onClick={clearAll} disabled={placedPieces.length === 0}>
          🗑️ Clear ({placedPieces.length})
        </button>
        <button onClick={submitGuesses} disabled={placedPieces.length === 0}>
          ✅ Submit ({placedPieces.length} pieces)
        </button>
        <button onClick={onClose}>
          ❌ Close
        </button>
      </div>
    </div>
  );
}
