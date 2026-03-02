import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { RotateCcw, Play, Trophy, AlertCircle, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  GameState, 
  Card, 
  initializeGame, 
  canMoveToFoundation, 
  canMoveToTableau, 
  RANK_VALUE,
  Suit,
  Rank,
  SUITS,
  hasPossibleMoves
} from './solitaire';

const SUIT_ICONS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const SUIT_COLORS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-black',
  spades: 'text-black',
};

const CardComponent: React.FC<{ 
  card: Card; 
  onClick?: () => void; 
  className?: string;
  isDraggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}> = ({ card, onClick, className = '', isDraggable = false, onDragStart }) => {
  return (
    <motion.div
      layout
      layoutId={card.id}
      onClick={onClick}
      draggable={isDraggable && card.isFaceUp}
      onDragStart={onDragStart}
      className={`relative w-11 h-16 sm:w-20 sm:h-28 rounded-md sm:rounded-lg shadow-md cursor-pointer flex items-center justify-center text-xl font-bold select-none z-10 ${className}`}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
      whileHover={card.isFaceUp ? { scale: 1.05, y: -5, zIndex: 50 } : {}}
      animate={{ zIndex: 10 }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 25,
        layout: { duration: 0.4 }
      }}
    >
      <motion.div
        className="w-full h-full relative"
        initial={false}
        animate={{ rotateY: card.isFaceUp ? 0 : 180 }}
        transition={{ 
          type: 'spring',
          stiffness: 260,
          damping: 20
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front Side */}
        <div 
          className={`absolute inset-0 w-full h-full bg-white ring-1 ring-black/10 rounded-md sm:rounded-lg flex items-center justify-center backface-hidden shadow-inner ${SUIT_COLORS[card.suit]}`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <span className="text-[10px] sm:text-base absolute top-0.5 left-0.5 sm:top-1 sm:left-1">{card.rank}</span>
          <span className="text-lg sm:text-3xl">{SUIT_ICONS[card.suit]}</span>
          <span className="text-[10px] sm:text-base absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 rotate-180">{card.rank}</span>
        </div>

        {/* Back Side */}
        <div 
          className="absolute inset-0 w-full h-full bg-blue-800 ring-1 ring-blue-900 rounded-md sm:rounded-lg flex items-center justify-center backface-hidden shadow-inner"
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <div className="w-4/5 h-4/5 border border-blue-400/20 rounded-sm sm:rounded-md opacity-40" />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const stopAutoRef = React.useRef(false);

  const resetGame = useCallback(() => {
    stopAutoRef.current = true;
    setGameState(initializeGame());
    setMessage(null);
    setIsGameOver(false);
    setIsAutoCompleting(false);
    // Reset the stop flag after a short delay to allow next auto-complete
    setTimeout(() => { stopAutoRef.current = false; }, 100);
  }, []);

  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const checkWin = useCallback((state: GameState) => {
    const totalFoundations = state.foundations.reduce((acc, pile) => acc + pile.length, 0);
    if (totalFoundations === 52) {
      setIsGameOver(true);
      setMessage('Congratulations! You won!');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      return true;
    }
    return false;
  }, []);

  const handleStockClick = () => {
    if (!gameState) return;
    const newState = { ...gameState };
    if (newState.stock.length === 0) {
      newState.stock = [...newState.waste].reverse().map(c => ({ ...c, isFaceUp: false }));
      newState.waste = [];
    } else {
      const card = newState.stock.pop()!;
      card.isFaceUp = true;
      newState.waste.push(card);
    }
    setGameState(newState);
    if (!hasPossibleMoves(newState)) {
      setMessage("No more moves available. You might want to reset.");
    }
  };

  const moveCard = (from: { type: string, index?: number, cardIndex?: number }, to: { type: string, index?: number }) => {
    if (!gameState) return;
    const newState = { ...gameState };
    let cardsToMove: Card[] = [];

    // Extract cards
    if (from.type === 'waste') {
      cardsToMove = [newState.waste.pop()!];
    } else if (from.type === 'tableau') {
      const pile = newState.tableau[from.index!];
      cardsToMove = pile.splice(from.cardIndex!);
      // Flip new top card
      if (pile.length > 0 && !pile[pile.length - 1].isFaceUp) {
        pile[pile.length - 1].isFaceUp = true;
      }
    } else if (from.type === 'foundation') {
      cardsToMove = [newState.foundations[from.index!].pop()!];
    }

    // Place cards
    if (to.type === 'tableau') {
      newState.tableau[to.index!].push(...cardsToMove);
    } else if (to.type === 'foundation') {
      newState.foundations[to.index!].push(...cardsToMove);
    }

    setGameState(newState);
    if (!checkWin(newState)) {
      if (!hasPossibleMoves(newState)) {
        setMessage("No more moves available. You might want to reset.");
      }
    }
  };

  const handleCardClick = (card: Card, from: { type: string, index?: number, cardIndex?: number }) => {
    if (!gameState || !card.isFaceUp) return;

    // Try moving to foundation first
    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, gameState.foundations[i])) {
        // Only move if it's the top card of a tableau pile or from waste
        if (from.type === 'tableau' && from.cardIndex !== gameState.tableau[from.index!].length - 1) continue;
        moveCard(from, { type: 'foundation', index: i });
        return;
      }
    }

    // Try moving to tableau
    for (let i = 0; i < 7; i++) {
      if (from.type === 'tableau' && from.index === i) continue;
      if (canMoveToTableau(card, gameState.tableau[i])) {
        moveCard(from, { type: 'tableau', index: i });
        return;
      }
    }
  };

  const autoComplete = async () => {
    if (!gameState || isAutoCompleting) return;
    setIsAutoCompleting(true);
    stopAutoRef.current = false;
    setMessage("Auto-completing...");
    
    let moved = true;
    let currentState = { ...gameState };
    let stockCycles = 0;
    const maxStockCycles = 2; 

    while (moved && !stopAutoRef.current) {
      moved = false;
      
      // 1. Try moving from waste to foundation
      if (currentState.waste.length > 0) {
        const card = currentState.waste[currentState.waste.length - 1];
        for (let i = 0; i < 4; i++) {
          if (canMoveToFoundation(card, currentState.foundations[i])) {
            currentState.foundations[i].push(currentState.waste.pop()!);
            moved = true;
            setGameState({ ...currentState });
            await new Promise(r => setTimeout(r, 200));
            break;
          }
        }
      }
      if (moved || stopAutoRef.current) continue;

      // 2. Try moving from tableau to foundation
      for (let i = 0; i < 7; i++) {
        const pile = currentState.tableau[i];
        if (pile.length > 0) {
          const card = pile[pile.length - 1];
          if (card.isFaceUp) {
            for (let j = 0; j < 4; j++) {
              if (canMoveToFoundation(card, currentState.foundations[j])) {
                currentState.foundations[j].push(pile.pop()!);
                if (pile.length > 0 && !pile[pile.length - 1].isFaceUp) {
                  pile[pile.length - 1].isFaceUp = true;
                }
                moved = true;
                setGameState({ ...currentState });
                await new Promise(r => setTimeout(r, 200));
                break;
              }
            }
          }
        }
        if (moved || stopAutoRef.current) break;
      }
      if (moved || stopAutoRef.current) continue;

      // 2.5 Try moving between tableau piles (including partial stacks)
      for (let i = 0; i < 7; i++) {
        const fromPile = currentState.tableau[i];
        if (fromPile.length === 0) continue;

        for (let cardIdx = 0; cardIdx < fromPile.length; cardIdx++) {
          const card = fromPile[cardIdx];
          if (!card.isFaceUp) continue;

          const firstFaceUpIndex = fromPile.findIndex(c => c.isFaceUp);
          const isFirstFaceUp = cardIdx === firstFaceUpIndex;
          const revealsCard = isFirstFaceUp && cardIdx > 0;
          
          for (let j = 0; j < 7; j++) {
            if (i === j) continue;
            if (canMoveToTableau(card, currentState.tableau[j])) {
              const targetIsEmpty = currentState.tableau[j].length === 0;
              
              // Avoid King loop: Only move a King to an empty spot if it reveals a card
              if (card.rank === 'K' && targetIsEmpty && !revealsCard) continue;

              const hasKingInWaste = currentState.waste.length > 0 && currentState.waste[currentState.waste.length - 1].rank === 'K';
              const hasKingInOtherPile = currentState.tableau.some((p, idx) => idx !== i && p.length > 0 && p[p.findIndex(c => c.isFaceUp)]?.rank === 'K' && p.findIndex(c => c.isFaceUp) > 0);
              const hasKingWaiting = hasKingInWaste || hasKingInOtherPile;
              const clearsPile = cardIdx === 0; // Moving the entire pile (including the base)

              // Useful moves:
              // 1. Reveals a face-down card
              // 2. Moves a card to an empty spot to make room for a King (if the target is empty)
              // 3. Clears a pile (making it empty) to make room for a King (if the target is NOT empty)
              if (revealsCard || (targetIsEmpty && hasKingWaiting) || (clearsPile && !targetIsEmpty && hasKingWaiting)) {
                const cardsToMove = fromPile.splice(cardIdx);
                currentState.tableau[j].push(...cardsToMove);
                if (fromPile.length > 0 && !fromPile[fromPile.length - 1].isFaceUp) {
                  fromPile[fromPile.length - 1].isFaceUp = true;
                }
                moved = true;
                setGameState({ ...currentState });
                await new Promise(r => setTimeout(r, 200));
                break;
              }
            }
          }
          if (moved || stopAutoRef.current) break;
        }
        if (moved || stopAutoRef.current) break;
      }
      if (moved || stopAutoRef.current) continue;

      // 2.7 Try moving from waste to tableau
      if (currentState.waste.length > 0) {
        const card = currentState.waste[currentState.waste.length - 1];
        for (let i = 0; i < 7; i++) {
          if (canMoveToTableau(card, currentState.tableau[i])) {
            currentState.tableau[i].push(currentState.waste.pop()!);
            moved = true;
            setGameState({ ...currentState });
            await new Promise(r => setTimeout(r, 200));
            break;
          }
        }
      }
      if (moved || stopAutoRef.current) continue;

      // 3. Try opening card from stock
      if (currentState.stock.length > 0) {
        const card = currentState.stock.pop()!;
        card.isFaceUp = true;
        currentState.waste.push(card);
        moved = true;
        setGameState({ ...currentState });
        await new Promise(r => setTimeout(r, 200));
      } else if (currentState.waste.length > 0 && stockCycles < maxStockCycles) {
        currentState.stock = [...currentState.waste].reverse().map(c => ({ ...c, isFaceUp: false }));
        currentState.waste = [];
        stockCycles++;
        moved = true;
        setGameState({ ...currentState });
        await new Promise(r => setTimeout(r, 200));
      }

      if (checkWin(currentState)) break;
    }

    setIsAutoCompleting(false);
    if (!isGameOver && !stopAutoRef.current) {
      setMessage("Auto-complete paused. No more obvious moves found.");
    }
  };

  if (!gameState) return null;

  return (
    <div className="min-h-screen bg-emerald-800 text-white p-2 sm:p-8 font-sans overflow-x-hidden">
      <LayoutGroup>
        <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-6 sm:mb-8 gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight italic font-serif">Solitaire Master</h1>
          </div>
          
          <div className="flex gap-2 sm:gap-4">
            <button
              onClick={resetGame}
              className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors border border-white/20 text-sm sm:text-base"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Reset
            </button>
            <button
              onClick={autoComplete}
              disabled={isAutoCompleting || isGameOver}
              className="flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-yellow-500 hover:bg-yellow-600 text-emerald-900 font-bold rounded-full transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Auto Complete
            </button>
          </div>
        </header>

        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 p-4 bg-white/10 border border-white/20 rounded-xl flex items-center gap-3 justify-center"
            >
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <span className="font-medium">{message}</span>
              {isGameOver ? (
                <button 
                  onClick={resetGame}
                  className="ml-4 px-3 py-1 bg-yellow-500 text-emerald-900 rounded-full text-xs font-bold hover:bg-yellow-400 transition-colors"
                >
                  New Game
                </button>
              ) : (
                <button 
                  onClick={() => setMessage(null)}
                  className="ml-4 text-xs underline opacity-70 hover:opacity-100"
                >
                  Dismiss
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-7 gap-1 sm:gap-4 mb-8 sm:mb-12">
          {/* Stock & Waste */}
          <div className="col-span-2 flex gap-1 sm:gap-4">
            <div className="relative">
              <div 
                onClick={handleStockClick}
                className={`w-11 h-16 sm:w-20 sm:h-28 rounded-md sm:rounded-lg border-2 border-white/20 flex items-center justify-center cursor-pointer ${gameState.stock.length > 0 ? 'bg-blue-800 shadow-lg' : 'bg-transparent'}`}
              >
                {gameState.stock.length === 0 && (
                  <RefreshCw className="w-5 h-5 sm:w-8 sm:h-8 opacity-20" />
                )}
              </div>
              {gameState.stock.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  <CardComponent 
                    key={gameState.stock[gameState.stock.length - 1].id}
                    card={gameState.stock[gameState.stock.length - 1]} 
                  />
                </div>
              )}
            </div>
            <div className="relative">
              {gameState.waste.length > 0 && (
                <div className="absolute inset-0">
                  <CardComponent 
                    key={gameState.waste[gameState.waste.length - 1].id}
                    card={gameState.waste[gameState.waste.length - 1]} 
                    onClick={() => handleCardClick(gameState.waste[gameState.waste.length - 1], { type: 'waste' })}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="col-span-1 flex items-center justify-center">
            <div className="w-px h-8 bg-white/10 sm:hidden" />
          </div>

          {/* Foundations */}
          <div className="col-span-4 flex gap-1 sm:gap-4 justify-end sm:justify-start">
            {gameState.foundations.map((pile, i) => (
              <div key={i} className="relative">
                <div className="w-11 h-16 sm:w-20 sm:h-28 rounded-md sm:rounded-lg border-2 border-white/10 bg-white/5 flex items-center justify-center relative shadow-inner">
                  <span className="absolute text-white/10 text-xl sm:text-4xl">{SUIT_ICONS[SUITS[i]]}</span>
                  {pile.length > 0 && (
                    <CardComponent 
                      card={pile[pile.length - 1]} 
                      className="absolute inset-0"
                      onClick={() => handleCardClick(pile[pile.length - 1], { type: 'foundation', index: i })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tableau */}
        <div className="grid grid-cols-7 gap-1 sm:gap-4">
          {gameState.tableau.map((pile, i) => (
            <div key={i} className="col-span-1 flex flex-col items-center">
              <div className="w-11 h-16 sm:w-20 sm:h-28 rounded-md sm:rounded-lg border-2 border-white/5 bg-white/5 mb-[-60px] sm:mb-[-100px]" />
              <div className="relative w-11 sm:w-20 flex flex-col items-center">
                {pile.map((card, j) => (
                  <div 
                    key={card.id} 
                    className="absolute w-full flex justify-center" 
                    style={{ top: `${j * (typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 25)}px` }}
                  >
                    <CardComponent 
                      card={card} 
                      onClick={() => handleCardClick(card, { type: 'tableau', index: i, cardIndex: j })}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      </LayoutGroup>
      <footer className="fixed bottom-4 left-0 right-0 text-center text-white/40 text-xs">
        Click a card to automatically move it to the best spot.
      </footer>
    </div>
  );
}
