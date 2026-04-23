const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const POSITIONS = ['slot-bottom', 'slot-top', 'slot-left', 'slot-right'];

let deck = [];
let players = [];
let playerCount = 4;
let roundCount = 1;
let currentPlayerIndex = 0;
let gameState = 'IDLE';

// Robust Audio Engine
const AudioEngine = {
    ctx: null,
    init() { 
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    },
    play(freq, duration = 0.1, type = 'sine', volume = 0.05) {
        if (!document.getElementById('sound-toggle').checked) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    deal() { this.play(300, 0.1, 'sine', 0.05); },
    flip() { this.play(500, 0.08, 'triangle', 0.03); },
    win() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.play(f, 0.5, 'sine', 0.05), i * 150)); }
};

function hapticFeedback(pattern = 50) {
    if (document.getElementById('haptic-toggle').checked && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

function setPlayerCount(num) {
    if (gameState === 'DEALING' || gameState === 'PLAYING') return;
    playerCount = num;
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.innerText) === num) btn.classList.add('active');
    });
    initTable();
}

function initTable() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players = [];
    currentPlayerIndex = 0;
    gameState = 'IDLE';

    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: i === 0 ? "PLAYER 1" : `PLAYER ${i + 1}`,
            cards: [],
            pos: POSITIONS[i],
            handInfo: null
        });

        const slot = document.createElement('div');
        slot.className = `player-slot ${players[i].pos}`;
        slot.id = `player-${i}`;
        
        let initialCardsHTML = '';
        for(let j=0; j<3; j++) {
            initialCardsHTML += `<div class="card-container"><div class="card-face card-back"></div></div>`;
        }

        slot.innerHTML = `
            <div class="player-label-styled">${players[i].name}</div>
            <div class="card-group" id="cards-${i}">${initialCardsHTML}</div>
        `;
        container.appendChild(slot);
    }
    document.getElementById('game-status').innerText = "READY";
    document.getElementById('deal-btn').classList.remove('hidden');
    document.getElementById('show-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('winner-banner').classList.add('hidden');
    document.getElementById('pass-overlay').classList.add('hidden');
}

function createDeck() {
    deck = [];
    for (let suit of SUITS) {
        for (let value of VALUES) {
            deck.push({ suit, value, rank: VALUE_MAP[value] });
        }
    }
}

function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

async function dealCards() {
    if (gameState !== 'IDLE') return;
    
    AudioEngine.init(); // Initialize audio context on user interaction
    createDeck();
    shuffle();
    hapticFeedback(30);
    gameState = 'DEALING';
    
    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "DEALING...";

    players.forEach(p => {
        document.getElementById(`cards-${p.id}`).innerHTML = '';
        document.getElementById(`player-${p.id}`).classList.remove('winner', 'active-glow');
    });

    // Sequential Deal Animation
    for (let c = 0; c < 3; c++) {
        for (let p = 0; p < playerCount; p++) {
            const card = deck.pop();
            players[p].cards[c] = card;
            spawnCard(p, card, c);
            AudioEngine.deal();
            await new Promise(r => setTimeout(r, 120));
        }
    }

    await new Promise(r => setTimeout(r, 500));
    startTurnSequence();
}

