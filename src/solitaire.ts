export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isFaceUp: boolean;
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const RANK_VALUE: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        isFaceUp: false,
      });
    }
  }
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: Card[][]; // 4 piles
  tableau: Card[][]; // 7 piles
}

export function initializeGame(): GameState {
  const deck = shuffle(createDeck());
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  
  for (let i = 0; i < 7; i++) {
    for (let j = i; j < 7; j++) {
      const card = deck.pop()!;
      if (j === i) {
        card.isFaceUp = true;
      }
      tableau[j].push(card);
    }
  }

  return {
    stock: deck,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
  };
}

export function isOppositeColor(card1: Card, card2: Card): boolean {
  const red = ['hearts', 'diamonds'];
  const black = ['clubs', 'spades'];
  return (red.includes(card1.suit) && black.includes(card2.suit)) ||
         (black.includes(card1.suit) && red.includes(card2.suit));
}

export function canMoveToTableau(card: Card, targetPile: Card[]): boolean {
  if (targetPile.length === 0) {
    return card.rank === 'K';
  }
  const topCard = targetPile[targetPile.length - 1];
  return topCard.isFaceUp && 
         isOppositeColor(card, topCard) && 
         RANK_VALUE[card.rank] === RANK_VALUE[topCard.rank] - 1;
}

export function canMoveToFoundation(card: Card, foundationPile: Card[]): boolean {
  if (foundationPile.length === 0) {
    return card.rank === 'A';
  }
  const topCard = foundationPile[foundationPile.length - 1];
  return card.suit === topCard.suit && 
         RANK_VALUE[card.rank] === RANK_VALUE[topCard.rank] + 1;
}

export function hasPossibleMoves(state: GameState): boolean {
  // Check stock/waste
  if (state.stock.length > 0) return true;
  
  // If stock is empty but waste can be recycled, it's still possible to move
  // Actually, standard Klondike allows recycling waste to stock.
  // My handleStockClick implementation does this.
  if (state.waste.length > 0 && state.stock.length === 0) {
    // If waste is not empty, we can recycle it to stock, so moves are possible
    // unless the user has already cycled through all cards and found no moves.
    // But for simplicity, let's say if waste > 0, we can still cycle.
    return true;
  }
  
  const movableCards: { card: Card, from: { type: 'waste' | 'tableau', index?: number, cardIndex?: number } }[] = [];
  
  if (state.waste.length > 0) {
    movableCards.push({ card: state.waste[state.waste.length - 1], from: { type: 'waste' } });
  }
  
  state.tableau.forEach((pile, i) => {
    pile.forEach((card, j) => {
      if (card.isFaceUp) {
        // Optimization: only the top card of a sequence can be moved to another tableau
        // or the top card of a pile can be moved to foundation
        movableCards.push({ card, from: { type: 'tableau', index: i, cardIndex: j } });
      }
    });
  });

  for (const { card, from } of movableCards) {
    // Can move to foundation?
    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, state.foundations[i])) {
        // If it's a tableau card, it must be the top card to move to foundation
        if (from.type === 'tableau') {
          const pile = state.tableau[from.index!];
          if (from.cardIndex === pile.length - 1) return true;
        } else {
          return true;
        }
      }
    }
    
    // Can move to another tableau?
    for (let i = 0; i < 7; i++) {
      if (from.type === 'tableau' && from.index === i) continue;
      if (canMoveToTableau(card, state.tableau[i])) {
        // If moving a King to an empty spot, check if it's already the base of a pile
        if (card.rank === 'K' && state.tableau[i].length === 0) {
          if (from.type === 'tableau' && from.cardIndex === 0) continue;
        }
        // If moving a card from tableau to another tableau, check if it reveals anything new
        // or if it's just moving a stack to an empty spot without revealing a card.
        if (from.type === 'tableau') {
          const pile = state.tableau[from.index!];
          // If it reveals a card or it's moving from a pile that has face-down cards
          if (from.cardIndex! > 0 || pile.length > from.cardIndex! + 1) return true;
          // If it's a King moving to an empty spot, it doesn't reveal anything if it's already at index 0
          if (card.rank === 'K' && from.cardIndex === 0 && state.tableau[i].length === 0) continue;
        }
        return true;
      }
    }
  }

  return false;
}
