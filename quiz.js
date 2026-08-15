import { db } from './firebase-config.js';
import { ref, get, child } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const urlParams = new URLSearchParams(window.location.search);
const currentMode = urlParams.get('mode') || 'kanji-arti';
const currentStyle = urlParams.get('style') === 'flip' ? 'flip' : 'mcq';

// Konfigurasi tiap kategori: apa yang ditanya & apa jawabannya
const MODE_CONFIG = {
    'kanji-arti':     { ask: 'kanji',    answer: 'arti',     hint: 'Apa Arti dari:',   backHint: 'Arti & Cara Baca', sub: 'hiragana' },
    'kanji-hiragana': { ask: 'kanji',    answer: 'hiragana', hint: 'Cara bacanya:',    backHint: 'Cara Baca',        sub: null },
    'hiragana-arti':  { ask: 'hiragana', answer: 'arti',     hint: 'Apa Arti dari:',   backHint: 'Arti',             sub: 'kanji' }
};
const cfg = MODE_CONFIG[currentMode] || MODE_CONFIG['kanji-arti'];

let fullData = [];
let currentQuestion = {};
let score = 0;
let streak = 0;
let timer;
let timeLeft = 10;
let cardRevealed = false;

const flashcard = document.getElementById('flashcard');
const cardFront = document.querySelector('.card-front');
const questionText = document.getElementById('questionText');
const questionHint = document.getElementById('questionHint');
const backHint = document.getElementById('backHint');
const answerMain = document.getElementById('answerMain');
const answerSub = document.getElementById('answerSub');
const flipHint = document.getElementById('flipHint');
const timerBar = document.getElementById('timerBar');
const timerWrapper = document.getElementById('timerWrapper');
const optionsGrid = document.getElementById('optionsGrid');
const trueFlashcardControls = document.getElementById('trueFlashcardControls');
const streakDisplay = document.getElementById('streakDisplay');
const buttons = [
    document.getElementById('opt0'), document.getElementById('opt1'),
    document.getElementById('opt2'), document.getElementById('opt3')
];

document.getElementById('btnExit').addEventListener('click', () => { window.location.href = 'index.html'; });

/* =========================================================
   EFEK SUARA — disintesis langsung, tanpa file audio eksternal
   ========================================================= */
let audioCtx;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}
function playTone(freq, startTime, duration, type = 'sine', gainPeak = 0.18) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
}
function playCorrectSound() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(523.25, now, 0.12, 'triangle');
    playTone(659.25, now + 0.09, 0.12, 'triangle');
    playTone(783.99, now + 0.18, 0.22, 'triangle');
}
function playWrongSound() {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    playTone(196, now, 0.22, 'sawtooth', 0.12);
    playTone(146.83, now + 0.1, 0.28, 'sawtooth', 0.12);
}
function playFlipSound() {
    const ctx = getAudioCtx();
    playTone(880, ctx.currentTime, 0.08, 'sine', 0.08);
}

// JALUR DATABASE BARU
const DB_PATH = 'custom_app/kosakata';

async function loadData() {
    const dbRef = ref(db);
    try {
        const snapshot = await get(child(dbRef, DB_PATH));
        let allData = [];
        
        if (snapshot.exists()) {
            const dataObj = snapshot.val();
            for (const key in dataObj) {
                // Konversi objek ke array. Jika kanji "-", kita pakai hiragana sebagai tampilan utamanya.
                allData.push({
                    id: key,
                    kanji: dataObj[key].kanji !== "-" ? dataObj[key].kanji : dataObj[key].hiragana,
                    hiragana: dataObj[key].hiragana,
                    arti: dataObj[key].arti
                });
            }
        }

        let hiddenIds = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];
        fullData = allData.filter(item => !hiddenIds.includes(item.id));

        document.getElementById('loadingScreen').style.display = 'none';

        if (fullData.length === 0) {
            document.getElementById('resultScreen').style.display = 'block';
            document.getElementById('emptyMessage').innerText = "Belum ada kosakata! Buka Kamus di Menu Utama untuk menambahkan kosakata pertamamu.";
            return;
        }

        document.getElementById('quizArea').style.display = 'block';

        if (currentStyle === 'flip') {
            optionsGrid.style.display = 'none';
            timerWrapper.style.display = 'none';
            trueFlashcardControls.style.display = 'flex';
            document.querySelector('.score-board').style.display = 'none';
        } else {
            flashcard.classList.add('no-flip');
        }

        nextQuestion();
    } catch (error) {
        document.getElementById('loadingScreen').innerHTML = "<p style='color:#ff3860;'>Gagal terhubung ke server.</p>";
        console.error(error);
    }
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function nextQuestion() {
    if (fullData.length === 0) {
        document.getElementById('quizArea').style.display = 'none';
        document.getElementById('resultScreen').style.display = 'block';
        document.getElementById('emptyMessage').innerText = "Semua kosakata sudah dikuasai!";
        return;
    }

    currentQuestion = fullData[Math.floor(Math.random() * fullData.length)];
    flashcard.classList.remove('is-flipped');
    cardRevealed = false;

    if (currentStyle === 'flip') {
        questionHint.innerText = cfg.hint;
        questionText.innerText = currentQuestion[cfg.ask];
        backHint.innerText = cfg.backHint;
        answerMain.innerText = currentQuestion[cfg.answer];
        
        // Sembunyikan sub jawaban jika nilainya sama (misal kanji dan hiragana sama karena tidak ada input kanji)
        let subText = cfg.sub ? currentQuestion[cfg.sub] : '';
        if (subText === currentQuestion[cfg.answer] || subText === currentQuestion[cfg.ask]) subText = ''; 
        answerSub.innerText = subText;
        answerSub.style.display = subText ? 'block' : 'none';

        document.getElementById('btnReveal').style.display = 'block';
        document.getElementById('nextCardControls').style.display = 'none';
        flipHint.style.display = 'flex';
    } else {
        resetTimer();
        buttons.forEach(btn => { btn.className = "option-btn"; btn.disabled = false; btn.style.display = 'flex'; });

        questionHint.innerText = cfg.hint;
        questionText.innerText = currentQuestion[cfg.ask];

        let options = [currentQuestion[cfg.answer]];
        // Menghindari error jika total kosakata di database kurang dari 4
        let attempts = 0;
        while (options.length < Math.min(4, fullData.length) && attempts < 50) {
            let randomWrong = fullData[Math.floor(Math.random() * fullData.length)][cfg.answer];
            if (!options.includes(randomWrong)) options.push(randomWrong);
            attempts++;
        }
        options = shuffleArray(options);
        
        buttons.forEach((btn, index) => {
            if (options[index] !== undefined) {
                btn.style.display = 'flex';
                btn.innerText = options[index];
                btn.onclick = () => checkAnswer(btn, options[index] === currentQuestion[cfg.answer]);
            } else {
                btn.style.display = 'none'; // Sembunyikan tombol jika database hanya berisi kurang dari 4 kata
            }
        });
        startTimer();
    }
}

