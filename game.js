const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

const POSITIONS = ['pos-bottom', 'pos-top', 'pos-left', 'pos-right'];

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

// Sound Management using Web Audio API
const SoundManager = {
    ctx: null,
    init() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    },
    playDeal() {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },
    playFlip() {
        if (!this.ctx) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    },
    playWin() {
        if (!this.ctx) this.init();
        [440, 554, 659, 880].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + i * 0.1 + 0.5);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(this.ctx.currentTime + i * 0.1);
            osc.stop(this.ctx.currentTime + i * 0.1 + 0.5);
        });
    }
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

    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: i === 0 ? "YOU" : `Player ${i + 1}`,
            cards: [],
            handInfo: null,
            pos: POSITIONS[i]
        });

        const playerDiv = document.createElement('div');
        playerDiv.className = `player-card-area ${players[i].pos}`;
        playerDiv.id = `player-${i}`;
        playerDiv.innerHTML = `
            <div class="player-name">${players[i].name}</div>
            <div class="cards" id="cards-${i}"></div>
        `;
        container.appendChild(playerDiv);
    }
}

async function dealCards() {
    createDeck();
    shuffleDeck();

    const dealBtn = document.getElementById('deal-btn');
    dealBtn.classList.add('hidden');
    
    if (navigator.vibrate) navigator.vibrate(50);
    SoundManager.init();

    // Reset UI
    players.forEach(p => {
        document.getElementById(`player-${p.id}`).classList.remove('winner');
        document.getElementById(`cards-${p.id}`).innerHTML = '';
    });

    // Sequential dealing
    for (let cardIdx = 0; cardIdx < 3; cardIdx++) {
        for (let player of players) {
            const card = deck.pop();
            player.cards[cardIdx] = card;
            addCardToUI(player.id, card, cardIdx);
            SoundManager.playDeal();
            await new Promise(r => setTimeout(r, 150));
        }
    }

    // Auto-reveal for Player 1 (YOU)
    await new Promise(r => setTimeout(r, 500));
    revealPlayer(0);

    document.getElementById('show-btn').classList.remove('hidden');
}

function addCardToUI(playerId, card, index) {
    const cardContainer = document.getElementById(`cards-${playerId}`);
    
    // Create card element structure
    const container = document.createElement('div');
    container.className = 'card-container card-deal-anim';
    container.id = `card-${playerId}-${index}`;

    const isRed = card.suit === '♥' || card.suit === '♦';
    
    container.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front ${isRed ? 'red' : ''}">
            <div class="rank">${card.value}</div>
            <div class="suit">${card.suit}</div>
            <div class="suit-mini">${card.suit}</div>
        </div>
    `;

    // Position detection for animation
    const rect = document.getElementById(`player-${playerId}`).getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    container.style.setProperty('--deal-x', `${centerX - rect.left - 30}px`);
    container.style.setProperty('--deal-y', `${centerY - rect.top - 45}px`);

    cardContainer.appendChild(container);
}

function revealPlayer(playerId) {
    for (let i = 0; i < 3; i++) {
        const card = document.getElementById(`card-${playerId}-${i}`);
        if (card) {
            card.classList.add('reveal');
            SoundManager.playFlip();
        }
    }
}

async function showWinner() {
    document.getElementById('show-btn').classList.add('hidden');

    // Reveal everyone
    for (let i = 1; i < playerCount; i++) {
        revealPlayer(i);
        await new Promise(r => setTimeout(r, 300));
    }

    players.forEach(p => p.handInfo = evaluateHand(p.cards));
    const winner = determineWinner(players);
    
    await new Promise(r => setTimeout(r, 500));

    // UI Feedback
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    const banner = document.getElementById('winner-banner');
    document.getElementById('winner-text').innerText = `${winner.name} WINS!`;
    document.getElementById('winning-hand-type').innerText = winner.handInfo.handName;
    banner.classList.remove('hidden');

    SoundManager.playWin();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

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
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isTrail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isColor = suits[0] === suits[1] && suits[1] === suits[2];
    
    let isSeq = false;
    let seqHighCard = ranks[0];

    // AKQ is 15 (highest), A23 is 14 (second highest), others are ranks[0]
    if (ranks[0] === 14 && ranks[1] === 13 && ranks[2] === 12) {
        isSeq = true;
        seqHighCard = 15;
    } else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) {
        isSeq = true;
        seqHighCard = 14;
    } else if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1) {
        isSeq = true;
        seqHighCard = ranks[0];
    }

    if (isTrail) return { score: HAND_RANK.TRAIL, handName: 'TRAIL (SET)', subRank: ranks[0] };
    if (isSeq && isColor) return { score: HAND_RANK.PURE_SEQUENCE, handName: 'PURE SEQUENCE', subRank: seqHighCard };
    if (isSeq) return { score: HAND_RANK.SEQUENCE, handName: 'SEQUENCE', subRank: seqHighCard };
    if (isColor) return { score: HAND_RANK.COLOR, handName: 'COLOR (FLUSH)', subRank: ranks };
    
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];
    if (isPair) {
        let pairRank, kicker;
        if (ranks[0] === ranks[1]) { pairRank = ranks[0]; kicker = ranks[2]; }
        else if (ranks[1] === ranks[2]) { pairRank = ranks[1]; kicker = ranks[0]; }
        else { pairRank = ranks[0]; kicker = ranks[1]; }
        return { score: HAND_RANK.PAIR, handName: 'PAIR', subRank: [pairRank, kicker] };
    }

    return { score: HAND_RANK.HIGH_CARD, handName: 'HIGH CARD', subRank: ranks };
}

function determineWinner(players) {
    return players.reduce((prev, curr) => {
        if (!prev) return curr;
        const pHand = prev.handInfo;
        const cHand = curr.handInfo;

        if (cHand.score > pHand.score) return curr;
        if (cHand.score < pHand.score) return prev;

        if (Array.isArray(cHand.subRank)) {
            for (let i = 0; i < cHand.subRank.length; i++) {
                if (cHand.subRank[i] > pHand.subRank[i]) return curr;
                if (cHand.subRank[i] < pHand.subRank[i]) return prev;
            }
        } else {
            if (cHand.subRank > pHand.subRank) return curr;
            if (cHand.subRank < pHand.subRank) return prev;
        }
        return prev;
    });
}
