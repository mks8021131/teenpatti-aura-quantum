const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALUE_MAP = { 'A': 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
const POSITIONS = ['slot-bottom', 'slot-top', 'slot-left', 'slot-right'];

let deck = [];
let players = [];
let playerCount = 4;
let roundCount = 1;
let gameState = 'IDLE';
let systemMode = 'cpu'; 

const AudioEngine = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); },
    play(freq, dur = 0.1, type = 'sine', vol = 0.05) {
        if (!document.getElementById('sound-toggle').checked) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.connect(g); g.connect(this.ctx.destination);
        osc.start(); osc.stop(this.ctx.currentTime + dur);
    },
    deal() { this.play(300, 0.1, 'sine', 0.06); },
    win() { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.play(f, 0.5, 'sine', 0.05), i * 150)); }
};

function haptic(p = 50) { if (document.getElementById('haptic-toggle').checked && navigator.vibrate) navigator.vibrate(p); }

function setSystemMode(mode) {
    if (gameState !== 'IDLE') return;
    systemMode = mode;
    document.getElementById('mode-cpu').classList.toggle('active', mode === 'cpu');
    document.getElementById('mode-pass').classList.toggle('active', mode === 'pass');
    initTable();
}

function setPlayerCount(num) {
    if (gameState !== 'IDLE') return;
    playerCount = num;
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === num);
    });
    initTable();
}

function initTable() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players = [];
    gameState = 'IDLE';

    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: systemMode === 'cpu' ? (i === 0 ? "YOU" : `CPU ${i + 1}`) : `PLAYER ${i + 1}`,
            cards: [],
            pos: POSITIONS[i],
            handInfo: null
        });

        const slot = document.createElement('div');
        slot.className = `player-slot ${players[i].pos}`;
        slot.id = `player-${i}`;
        
        slot.innerHTML = `
            <div class="player-label">${players[i].name}</div>
            <div class="card-group" id="player${i+1}-cards"></div>
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
    for (let s of SUITS) for (let v of VALUES) deck.push({ value: v, suit: s });
}

function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

async function dealCards() {
    if (gameState !== 'IDLE') return;
    AudioEngine.init();
    createDeck();
    shuffle();
    haptic(30);
    gameState = 'DEALING';
    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "DEALING...";

    players.forEach(p => {
        document.getElementById(`player${p.id+1}-cards`).innerHTML = '';
        document.getElementById(`player-${p.id}`).classList.remove('winner', 'active-glow');
    });

    for (let c = 0; c < 3; c++) {
        for (let p = 0; p < playerCount; p++) {
            const card = deck.pop();
            players[p].cards.push(card);
            renderSingleCard(p, card, c);
            AudioEngine.deal();
            await new Promise(r => setTimeout(r, 150));
        }
    }

    gameState = 'FINISHED';
    evaluateWinner();
}

function renderSingleCard(pIdx, card, cardIdx) {
    const container = document.getElementById(`player${pIdx+1}-cards`);
    const cardEl = document.createElement('div');
    const isRed = card.suit === '♥' || card.suit === '♦';
    cardEl.className = `card ${isRed ? 'red' : 'black'} anim-deal`;
    
    // Calculate Fly-In from center
    const slotRect = document.getElementById(`player-${pIdx}`).getBoundingClientRect();
    const tableRect = document.querySelector('.table-surface').getBoundingClientRect();
    const centerX = tableRect.left + tableRect.width / 2;
    const centerY = tableRect.top + tableRect.height / 2;
    
    const dx = centerX - (slotRect.left + slotRect.width / 2);
    const dy = centerY - (slotRect.top + slotRect.height / 2);
    
    cardEl.style.setProperty('--dx', `${dx}px`);
    cardEl.style.setProperty('--dy', `${dy}px`);
    cardEl.style.setProperty('--dr', `${Math.random() * 20 - 10}deg`);

    cardEl.innerHTML = `
        <div class="top">${card.value}</div>
        <div class="center">${card.suit}</div>
        <div class="bottom">${card.value}</div>
    `;
    container.appendChild(cardEl);
}

function evaluateWinner() {
    players.forEach(p => p.handInfo = calculateScore(p.cards));
    const winner = players.reduce((p, c) => {
        if (!p) return c;
        if (c.handInfo.score > p.handInfo.score) return c;
        if (c.handInfo.score < p.handInfo.score) return p;
        const cS = Array.isArray(c.handInfo.sub) ? c.handInfo.sub : [c.handInfo.sub];
        const pS = Array.isArray(p.handInfo.sub) ? p.handInfo.sub : [p.handInfo.sub];
        for (let i = 0; i < cS.length; i++) {
            if (cS[i] > pS[i]) return c;
            if (cS[i] < pS[i]) return p;
        }
        return p;
    });

    setTimeout(() => {
        document.getElementById(`player-${winner.id}`).classList.add('winner');
        const banner = document.getElementById('winner-banner');
        document.getElementById('win-name').innerText = winner.name;
        document.getElementById('win-hand').innerText = winner.handInfo.name;
        banner.classList.remove('hidden');
        document.getElementById('last-winner').innerText = winner.name;
        document.getElementById('game-status').innerText = "ROUND FINISHED";
        AudioEngine.win();
        haptic([100, 50, 100]);
        document.getElementById('restart-btn').classList.remove('hidden');
    }, 500);
}

function calculateScore(cards) {
    const s = [...cards].sort((a,b) => VALUE_MAP[b.value] - VALUE_MAP[a.value]);
    const r = s.map(c => VALUE_MAP[c.value]), su = s.map(c => c.suit);
    const isT = r[0] === r[1] && r[1] === r[2];
    const isC = su[0] === su[1] && su[1] === su[2];
    let isS = false, high = r[0];
    if (r[0] === 14 && r[1] === 13 && r[2] === 12) { isS = true; high = 15; }
    else if (r[0] === 14 && r[1] === 3 && r[2] === 2) { isS = true; high = 14; }
    else if (r[0] === r[1]+1 && r[1] === r[2]+1) { isS = true; high = r[0]; }

    if (isT) return { score: 6, name: 'TRAIL (SET)', sub: r[0] };
    if (isS && isC) return { score: 5, name: 'PURE SEQUENCE', sub: high };
    if (isS) return { score: 4, name: 'SEQUENCE', sub: high };
    if (isC) return { score: 3, name: 'COLOR (FLUSH)', sub: r };
    if (r[0] === r[1] || r[1] === r[2]) {
        const pR = (r[0] === r[1]) ? r[0] : r[1];
        const k = (r[0] === r[1]) ? r[2] : r[0];
        return { score: 2, name: 'PAIR', sub: [pR, k] };
    }
    return { score: 1, name: 'HIGH CARD', sub: r };
}

function resetGame() { roundCount++; document.getElementById('round-count').innerText = roundCount; initTable(); }
window.onload = initTable;