function spawnCard(pId, card, idx) {
    const container = document.getElementById(`cards-${pId}`);
    const box = document.createElement('div');
    box.className = 'card-container anim-deal';
    box.id = `card-${pId}-${idx}`;

    const isRed = card.suit === '♥' || card.suit === '♦';
    
    // Precise vector calculation for Fly-In from center
    const slotRect = document.getElementById(`player-${pId}`).getBoundingClientRect();
    const tableRect = document.getElementById('game-table').getBoundingClientRect();
    const centerX = tableRect.left + tableRect.width / 2;
    const centerY = tableRect.top + tableRect.height / 2;
    
    const dx = centerX - (slotRect.left + slotRect.width / 2);
    const dy = centerY - (slotRect.top + slotRect.height / 2);
    
    box.style.setProperty('--dx', `${dx}px`);
    box.style.setProperty('--dy', `${dy}px`);
    box.style.setProperty('--dr', `${Math.random() * 20 - 10}deg`);

    box.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front ${isRed ? 'red' : ''}">
            <div class="rank">${card.value}</div>
            <div class="suit-center">${card.suit}</div>
            <div class="suit-mini">${card.suit}</div>
        </div>
    `;
    container.appendChild(box);
}

function startTurnSequence() {
    gameState = 'PLAYING';
    if (currentPlayerIndex < playerCount) {
        showPassOverlay();
    } else {
        evaluateFinalWinner();
    }
}

function showPassOverlay() {
    const overlay = document.getElementById('pass-overlay');
    const nameEl = document.getElementById('pass-player-name');
    nameEl.innerText = players[currentPlayerIndex].name;
    overlay.classList.remove('hidden');
    document.getElementById('game-status').innerText = `PASSING TO ${players[currentPlayerIndex].name}`;
}

function revealCurrentPlayer() {
    AudioEngine.init();
    const overlay = document.getElementById('pass-overlay');
    overlay.classList.add('hidden');
    
    const pId = currentPlayerIndex;
    const playerEl = document.getElementById(`player-${pId}`);
    playerEl.classList.add('active-glow');
    
    for (let i = 0; i < 3; i++) {
        const card = document.getElementById(`card-${pId}-${i}`);
        if (card) {
            setTimeout(() => {
                card.classList.add('reveal');
                AudioEngine.flip();
            }, i * 150);
        }
    }

    hapticFeedback(50);
    
    const showBtn = document.getElementById('show-btn');
    showBtn.innerText = (currentPlayerIndex === playerCount - 1) ? "Final Showdown" : "End My Turn";
    showBtn.classList.remove('hidden');
    showBtn.onclick = () => {
        hidePlayerCards(pId);
        currentPlayerIndex++;
        showBtn.classList.add('hidden');
        startTurnSequence();
    };
    
    document.getElementById('game-status').innerText = `${players[pId].name} VIEWING`;
}

function hidePlayerCards(pId) {
    const playerEl = document.getElementById(`player-${pId}`);
    playerEl.classList.remove('active-glow');
    for (let i = 0; i < 3; i++) {
        const card = document.getElementById(`card-${pId}-${i}`);
        if (card) card.classList.remove('reveal');
    }
    AudioEngine.flip();
}

async function evaluateFinalWinner() {
    gameState = 'FINISHED';
    document.getElementById('game-status').innerText = "FINAL SHOWDOWN";

    // Reveal All Hands Sequentially
    for (let i = 0; i < playerCount; i++) {
        const playerEl = document.getElementById(`player-${i}`);
        playerEl.classList.add('active-glow');
        for (let j = 0; j < 3; j++) {
            const card = document.getElementById(`card-${i}-${j}`);
            if (card) card.classList.add('reveal');
        }
        AudioEngine.flip();
        await new Promise(r => setTimeout(r, 400));
    }

    players.forEach(p => p.handInfo = calculateHandScore(p.cards));
    const winner = getWinner(players);

    await new Promise(r => setTimeout(r, 600));

    // Display Winner
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    const banner = document.getElementById('winner-banner');
    document.getElementById('win-name').innerText = winner.name;
    document.getElementById('win-hand').innerText = winner.handInfo.name;
    banner.classList.remove('hidden');

    document.getElementById('last-winner').innerText = winner.name;
    document.getElementById('game-status').innerText = "ROUND FINISHED";
    
    AudioEngine.win();
    hapticFeedback([100, 50, 100]);

    document.getElementById('restart-btn').classList.remove('hidden');
}

function calculateHandScore(cards) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isTrail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isColor = suits[0] === suits[1] && suits[1] === suits[2];
    
    let isSeq = false;
    let seqHigh = ranks[0];

    // Teen Patti Logic: AKQ highest, A23 second
    if (ranks[0] === 14 && ranks[1] === 13 && ranks[2] === 12) { isSeq = true; seqHigh = 15; }
    else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) { isSeq = true; seqHigh = 14; }
    else if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1) { isSeq = true; seqHigh = ranks[0]; }

    if (isTrail) return { score: 6, name: 'TRAIL (SET)', sub: ranks[0] };
    if (isSeq && isColor) return { score: 5, name: 'PURE SEQUENCE', sub: seqHigh };
    if (isSeq) return { score: 4, name: 'SEQUENCE', sub: seqHigh };
    if (isColor) return { score: 3, name: 'COLOR (FLUSH)', sub: ranks };
    
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];
    if (isPair) {
        let pR, kick;
        if (ranks[0] === ranks[1]) { pR = ranks[0]; kick = ranks[2]; }
        else if (ranks[1] === ranks[2]) { pR = ranks[1]; kick = ranks[0]; }
        else { pR = ranks[0]; kick = ranks[1]; }
        return { score: 2, name: 'PAIR', sub: [pR, kick] };
    }
    return { score: 1, name: 'HIGH CARD', sub: ranks };
}

function getWinner(pls) {
    return pls.reduce((p, c) => {
        if (!p) return c;
        if (c.handInfo.score > p.handInfo.score) return c;
        if (c.handInfo.score < p.handInfo.score) return p;
        if (Array.isArray(c.handInfo.sub)) {
            for (let i = 0; i < c.handInfo.sub.length; i++) {
                if (c.handInfo.sub[i] > p.handInfo.sub[i]) return c;
                if (c.handInfo.sub[i] < p.handInfo.sub[i]) return p;
            }
        } else {
            if (c.handInfo.sub > p.handInfo.sub) return c;
            if (c.handInfo.sub < p.handInfo.sub) return p;
        }
        return p;
    });
}

function resetGame() {
    roundCount++;
    document.getElementById('round-count').innerText = roundCount;
    initTable();
}

// Initial Boot
window.onload = initTable;