/* ---------- Interaksi Kartu Balik ---------- */
document.getElementById('btnReveal').addEventListener('click', revealCard);
flashcard.addEventListener('click', () => {
    if (currentStyle !== 'flip') return;
    if (!cardRevealed) {
        revealCard();
    } else {
        flashcard.classList.toggle('is-flipped');
        playFlipSound();
    }
});

function revealCard() {
    if (currentStyle !== 'flip' || cardRevealed) return;
    cardRevealed = true;
    flashcard.classList.add('is-flipped');
    flipHint.style.display = 'none';
    playFlipSound();

    document.getElementById('btnReveal').style.display = 'none';
    document.getElementById('nextCardControls').style.display = 'flex';
}

document.getElementById('btnNextCard').addEventListener('click', nextQuestion);
document.getElementById('btnMarkLearned').addEventListener('click', () => {
    let hiddenIds = JSON.parse(localStorage.getItem('renshuu_hidden_ids')) || [];
    hiddenIds.push(currentQuestion.id);
    localStorage.setItem('renshuu_hidden_ids', JSON.stringify(hiddenIds));

    fullData = fullData.filter(item => item.id !== currentQuestion.id);
    nextQuestion();
});

/* ---------- Pilihan Ganda: Cek Jawaban & Timer ---------- */
function checkAnswer(clickedBtn, isCorrect) {
    clearInterval(timer);
    buttons.forEach(btn => btn.disabled = true);
    if (isCorrect) {
        clickedBtn.classList.add('correct');
        cardFront.style.borderColor = "var(--neon-green)";
        cardFront.style.boxShadow = "0 0 30px rgba(57,255,157,0.4), inset 0 0 30px rgba(57,255,157,0.08)";
        streak++;
        score += (10 + (streak * 2) + Math.floor(timeLeft));
        streakDisplay.classList.remove('pulse');
        void streakDisplay.offsetWidth;
        streakDisplay.classList.add('pulse');
        playCorrectSound();
    } else {
        clickedBtn.classList.add('wrong');
        cardFront.style.borderColor = "var(--neon-red)";
        cardFront.style.boxShadow = "0 0 30px rgba(255,56,96,0.4), inset 0 0 30px rgba(255,56,96,0.08)";
        streak = 0;
        buttons.forEach(btn => {
            if (btn.innerText === currentQuestion[cfg.answer]) btn.classList.add('correct');
        });
        playWrongSound();
    }
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('streakValue').textContent = streak;
    setTimeout(() => {
        cardFront.style.borderColor = "var(--neon-purple)";
        cardFront.style.boxShadow = "0 0 30px rgba(181, 56, 255, 0.28), inset 0 0 30px rgba(181, 56, 255, 0.05)";
        nextQuestion();
    }, 1500);
}

function startTimer() {
    timeLeft = 10; timerBar.style.width = '100%'; timerBar.classList.remove('warning');
    timer = setInterval(() => {
        timeLeft -= 0.1; timerBar.style.width = (timeLeft / 10) * 100 + '%';
        if (timeLeft <= 3) timerBar.classList.add('warning');
        if (timeLeft <= 0) { 
            clearInterval(timer); 
            // PERBAIKAN: Memaksa tombol opsi pertama diklik saat waktu habis tanpa error
            buttons[0].click(); 
        }
    }, 100);
}

function resetTimer() {
    clearInterval(timer); timerBar.style.transition = 'none'; timerBar.style.width = '100%';
    setTimeout(() => { timerBar.style.transition = 'width 1s linear'; }, 50);
}

document.getElementById('btnBackToMenu').addEventListener('click', () => {
    let currentTotal = parseInt(localStorage.getItem('renshuu_points')) || 0;
    localStorage.setItem('renshuu_points', currentTotal + score);
    window.location.href = 'index.html';
});

// Panggil secara eksplisit agar kuis pasti terbuka!
loadData();
