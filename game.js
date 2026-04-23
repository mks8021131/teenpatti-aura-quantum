const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
const POSITIONS = ['slot-bottom', 'slot-top', 'slot-left', 'slot-right'];

let deck = [];
let players = [];
let playerCount = 4;
let roundCount = 1;

const HAND_RANK = { TRAIL: 6, PURE_SEQUENCE: 5, SEQUENCE: 4, COLOR: 3, PAIR: 2, HIGH_CARD: 1 };

// Sound Manager (Web Audio API)
const Sound = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    play(freq, type = 'sine', duration = 0.1) {
        if (!document.getElementById('sound-toggle').checked) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },
    deal() { this.play(400, 'sine', 0.1); },
    flip() { this.play(600, 'triangle', 0.1); },
    win() { [523, 659, 783, 1046].forEach((f, i) => setTimeout(() => this.play(f, 'sine', 0.5), i * 150)); }
};

function haptic() {
    if (document.getElementById('haptic-toggle').checked && navigator.vibrate) {
        navigator.vibrate(50);
    }
}

function setPlayerCount(num) {
    playerCount = num;
    document.querySelectorAll('.selector-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    initTable();
}

function initTable() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    players = [];

    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            name: i === 0 ? "YOU" : `PLAYER ${i + 1}`,
            cards: [],
            pos: POSITIONS[i]
        });

        const slot = document.createElement('div');
        slot.className = `player-slot ${players[i].pos}`;
        slot.id = `player-${i}`;
        slot.innerHTML = `
            <div class="player-label">${players[i].name}</div>
            <div class="card-group" id="cards-${i}">
                <div class="card-box"><div class="card-side card-back"></div></div>
                <div class="card-box"><div class="card-side card-back"></div></div>
                <div class="card-box"><div class="card-side card-back"></div></div>
            </div>
        `;
        container.appendChild(slot);
    }
    document.getElementById('game-status').innerText = "Ready";
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
    createDeck();
    shuffle();
    haptic();
    document.getElementById('deal-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "Dealing...";

    // Clear previous round
    players.forEach(p => {
        document.getElementById(`cards-${p.id}`).innerHTML = '';
        document.getElementById(`player-${p.id}`).classList.remove('winner');
    });

    for (let c = 0; c < 3; c++) {
        for (let p = 0; p < playerCount; p++) {
            const card = deck.pop();
            players[p].cards[c] = card;
            addCardToUI(p, card, c);
            Sound.deal();
            await new Promise(r => setTimeout(r, 150));
        }
    }

    // Reveal Player 1 (YOU)
    await new Promise(r => setTimeout(r, 500));
    revealPlayer(0);
    
    document.getElementById('show-btn').classList.remove('hidden');
    document.getElementById('game-status').innerText = "Cards Dealt";
}

function addCardToUI(pId, card, idx) {
    const container = document.getElementById(`cards-${pId}`);
    const box = document.createElement('div');
    box.className = 'card-box anim-deal';
    box.id = `card-${pId}-${idx}`;

    const isRed = card.suit === '♥' || card.suit === '♦';
    
    // Calculate offsets for deal animation from center
    const slotRect = document.getElementById(`player-${pId}`).getBoundingClientRect();
    const tableRect = document.getElementById('game-table').getBoundingClientRect();
    const tx = (tableRect.left + tableRect.width/2) - (slotRect.left + slotRect.width/2);
    const ty = (tableRect.top + tableRect.height/2) - (slotRect.top + slotRect.height/2);
    
    box.style.setProperty('--dx', `${tx}px`);
    box.style.setProperty('--dy', `${ty}px`);

    box.innerHTML = `
        <div class="card-side card-back"></div>
        <div class="card-side card-front ${isRed ? 'red' : ''}">
            <div class="rank">${card.value}</div>
            <div class="suit">${card.suit}</div>
            <div class="suit-mini">${card.suit}</div>
        </div>
    `;
    container.appendChild(box);
}

function revealPlayer(pId) {
    for (let i = 0; i < 3; i++) {
        const card = document.getElementById(`card-${pId}-${i}`);
        if (card) {
            setTimeout(() => {
                card.classList.add('flipped');
                Sound.flip();
            }, i * 150);
        }
    }
}

async function showWinner() {
    document.getElementById('show-btn').classList.add('hidden');
    document.getElementById('game-status').innerText = "Evaluating...";

    // Reveal others
    for (let i = 1; i < playerCount; i++) {
        revealPlayer(i);
        await new Promise(r => setTimeout(r, 400));
    }

    players.forEach(p => p.handInfo = evaluateHand(p.cards));
    const winner = determineWinner(players);

    await new Promise(r => setTimeout(r, 600));

    // Show banner
    document.getElementById(`player-${winner.id}`).classList.add('winner');
    const banner = document.getElementById('winner-banner');
    document.getElementById('win-name').innerText = winner.name;
    document.getElementById('win-hand').innerText = winner.handInfo.handName;
    banner.classList.remove('hidden');

    document.getElementById('last-winner').innerText = winner.name;
    document.getElementById('game-status').innerText = "Finished";
    
    Sound.win();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

    document.getElementById('restart-btn').classList.remove('hidden');
}

function resetGame() {
    roundCount++;
    document.getElementById('round-count').innerText = roundCount;
    document.getElementById('winner-banner').classList.add('hidden');
    document.getElementById('restart-btn').classList.add('hidden');
    document.getElementById('deal-btn').classList.remove('hidden');
    initTable();
}

function evaluateHand(cards) {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isTrail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
    const isColor = suits[0] === suits[1] && suits[1] === suits[2];
    
    let isSeq = false;
    let seqHigh = ranks[0];

    if (ranks[0] === 14 && ranks[1] === 13 && ranks[2] === 12) { isSeq = true; seqHigh = 15; }
    else if (ranks[0] === 14 && ranks[1] === 3 && ranks[2] === 2) { isSeq = true; seqHigh = 14; }
    else if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1) { isSeq = true; seqHigh = ranks[0]; }

    if (isTrail) return { score: 6, handName: 'TRAIL (SET)', sub: ranks[0] };
    if (isSeq && isColor) return { score: 5, handName: 'PURE SEQUENCE', sub: seqHigh };
    if (isSeq) return { score: 4, handName: 'SEQUENCE', sub: seqHigh };
    if (isColor) return { score: 3, handName: 'COLOR (FLUSH)', sub: ranks };
    
    const isPair = ranks[0] === ranks[1] || ranks[1] === ranks[2] || ranks[0] === ranks[2];
    if (isPair) {
        let pR, kick;
        if (ranks[0] === ranks[1]) { pR = ranks[0]; kick = ranks[2]; }
        else if (ranks[1] === ranks[2]) { pR = ranks[1]; kick = ranks[0]; }
        else { pR = ranks[0]; kick = ranks[1]; }
        return { score: 2, handName: 'PAIR', sub: [pR, kick] };
    }
    return { score: 1, handName: 'HIGH CARD', sub: ranks };
}

function determineWinner(pls) {
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

// Start
window.onload = initTable;
