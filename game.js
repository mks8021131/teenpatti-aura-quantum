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

const AudioEngine = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(freq, dur = 0.1, type = 'sine') {
        if (!document.getElementById('sound-toggle').checked) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(0.05, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(g); g.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    },
    deal() { this.play(300, 0.1, 'sine'); },
    flip() { this.play(500, 0.08, 'triangle'); },
    win() { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.play(f, 0.4, 'sine'), i * 150)); }
};

function haptic(p = 50) { if (document.getElementById('haptic-toggle').checked && navigator.vibrate) navigator.vibrate(p); }

function setPlayerCount(num) {
    if (gameState !== 'IDLE') return;
    playerCount = num;
    document.querySelectorAll('.selector-btn').forEach(btn => btn.classList.toggle('active', parseInt(btn.innerText) === num));
    initTable();
}

function initTable() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players = [];
    currentPlayerIndex = 0;
    gameState = 'IDLE';

    for (let i = 0; i < playerCount; i++) {
        players.push({ id: i, name: `PLAYER ${i + 1}`, cards: [], pos: POSITIONS[i] });
        const slot = document.createElement('div');
        slot.className = `player-slot ${players[i].pos}`;
        slot.id = `player-${i}`;
        slot.innerHTML = `
            <div class="player-label-styled">${players[i].name}</div>
            <div class="card-group" id="cards-${i}">
                <div class="card-container"><div class="card-face card-back"></div></div>
                <div class="card-container"><div class="card-face card-back"></div></div>
                <div class="card-container"><div class="card-face card-back"></div></div>
            </div>
        `;
        container.appendChild(slot);
    }
    document.getElementById('game-status').innerText = "READY";
    document.getElementById('deal-btn').classList.remove('hidden');
    document.getElementById('show-btn').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('winner-banner').classList.add('hidden');
}

function createDeck() {
    deck = [];
    for (let s of SUITS) for (let v of VALUES) deck.push({ suit: s, value: v, rank: VALUE_MAP[v] });
}

function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

async function dealCards() {
    AudioEngine.init();
    createDeck();
    shuffle();
    haptic(30);
    gameState = 'DEALING';
    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "DEALING...";

    players.forEach(p => document.getElementById(`cards-${p.id}`).innerHTML = '');

    for (let c = 0; c < 3; c++) {
        for (let p = 0; p < playerCount; p++) {
            const card = deck.pop();
            players[p].cards[c] = card;
            spawnCard(p, card, c);
            AudioEngine.deal();
            await new Promise(r => setTimeout(r, 120));
        }
    }
    setTimeout(startTurnSequence, 500);
}

