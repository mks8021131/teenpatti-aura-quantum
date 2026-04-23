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
let playerNames = ["YOU", "Player 2", "Player 3", "Player 4"];

// Premium Audio Engine
const AudioEngine = {
    ctx: null,
    init() { 
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); 
        if (this.ctx.state === 'suspended') this.ctx.resume(); 
    },
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
    
    // Update labels in setup based on mode
    document.getElementById('label-p2').innerText = mode === 'cpu' ? "CPU 2" : "Player 2";
    document.getElementById('label-p3').innerText = mode === 'cpu' ? "CPU 3" : "Player 3";
    document.getElementById('label-p4').innerText = mode === 'cpu' ? "CPU 4" : "Player 4";
    
    initTable();
}

function setPlayerCount(num) {
    if (gameState !== 'IDLE') return;
    playerCount = num;
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.innerText) === num);
    });
    
    // Update setup inputs visibility
    document.getElementById('group-p3').style.display = num >= 3 ? 'flex' : 'none';
    document.getElementById('group-p4').style.display = num >= 4 ? 'flex' : 'none';
    
    initTable();
}

function initTable() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players = [];
    currentPlayerIndex = 0;
    gameState = 'IDLE';

    document.getElementById('setup-overlay').classList.remove('hidden');

    for (let i = 0; i < playerCount; i++) {
        const pId = i + 1;
        players.push({
            id: pId,
            name: "", // Will be filled on confirm
            cards: [],
            pos: POSITIONS[i],
            handInfo: null
        });

        const slot = document.createElement('div');
        slot.className = `player-slot ${players[i].pos}`;
        slot.id = `player-${pId}`;
        
        slot.innerHTML = `
            <div class="player-label" id="label-display-${pId}">...</div>
            <div class="card-group" id="player${pId}-cards"></div>
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

function confirmNames() {
    playerNames[0] = document.getElementById('name-p1').value.trim() || "YOU";
    playerNames[1] = document.getElementById('name-p2').value.trim() || (systemMode === 'cpu' ? "CPU 2" : "Player 2");
    playerNames[2] = document.getElementById('name-p3').value.trim() || (systemMode === 'cpu' ? "CPU 3" : "Player 3");
    playerNames[3] = document.getElementById('name-p4').value.trim() || (systemMode === 'cpu' ? "CPU 4" : "Player 4");

    players.forEach((p, i) => {
        p.name = playerNames[i];
        document.getElementById(`label-display-${p.id}`).innerText = p.name;
    });

    document.getElementById('setup-overlay').classList.add('hidden');
    haptic(100);
}

function createDeck() {
    deck = [];
    for (let s of SUITS) {
        for (let v of VALUES) {
            deck.push({ value: v, suit: s });
        }
    }
}

function shuffle() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function createCardElement(card) {
    const isRed = card.suit === '♥' || card.suit === '♦';
    const cardEl = document.createElement('div');
    cardEl.className = `card ${isRed ? 'red' : 'black'}`;
    
    cardEl.innerHTML = `
        <div class="card-top">${card.value}</div>
        <div class="card-center">${card.suit}</div>
        <div class="card-bottom">${card.value}</div>
    `;
    return cardEl;
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
        document.getElementById(`player${p.id}-cards`).innerHTML = '';
        document.getElementById(`player-${p.id}`).classList.remove('winner', 'active-glow');
    });

    for (let i = 0; i < 3; i++) {
        for (let player of players) {
            await new Promise(r => setTimeout(r, 300));
            const card = deck.pop();
            player.cards.push(card);
            
            const container = document.getElementById(`player${player.id}-cards`);
            const cardEl = createCardElement(card);
            
            const slotRect = document.getElementById(`player-${player.id}`).getBoundingClientRect();
            const tableRect = document.querySelector('.table-surface').getBoundingClientRect();
            const dx = (tableRect.width/2) - (slotRect.left - tableRect.left + slotRect.width/2);
            const dy = (tableRect.height/2) - (slotRect.top - tableRect.top + slotRect.height/2);
            
            cardEl.classList.add('anim-deal');
            cardEl.style.setProperty('--dx', `${dx}px`);
            cardEl.style.setProperty('--dy', `${dy}px`);
            cardEl.style.setProperty('--dr', `${Math.random() * 20 - 10}deg`);

            if (systemMode === 'pass' || (systemMode === 'cpu' && player.id !== 1)) {
                cardEl.classList.add('hide-content');
            }

            container.appendChild(cardEl);
            AudioEngine.deal();
        }
    }

    await new Promise(r => setTimeout(r, 1000));

    if (systemMode === 'pass') {
        startMultiplayerFlow();
    } else {
        document.getElementById('game-status').innerText = "SHOWDOWN";
        await evaluateWinner();
    }
}

function startMultiplayerFlow() {
    gameState = 'PLAYING';
    document.getElementById('game-status').innerText = "PASS DEVICE";
    showPassOverlay();
}

function showPassOverlay() {
    const overlay = document.getElementById('pass-overlay');
    const nameEl = document.getElementById('pass-player-name');
    nameEl.innerText = players[currentPlayerIndex].name;
    overlay.classList.remove('hidden');
}

function revealCurrentPlayer() {
    document.getElementById('pass-overlay').classList.add('hidden');
    const player = players[currentPlayerIndex];
    const container = document.getElementById(`player${player.id}-cards`);
    
    const cards = container.querySelectorAll('.card');
    cards.forEach((el, idx) => {
        setTimeout(() => {
            el.classList.remove('hide-content');
            AudioEngine.flip();
        }, idx * 200);
    });

    document.getElementById(`player-${player.id}`).classList.add('active-glow');
    
    const showBtn = document.getElementById('show-btn');
    showBtn.classList.remove('hidden');
    showBtn.innerText = (currentPlayerIndex === playerCount - 1) ? "Final Show" : "End Turn";
    showBtn.onclick = () => {
        cards.forEach(el => el.classList.add('hide-content'));
        document.getElementById(`player-${player.id}`).classList.remove('active-glow');
        currentPlayerIndex++;
        showBtn.classList.add('hidden');
        
        if (currentPlayerIndex < playerCount) {
            showPassOverlay();
        } else {
            evaluateWinner();
        }
    };
}

async function evaluateWinner() {
    gameState = 'FINISHED';
    
    for (let player of players) {
        const container = document.getElementById(`player${player.id}-cards`);
        container.querySelectorAll('.card').forEach(c => c.classList.remove('hide-content'));
        document.getElementById(`player-${player.id}`).classList.add('active-glow');
        AudioEngine.flip();
        await new Promise(r => setTimeout(r, 400));
    }

    players.forEach(p => p.handInfo = calculateHandScore(p.cards));
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

    await new Promise(r => setTimeout(r, 1000));

    const winnerEl = document.getElementById(`player-${winner.id}`);
    winnerEl.classList.add('winner');
    
    const banner = document.getElementById('winner-banner');
    document.getElementById('win-name').innerText = `Winner: ${winner.name}`;
    document.getElementById('win-hand').innerText = ""; 
    banner.classList.remove('hidden');

    document.getElementById('last-winner').innerText = winner.name;
    document.getElementById('game-status').innerText = "ROUND OVER";
    
    AudioEngine.win();
    haptic([100, 50, 100]);

    document.getElementById('restart-btn').classList.remove('hidden');
}

function calculateHandScore(cards) {
    const s = [...cards].sort((a,b) => VALUE_MAP[b.value] - VALUE_MAP[a.value]);
    const r = s.map(c => VALUE_MAP[c.value]), su = s.map(c => c.suit);
    const isT = r[0] === r[1] && r[1] === r[2];
    const isC = su[0] === su[1] && su[1] === su[2];
    let isS = false, high = r[0];
    if (r[0] === 14 && r[1] === 13 && r[2] === 12) { isS = true; high = 15; }
    else if (r[0] === 14 && r[1] === 3 && r[2] === 2) { isS = true; high = 14; }
    else if (r[0] === r[1]+1 && r[1] === r[2]+1) { isS = true; high = r[0]; }

    if (isT) return { score: 6, name: 'TRAIL', sub: r[0] };
    if (isS && isC) return { score: 5, name: 'PURE SEQUENCE', sub: high };
    if (isS) return { score: 4, name: 'SEQUENCE', sub: high };
    if (isC) return { score: 3, name: 'COLOR', sub: r };
    if (r[0] === r[1] || r[1] === r[2]) {
        const pR = (r[0] === r[1]) ? r[0] : r[1];
        const k = (r[0] === r[1]) ? r[2] : r[0];
        return { score: 2, name: 'PAIR', sub: [pR, k] };
    }
    return { score: 1, name: 'HIGH CARD', sub: r };
}

function resetGame() {
    roundCount++;
    document.getElementById('round-count').innerText = roundCount;
    initTable();
}

// Initial Boot
window.onload = () => {
    initTable();
};

