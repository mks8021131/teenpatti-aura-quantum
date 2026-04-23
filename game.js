const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALUE_MAP = { 'A': 14, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
const POSITIONS = ['slot-bottom', 'slot-top', 'slot-left', 'slot-right'];

let deck = [];
let players = [];
let playerCount = 4;
let roundCount = 1;
let currentPlayerIndex = 0;
let gameState = 'IDLE';
let systemMode = 'cpu'; 

// Premium Audio Engine
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
    flip() { this.play(500, 0.08, 'triangle', 0.04); },
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
    currentPlayerIndex = 0;
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
        
        // Initial setup with card-backs for premium feel
        slot.innerHTML = `
            <div class="player-label">${players[i].name}</div>
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
    document.getElementById('pass-overlay').classList.add('hidden');
}

function createDeck() {
    deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ suit: s, value: v, rank: VALUE_MAP[v] });
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
    AudioEngine.init();
    createDeck();
    shuffle();
    haptic(30);
    gameState = 'DEALING';
    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "DEALING HANDS...";

    players.forEach(p => {
        document.getElementById(`cards-${p.id}`).innerHTML = '';
        document.getElementById(`player-${p.id}`).classList.remove('winner', 'active-glow');
    });

    for (let c = 0; c < 3; c++) {
        for (let p = 0; p < playerCount; p++) {
            const card = deck.pop();
            players[p].cards[c] = card;
            spawnCard(p, card, c);
            AudioEngine.deal();
            await new Promise(r => setTimeout(r, 120));
        }
    }

    await new Promise(r => setTimeout(r, 400));
    
    if (systemMode === 'pass') {
        startTurnSequence();
    } else {
        revealPlayer(0);
        document.getElementById('show-btn').innerText = "SHOW HANDS";
        document.getElementById('show-btn').classList.remove('hidden');
        document.getElementById('show-btn').onclick = evaluateFinalWinner;
        document.getElementById('game-status').innerText = "YOUR TURN";
    }
}

function spawnCard(pId, card, idx) {
    const container = document.getElementById(`cards-${pId}`);
    const box = document.createElement('div');
    box.className = 'card-container anim-deal';
    box.id = `card-${pId}-${idx}`;
    const isRed = card.suit === '♥' || card.suit === '♦';
    
    const slotRect = document.getElementById(`player-${pId}`).getBoundingClientRect();
    const tableRect = document.querySelector('.table-surface').getBoundingClientRect();
    const dx = (tableRect.width/2) - (slotRect.left - tableRect.left + slotRect.width/2);
    const dy = (tableRect.height/2) - (slotRect.top - tableRect.top + slotRect.height/2);
    
    box.style.setProperty('--dx', `${dx}px`);
    box.style.setProperty('--dy', `${dy}px`);
    box.style.setProperty('--dr', `${Math.random() * 20 - 10}deg`);

    box.innerHTML = `
        <div class="card-face card-back"></div>
        <div class="card-face card-front ${isRed ? 'red' : ''}">
            <div class="top-left">${card.value}</div>
            <div class="suit-center">${card.suit}</div>
            <div class="bottom-right">${card.value}</div>
        </div>
    `;
    container.appendChild(box);
}

function revealPlayer(pId) {
    document.getElementById(`player-${pId}`).classList.add('active-glow');
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            const el = document.getElementById(`card-${pId}-${i}`);
            if (el) el.classList.add('reveal');
            AudioEngine.flip();
        }, i * 150);
    }
}

function startTurnSequence() {
    gameState = 'PLAYING';
    if (currentPlayerIndex < playerCount) {
        document.getElementById('pass-player-name').innerText = players[currentPlayerIndex].name;
        document.getElementById('pass-overlay').classList.remove('hidden');
    } else {
        evaluateFinalWinner();
    }
}

function revealCurrentPlayer() {
    document.getElementById('pass-overlay').classList.add('hidden');
    const pId = currentPlayerIndex;
    revealPlayer(pId);
    
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

async function evaluateFinalWinner() {
    gameState = 'FINISHED';
    document.getElementById('show-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "REVEALING ALL...";

    for (let i = 0; i < playerCount; i++) {
        revealPlayer(i);
        await new Promise(r => setTimeout(r, 400));
    }

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

    await new Promise(r => setTimeout(r, 800));
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    document.getElementById('win-name').innerText = winner.name;
    document.getElementById('win-hand').innerText = winner.handInfo.name;
    document.getElementById('winner-banner').classList.remove('hidden');
    document.getElementById('last-winner').innerText = winner.name;
    document.getElementById('game-status').innerText = "ROUND COMPLETE";
    AudioEngine.win(); haptic([100, 50, 100]);
    document.getElementById('restart-btn').classList.remove('hidden');
}

function calculateScore(cards) {
    const s = [...cards].sort((a,b) => b.rank - a.rank);
    const r = s.map(c => c.rank), su = s.map(c => c.suit);
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
        const pR = r[1], k = (r[0] === r[1]) ? r[2] : r[0];
        return { score: 2, name: 'PAIR', sub: [pR, k] };
    }
    return { score: 1, name: 'HIGH CARD', sub: r };
}

function resetGame() { roundCount++; document.getElementById('round-count').innerText = roundCount; initTable(); }
window.onload = initTable;