function spawnCard(pId, card, idx) {
    const container = document.getElementById(`cards-${pId}`);
    const box = document.createElement('div');
    box.className = 'card-container anim-deal';
    box.id = `card-${pId}-${idx}`;
    const isRed = card.suit === '♥' || card.suit === '♦';
    
    // Relative to the table center (0,0 of table-surface basically)
    const slot = document.getElementById(`player-${pId}`);
    const table = document.querySelector('.table-surface');
    const tableRect = table.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const dx = (tableRect.width/2) - (slotRect.left - tableRect.left + slotRect.width/2);
    const dy = (tableRect.height/2) - (slotRect.top - tableRect.top + slotRect.height/2);

    box.style.setProperty('--dx', `${dx}px`);
    box.style.setProperty('--dy', `${dy}px`);
    box.style.setProperty('--dr', `${Math.random() * 20 - 10}deg`);

    box.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front ${isRed ? 'red' : ''}">
            <div class="rank">${card.value}</div>
            <div class="suit-center">${card.suit}</div>
            <div class="rank" style="transform:rotate(180deg)">${card.value}</div>
        </div>
    `;
    container.appendChild(box);
}

function startTurnSequence() {
    gameState = 'PLAYING';
    if (currentPlayerIndex < playerCount) {
        document.getElementById('pass-player-name').innerText = players[currentPlayerIndex].name;
        document.getElementById('pass-overlay').classList.remove('hidden');
        document.getElementById('game-status').innerText = `TURN: ${players[currentPlayerIndex].name}`;
    } else {
        showFinalShowdown();
    }
}

function revealCurrentPlayer() {
    document.getElementById('pass-overlay').classList.add('hidden');
    const pId = currentPlayerIndex;
    document.getElementById(`player-${pId}`).classList.add('active-glow');
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            document.getElementById(`card-${pId}-${i}`).classList.add('reveal');
            AudioEngine.flip();
        }, i * 150);
    }
    const showBtn = document.getElementById('show-btn');
    showBtn.innerText = (currentPlayerIndex === playerCount - 1) ? "Final Showdown" : "End Turn";
    showBtn.classList.remove('hidden');
    showBtn.onclick = () => {
        document.getElementById(`player-${pId}`).classList.remove('active-glow');
        for (let i = 0; i < 3; i++) document.getElementById(`card-${pId}-${i}`).classList.remove('reveal');
        currentPlayerIndex++;
        showBtn.classList.add('hidden');
        startTurnSequence();
    };
}

async function showFinalShowdown() {
    gameState = 'FINISHED';
    document.getElementById('game-status').innerText = "SHOWDOWN";
    for (let i = 0; i < playerCount; i++) {
        for (let j = 0; j < 3; j++) document.getElementById(`card-${i}-${j}`).classList.add('reveal');
        AudioEngine.flip();
        await new Promise(r => setTimeout(r, 400));
    }
    const winner = determineWinner(players);
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    const banner = document.getElementById('winner-banner');
    document.getElementById('win-name').innerText = winner.name;
    document.getElementById('win-hand').innerText = evaluateHand(winner.cards).name;
    banner.classList.remove('hidden');
    document.getElementById('last-winner').innerText = winner.name;
    AudioEngine.win(); haptic([100, 50, 100]);
    document.getElementById('restart-btn').classList.remove('hidden');
}

function evaluateHand(cards) {
    const s = [...cards].sort((a,b) => b.rank - a.rank);
    const r = s.map(c => c.rank), su = s.map(c => c.suit);
    const isT = r[0] === r[1] && r[1] === r[2];
    const isC = su[0] === su[1] && su[1] === su[2];
    let isS = false, high = r[0];
    if (r[0] === 14 && r[1] === 13 && r[2] === 12) { isS = true; high = 15; }
    else if (r[0] === 14 && r[1] === 3 && r[2] === 2) { isS = true; high = 14; }
    else if (r[0] === r[1]+1 && r[1] === r[2]+1) { isS = true; high = r[0]; }

    if (isT) return { score: 6, name: 'TRAIL', sub: r[0] };
    if (isS && isC) return { score: 5, name: 'PURE SEQ', sub: high };
    if (isS) return { score: 4, name: 'SEQUENCE', sub: high };
    if (isC) return { score: 3, name: 'COLOR', sub: r };
    if (r[0] === r[1] || r[1] === r[2]) {
        const pR = r[1], k = (r[0] === r[1]) ? r[2] : r[0];
        return { score: 2, name: 'PAIR', sub: [pR, k] };
    }
    return { score: 1, name: 'HIGH CARD', sub: r };
}

function determineWinner(pls) {
    const scores = pls.map(p => ({ ...p, info: evaluateHand(p.cards) }));
    return scores.reduce((p, c) => {
        if (!p) return c;
        if (c.info.score > p.info.score) return c;
        if (c.info.score < p.info.score) return p;
        const cS = Array.isArray(c.info.sub) ? c.info.sub : [c.info.sub];
        const pS = Array.isArray(p.info.sub) ? p.info.sub : [p.info.sub];
        for (let i = 0; i < cS.length; i++) {
            if (cS[i] > pS[i]) return c;
            if (cS[i] < pS[i]) return p;
        }
        return p;
    });
}

function resetGame() { roundCount++; document.getElementById('round-count').innerText = roundCount; initTable(); }
window.onload = initTable;
