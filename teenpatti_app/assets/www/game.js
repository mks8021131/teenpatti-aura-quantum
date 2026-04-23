const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

let deck = [];
let players = [];
let playerCount = 0;

const HAND_RANK = {
    TRAIL: 6,
    PURE_SEQUENCE: 5,
    SEQUENCE: 4,
    COLOR: 3,
    PAIR: 2,
    HIGH_CARD: 1
};

function createDeck() {
    deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            deck.push({ suit, value, rank: VALUE_MAP[value] });
        }
    }
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function startGame(num) {
    playerCount = num;
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initPlayers();
}

function initPlayers() {
    players = [];
    const container = document.getElementById('players-container');
    container.innerHTML = '';

    for (let i = 1; i <= playerCount; i++) {
        players.push({
            id: i,
            name: `Player ${i}`,
            cards: [],
            handInfo: null
        });

        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-card-area';
        playerDiv.id = `player-${i}`;
        playerDiv.innerHTML = `
            <div class="player-name">PLAYER ${i}</div>
            <div class="cards" id="cards-${i}">
                <div class="card back">?</div>
                <div class="card back">?</div>
                <div class="card back">?</div>
            </div>
        `;
        container.appendChild(playerDiv);
    }
}

function dealCards() {
    createDeck();
    shuffleDeck();

    for (let player of players) {
        player.cards = [deck.pop(), deck.pop(), deck.pop()];
        renderCards(player, true); // Keep them face down initially
    }

    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('show-btn').classList.remove('hidden');
}

function renderCards(player, faceDown = false) {
    const cardContainer = document.getElementById(`cards-${player.id}`);
    cardContainer.innerHTML = '';

    player.cards.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${faceDown ? 'back' : ''} ${(!faceDown && (card.suit === '♥' || card.suit === '♦')) ? 'red' : ''}`;
        cardEl.style.animationDelay = `${index * 0.1}s`;
        
        if (!faceDown) {
            cardEl.innerHTML = `<span>${card.value}</span><span>${card.suit}</span>`;
        } else {
            cardEl.innerHTML = '?';
        }
        cardContainer.appendChild(cardEl);
    });
}

function showWinner() {
    players.forEach(p => {
        renderCards(p, false);
        p.handInfo = evaluateHand(p.cards);
    });

    const winner = determineWinner(players);
    
    // Highlight winner
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    
    // Show banner
    const banner = document.getElementById('winner-banner');
    const winnerText = document.getElementById('winner-text');
    const handTypeText = document.getElementById('winning-hand-type');
    
    winnerText.innerText = `${winner.name} WINS!`;
    handTypeText.innerText = winner.handInfo.handName;
    banner.classList.remove('hidden');

    document.getElementById('show-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.remove('hidden');
}

function resetGame() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('setup-screen').classList.remove('hidden');
    document.getElementById('winner-banner').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('deal-btn').classList.remove('hidden');
}

function evaluateHand(cards) {
    // Sort cards by rank descending
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isTrail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isColor = suits[0] === suits[1] && suits[1] === suits[2];
    
    // Sequence check (Standard: AKQ, A23, KQJ... 432)
    let isSeq = false;
    let seqHighCard = ranks[0];

    if (ranks[0] === 14 && ranks[1] === 13 && ranks[2] === 12) {
        // A, K, Q
        isSeq = true;
        seqHighCard = 15; // Highest
    } else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
        // A, 2, 3
        isSeq = true;
        seqHighCard = 14; // Second highest
    } else if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1) {
        isSeq = true;
        seqHighCard = ranks[0]; // Others (max 13 for KQJ)
    }

    if (isTrail) return { score: HAND_RANK.TRAIL, handName: 'Trail (Set)', subRank: ranks[0] };
    if (isSeq && isColor) return { score: HAND_RANK.PURE_SEQUENCE, handName: 'Pure Sequence', subRank: seqHighCard };
    if (isSeq) return { score: HAND_RANK.SEQUENCE, handName: 'Sequence', subRank: seqHighCard };
    if (isColor) return { score: HAND_RANK.COLOR, handName: 'Color (Flush)', subRank: ranks };
    
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];
    if (isPair) {
        let pairRank, kicker;
        if (ranks[0] === ranks[1]) { pairRank = ranks[0]; kicker = ranks[2]; }
        else if (ranks[1] === ranks[2]) { pairRank = ranks[1]; kicker = ranks[0]; }
        else { pairRank = ranks[0]; kicker = ranks[1]; }
        return { score: HAND_RANK.PAIR, handName: 'Pair', subRank: [pairRank, kicker] };
    }

    return { score: HAND_RANK.HIGH_CARD, handName: 'High Card', subRank: ranks };
}

function determineWinner(players) {
    return players.reduce((prev, curr) => {
        if (!prev) return curr;
        
        const pHand = prev.handInfo;
        const cHand = curr.handInfo;

        if (cHand.score > pHand.score) return curr;
        if (cHand.score < pHand.score) return prev;

        // Same hand type, compare subRanks
        if (Array.isArray(cHand.subRank)) {
            for (let i = 0; i < cHand.subRank.length; i++) {
                if (cHand.subRank[i] > pHand.subRank[i]) return curr;
                if (cHand.subRank[i] < pHand.subRank[i]) return prev;
            }
        } else {
            if (cHand.subRank > pHand.subRank) return curr;
            if (cHand.subRank < pHand.subRank) return prev;
        }

        return prev; // Tie goes to first player (simplification)
    });
}
