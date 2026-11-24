/* global vocabData, categoryNames */

// ========== VOCABULARY DATA ==========

// ========== SPEECH / AUDIO ==========
function speak(text) {
    if (!('speechSynthesis' in window)) {
        alert('Trình duyệt của bạn không hỗ trợ đọc âm thanh.');
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.85;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

const correctSound = new Audio("/sound/alert-mix.mp3");
const wrongSound = new Audio("/sound/huh-mix.mp3");
const turnbookSound = new Audio("/sound/turnbook.mp3");

correctSound.preload = "auto";
wrongSound.preload = "auto";
turnbookSound.preload = "auto";

function getJapanesePart(example) {
    return example.split(' - ')[0].trim();
}

function speakVocab(id, type, event) {
    event.stopPropagation();
    const word = vocabData.find(v => v.id === id);
    if (!word) return;
    speak(type === 'word' ? word.kanji : getJapanesePart(word.example));
}

function speakCurrentFlashcard(type, event) {
    event.stopPropagation();
    if (flashcardList.length === 0) return;
    const card = flashcardList[flashcardIndex];
    speak(type === 'word' ? card.kanji : getJapanesePart(card.example));
}

function speakCurrentQuestion() {
    if (!quizQuestions.length || quizCurrentIndex >= quizQuestions.length) return;
    speak(quizQuestions[quizCurrentIndex].word.kanji);
}

// ========== APP STATE ==========
let currentSection = 'learn';
let currentCategory = 'all';
let filteredVocab = [...vocabData];
let knownWordsSet = new Set(JSON.parse(localStorage.getItem('knownWords') || '[]'));
let quizHighScore = parseInt(localStorage.getItem('quizHighScore') || '0');

// Flashcard state
let flashcardIndex = 0;
let flashcardList = [...vocabData];

// Quiz state
let quizQuestions = [];
let quizCurrentIndex = 0;
let quizCorrect = 0;
let quizAnswered = false;
let quizResults = [];
let quizMode = 'lesson';
let quizLesson = '1';

// Speed Match state
let speedMatchTimerId = null;
let speedMatchTimeLeft = 90;
let speedMatchMode = 'lesson';
let speedMatchLesson = '1';
let speedMatchActivePool = [];
let speedMatchRemainingPool = [];
let speedMatchLeftItems = [];
let speedMatchRightItems = [];
let speedMatchSelectedLeftId = null;
let speedMatchScore = 0;
let speedMatchIsPlaying = false;
let speedMatchTotalTime = 90;
let speedMatchBestRecords = JSON.parse(localStorage.getItem('speedMatchBestRecords') || '{}');

// Conversation state
let conversationRecognition = null;
let conversationActive = false;
let conversationIsRecognizing = false;
let conversationIsProcessing = false;
let conversationIsSpeaking = false;
let conversationManualPause = false;
let conversationApiUnavailable = false;
let conversationRestartTimer = null;
let conversationMessages = [];

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initCategoryFilter();
    initSearch();
    initHeaderScrollBehavior();
    initQuizMode();
    initSpeedMatch();
    initConversation();
    renderVocabGrid();
    updateFlashcard();
    updateProgress();
});

// ========== NAVIGATION ==========
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

function switchSection(section) {
    if (currentSection === 'conversation' && section !== 'conversation' && conversationActive) {
        endConversation(true);
    }
    currentSection = section;
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.nav-btn[data-section="${section}"]`).classList.add('active');
    
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section).classList.add('active');

    if (section === 'flashcard') {
        flashcardList = getFilteredVocab();
        flashcardIndex = 0;
        updateFlashcard();
    }
    if (section === 'progress') {
        updateProgress();
    }
    if (section === 'speedmatch') {
        initSpeedMatch();
    }
    if (section === 'conversation' && !conversationActive) {
        document.getElementById('conversationSetup').hidden = false;
        document.getElementById('conversationRoom').hidden = true;
    }
}

function initHeaderScrollBehavior() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        const currentY = window.scrollY;

        if (currentY <= 20) {
            header.classList.remove('header-hidden');
        } else if (currentY > lastScrollY) {
            header.classList.add('header-hidden');
        } else {
            header.classList.remove('header-hidden');
        }

        lastScrollY = currentY;
    }, { passive: true });
}

// ========== CATEGORY FILTER ==========
function initCategoryFilter() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.category;
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderVocabGrid();
            
            if (currentSection === 'flashcard') {
                flashcardList = getFilteredVocab();
                flashcardIndex = 0;
                updateFlashcard();
            }
        });
    });
}

function getFilteredVocab() {
    let list = currentCategory === 'all' 
        ? [...vocabData] 
        : vocabData.filter(v => v.category === currentCategory);
    return list;
}

// ========== SEARCH ==========
function initSearch() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderVocabGrid(e.target.value);
    });
}

// ========== VOCAB GRID ==========
function renderVocabGrid(searchTerm = '') {
    const grid = document.getElementById('vocabGrid');
    let vocab = getFilteredVocab();

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        vocab = vocab.filter(v =>
            v.kanji.toLowerCase().includes(term) ||
            v.reading.toLowerCase().includes(term) ||
            v.meaning.toLowerCase().includes(term)
        );
    }

    if (vocab.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <div class="empty-icon">🔍</div>
                <p>Không tìm thấy từ vựng nào</p>
            </div>`;
        return;
    }

    grid.innerHTML = vocab.map(v => `
        <div class="vocab-card ${knownWordsSet.has(v.id) ? 'known' : ''}" onclick="toggleKnown(${v.id})">
            <span class="vocab-category-tag">${categoryNames[v.category]}</span>
            <div class="vocab-kanji">${v.kanji}</div>
            <div class="vocab-reading">${v.reading}</div>
            <div class="vocab-meaning">${v.meaning}</div>
            <div class="vocab-example">${v.example}</div>
            <div class="vocab-audio-btns">
                <button class="speak-btn" onclick="speakVocab(${v.id}, 'word', event)">🔊 Từ</button>
                <button class="speak-btn" onclick="speakVocab(${v.id}, 'example', event)">🔊 Câu ví dụ</button>
            </div>
            ${knownWordsSet.has(v.id) ? '<span class="vocab-known-badge">✅</span>' : ''}
        </div>
    `).join('');
}

function toggleKnown(id) {
    if (knownWordsSet.has(id)) {
        knownWordsSet.delete(id);
    } else {
        knownWordsSet.add(id);
    }
    saveProgress();
    renderVocabGrid(document.getElementById('searchInput').value);
}

// ========== FLASHCARD ==========
function updateFlashcard() {
    if (flashcardList.length === 0) return;

    const card = flashcardList[flashcardIndex];
    document.getElementById('fcKanji').textContent = card.kanji;
    document.getElementById('fcReading').textContent = card.reading;
    document.getElementById('fcMeaning').textContent = card.meaning;
    document.getElementById('fcExample').textContent = card.example;
    document.getElementById('fcFurigana').textContent = card.furigana || '';
    document.getElementById('flashcardCurrent').textContent = flashcardIndex + 1;
    document.getElementById('flashcardTotal').textContent = flashcardList.length;

    // Reset flip
    document.getElementById('flashcardInner').classList.remove('flipped');
}

function flipCard() {
    document.getElementById('flashcardInner').classList.toggle('flipped');
}

function nextCard() {
    if (flashcardList.length === 0) return;
    flashcardIndex = (flashcardIndex + 1) % flashcardList.length;
    updateFlashcard();
}

function prevCard() {
    if (flashcardList.length === 0) return;
    flashcardIndex = (flashcardIndex - 1 + flashcardList.length) % flashcardList.length;
    updateFlashcard();
}

function shuffleCards() {
    flashcardList = [...flashcardList].sort(() => Math.random() - 0.5);
    flashcardIndex = 0;
    updateFlashcard();
}

function markKnown() {
    if (flashcardList.length === 0) return;
    const card = flashcardList[flashcardIndex];
    knownWordsSet.add(card.id);
    saveProgress();

    // Visual feedback
    const fcEl = document.getElementById('flashcard');
    fcEl.style.transform = 'scale(0.95)';
    fcEl.style.opacity = '0.7';
    setTimeout(() => {
        fcEl.style.transform = '';
        fcEl.style.opacity = '';
        nextCard();
    }, 300);
}

// Keyboard support for flashcards
document.addEventListener('keydown', (e) => {
    if (currentSection !== 'flashcard') return;
    switch(e.key) {
        case 'ArrowRight': nextCard(); break;
        case 'ArrowLeft': prevCard(); break;
        case ' ':
        case 'Enter': flipCard(); e.preventDefault(); break;
    }
});

// ========== QUIZ ==========
function startQuiz() {
    const countSelect = document.getElementById('quizCount').value;
    const type = document.getElementById('quizType').value;
    const mode = document.getElementById('quizMode').value;
    const lesson = document.getElementById('quizLesson').value;

    let pool = mode === 'all'
        ? [...vocabData]
        : vocabData.filter(v => v.category === lesson);

    if (pool.length < 4) {
        alert('Cần ít nhất 4 từ vựng để làm quiz!');
        return;
    }

    // Shuffle
    pool = pool.sort(() => Math.random() - 0.5);
    
    const count = countSelect === 'all' ? pool.length : Math.min(parseInt(countSelect), pool.length);
    quizQuestions = pool.slice(0, count).map(word => createQuestion(word, pool, type));
    quizCurrentIndex = 0;
    quizCorrect = 0;
    quizResults = [];
    quizAnswered = false;
    quizMode = mode;
    quizLesson = lesson;

    document.getElementById('quizStart').style.display = 'none';
    document.getElementById('quizActive').style.display = 'block';
    document.getElementById('quizResult').style.display = 'none';
    document.getElementById('quizTotal').textContent = quizQuestions.length;
    document.getElementById('quizScore').textContent = '0';

    renderQuestion();
}

function initQuizMode() {
    const modeSelect = document.getElementById('quizMode');
    const lessonSelect = document.getElementById('quizLesson');
    const lessonWrap = document.getElementById('quizLessonWrap');

    if (!modeSelect || !lessonSelect || !lessonWrap) return;

    if (!lessonSelect.options.length) {
        const lessons = [...new Set(vocabData.map(v => v.category))].sort((a, b) => Number(a) - Number(b));
        lessonSelect.innerHTML = lessons.map(lesson => {
            const label = categoryNames[lesson] || `Bài ${lesson}`;
            return `<option value="${lesson}">${label}</option>`;
        }).join('');
        if (lessons.length > 0) lessonSelect.value = lessons[0];
    }

    if (!modeSelect.dataset.bound) {
        modeSelect.addEventListener('change', () => {
            lessonWrap.style.display = modeSelect.value === 'lesson' ? 'flex' : 'none';
        });
        modeSelect.dataset.bound = 'true';
    }

    lessonWrap.style.display = modeSelect.value === 'lesson' ? 'flex' : 'none';
}

// Trích phần okurigana (hiragana lộ ra sau chữ Hán, vd: 食べる → べる, 大きい → きい)
function getOkurigana(kanjiStr) {
    const match = kanjiStr.match(/[\u3040-\u309F]+$/);
    return match ? match[0] : '';
}

// Đo số ký tự giống nhau ở cuối 2 chuỗi (vd: "たべる" vs "みる" → 1 "る")
function commonSuffixLength(a, b) {
    let i = a.length - 1, j = b.length - 1, len = 0;
    while (i >= 0 && j >= 0 && a[i] === b[j]) {
        len++; i--; j--;
    }
    return len;
}

function getSimilarWrongAnswers(word, pool, type, count = 3) {
    const others = pool.filter(w => w.id !== word.id);
    const wordOkuri = getOkurigana(word.kanji); // vd: "べる", "きい", ""

    const scored = others.map(w => {
        let score = 0;
        const wOkuri = getOkurigana(w.kanji);

        // Ưu tiên cao nhất: cùng category → nghĩa gần giống, dễ nhầm nhất
        if (w.category === word.category) score += 20;

        if (type === 'reading') {
            if (w.reading[0] === word.reading[0]) score += 10;
            if (w.reading.length === word.reading.length) score += 6;
            if (Math.abs(w.reading.length - word.reading.length) === 1) score += 3;
            const overlap = [...word.reading].filter(c => w.reading.includes(c)).length;
            score += overlap * 2;

            // Động từ / Tính từ: ưu tiên cùng okurigana (phần hiragana lộ sau kanji)
            // Vd: 食べる(べる) vs 寝る(る) → đuôi "る" chung → dễ nhầm khi đọc
            if (wordOkuri) {
                if (wOkuri === wordOkuri) {
                    score += 18; // Cùng okurigana hoàn toàn → rất dễ nhầm
                } else {
                    score += commonSuffixLength(wordOkuri, wOkuri) * 6; // Đuôi okurigana giống 1 phần
                }
                score += commonSuffixLength(word.reading, w.reading) * 5; // Đuôi reading giống
            }
        } else if (type === 'japanese') {
            if (w.reading[0] === word.reading[0]) score += 6;
            if (w.kanji.length === word.kanji.length) score += 4;

            // Động từ / Tính từ: cùng okurigana → chữ Hán trông rất giống nhau
            // Vd: 食べる vs 寝る đều có "る" lộ ra → người học dễ nhầm dạng
            if (wordOkuri) {
                if (wOkuri === wordOkuri) {
                    score += 18;
                } else {
                    score += commonSuffixLength(wordOkuri, wOkuri) * 6;
                }
            }
        }
        // type === 'meaning': cùng category là đủ (đáp án là tiếng Việt, không có okurigana)

        score += Math.random() * 4;
        return { w, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, count).map(s => s.w);
}

function createQuestion(word, pool, type) {
    // Get 3 similar (hard to distinguish) wrong answers
    const wrongAnswers = getSimilarWrongAnswers(word, pool, type);

    let question, correctAnswer, answers;

    switch(type) {
        case 'meaning':
            question = `${word.kanji}（${word.reading}）`;
            correctAnswer = word.meaning;
            answers = [word.meaning, ...wrongAnswers.map(w => w.meaning)];
            break;
        case 'japanese':
            question = word.meaning;
            correctAnswer = `${word.kanji}（${word.reading}）`;
            answers = [
                `${word.kanji}（${word.reading}）`,
                ...wrongAnswers.map(w => `${w.kanji}（${w.reading}）`)
            ];
            break;
        case 'reading':
            question = word.kanji;
            correctAnswer = word.reading;
            answers = [word.reading, ...wrongAnswers.map(w => w.reading)];
            break;
    }

    // Shuffle answers
    answers = answers.sort(() => Math.random() - 0.5);

    return { word, question, correctAnswer, answers, type };
}

function renderQuestion() {
    const q = quizQuestions[quizCurrentIndex];
    const progress = ((quizCurrentIndex) / quizQuestions.length) * 100;

    document.getElementById('quizProgressFill').style.width = progress + '%';
    document.getElementById('questionText').textContent = q.question;
    document.getElementById('quizFeedback').style.display = 'none';
    document.querySelector('.next-question-btn').textContent = 'Câu tiếp →';
    quizAnswered = false;

    const answersContainer = document.getElementById('quizAnswers');
    answersContainer.innerHTML = q.answers.map((ans, i) => `
        <button class="quiz-answer-btn" onclick="selectAnswer(${i})">${ans}</button>
    `).join('');
}

function selectAnswer(index) {
    if (quizAnswered) return;
    quizAnswered = true;

    const q = quizQuestions[quizCurrentIndex];
    const selectedAnswer = q.answers[index];
    const isCorrect = selectedAnswer === q.correctAnswer;

    if (isCorrect) {
        quizCorrect++;
    }

    quizResults.push({
        word: q.word,
        correct: isCorrect,
        selected: selectedAnswer,
        correctAnswer: q.correctAnswer
    });

    document.getElementById('quizScore').textContent = quizCorrect;

    // Highlight buttons
    const buttons = document.querySelectorAll('.quiz-answer-btn');
    buttons.forEach((btn, i) => {
        btn.classList.add('disabled');
        if (q.answers[i] === q.correctAnswer) {
           
            btn.classList.add('correct');
        }
        if (i === index && !isCorrect) {
            
            btn.classList.add('wrong');
        }
    });

    // Show feedback
    const feedback = document.getElementById('quizFeedback');
    const feedbackText = document.getElementById('feedbackText');
    feedback.style.display = 'block';

    if (isCorrect) {
         correctSound.currentTime = 0;
            correctSound.play();
        feedbackText.innerHTML = `✅ Chính xác! <strong>${q.word.kanji}</strong> = ${q.word.meaning}`;
    } else {
        wrongSound.currentTime = 0;
            wrongSound.play();
        feedbackText.innerHTML = `❌ Sai rồi! Đáp án đúng: <strong>${q.correctAnswer}</strong>`;
    }

    // Auto next if last question
    if (quizCurrentIndex >= quizQuestions.length - 1) {
        document.querySelector('.next-question-btn').textContent = 'Xem kết quả 🎯';
    }
}

function nextQuestion() {
    quizCurrentIndex++;
    if (quizCurrentIndex >= quizQuestions.length) {
        showQuizResult();
    } else {
        renderQuestion();
    }
}

function showQuizResult() {
    document.getElementById('quizActive').style.display = 'none';
    document.getElementById('quizResult').style.display = 'block';

    const total = quizQuestions.length;
    const percentage = Math.round((quizCorrect / total) * 100);

    document.getElementById('resultScore').textContent = `${quizCorrect}/${total}`;
    document.getElementById('resultPercentage').textContent = `${percentage}%`;
    document.getElementById('resultPercentage').style.color = 
        percentage >= 80 ? 'var(--success)' : 
        percentage >= 50 ? 'var(--accent)' : 'var(--danger)';

    let message = '';
    if (percentage === 100) message = '🎉 Hoàn hảo! Bạn giỏi lắm!';
    else if (percentage >= 80) message = '👏 Xuất sắc! Tiếp tục phát huy!';
    else if (percentage >= 60) message = '💪 Khá tốt! Hãy ôn thêm nhé!';
    else if (percentage >= 40) message = '📖 Cần luyện tập thêm!';
    else message = '🌱 Đừng nản, hãy học lại từ đầu!';
    document.getElementById('resultMessage').textContent = message;

    // Show details
    const details = document.getElementById('resultDetails');
    details.innerHTML = quizResults.map(r => `
        <div class="result-detail-item ${r.correct ? 'correct-item' : 'wrong-item'}">
            <span>${r.correct ? '✅' : '❌'}</span>
            <span><strong>${r.word.kanji}</strong>（${r.word.reading}）= ${r.word.meaning}</span>
        </div>
    `).join('');

    // Update high score
    if (percentage > quizHighScore) {
        quizHighScore = percentage;
        localStorage.setItem('quizHighScore', quizHighScore.toString());
    }
}

function resetQuiz() {
    document.getElementById('quizStart').style.display = 'block';
    document.getElementById('quizActive').style.display = 'none';
    document.getElementById('quizResult').style.display = 'none';
}

// ========== SPEED MATCH ==========
function initSpeedMatch() {
    initSpeedMatchLessonOptions();
    const modeSelect = document.getElementById('speedMatchMode');
    const lessonSelect = document.getElementById('speedMatchLesson');
    const lessonWrap = document.getElementById('speedMatchLessonWrap');

    if (!modeSelect || !lessonSelect || !lessonWrap) return;

    if (!modeSelect.dataset.bound) {
        modeSelect.addEventListener('change', () => {
            lessonWrap.style.display = modeSelect.value === 'lesson' ? 'flex' : 'none';
            updateSpeedMatchBestLabel();
        });
        lessonSelect.addEventListener('change', updateSpeedMatchBestLabel);
        modeSelect.dataset.bound = 'true';
    }

    lessonWrap.style.display = modeSelect.value === 'lesson' ? 'flex' : 'none';
    updateSpeedMatchBestLabel();
}

function initSpeedMatchLessonOptions() {
    const lessonSelect = document.getElementById('speedMatchLesson');
    if (!lessonSelect || lessonSelect.options.length > 0) return;

    const lessons = [...new Set(vocabData.map(v => v.category))].sort((a, b) => Number(a) - Number(b));
    lessonSelect.innerHTML = lessons.map(lesson => {
        const label = categoryNames[lesson] || `Bài ${lesson}`;
        return `<option value="${lesson}">${label}</option>`;
    }).join('');

    if (lessons.length > 0) {
        lessonSelect.value = lessons[0];
    }
}

function getSpeedMatchPool(mode, lesson) {
    if (mode === 'all') return [...vocabData];
    return vocabData.filter(v => v.category === lesson);
}

function getSpeedMatchRecordKey(mode, lesson) {
    return mode === 'all' ? 'all' : `lesson_${lesson}`;
}

function loadSpeedMatchRecord(mode, lesson) {
    const key = getSpeedMatchRecordKey(mode, lesson);
    return speedMatchBestRecords[key] || { bestScore: 0, bestTime: null };
}

function saveSpeedMatchRecord(mode, lesson, record) {
    const key = getSpeedMatchRecordKey(mode, lesson);
    speedMatchBestRecords[key] = record;
    localStorage.setItem('speedMatchBestRecords', JSON.stringify(speedMatchBestRecords));
}

function updateSpeedMatchBestLabel() {
    const mode = document.getElementById('speedMatchMode')?.value || 'lesson';
    const lesson = document.getElementById('speedMatchLesson')?.value || '1';
    const record = loadSpeedMatchRecord(mode, lesson);
    const label = record.bestTime != null
        ? `${record.bestScore} cặp / ${record.bestTime}s`
        : `${record.bestScore} cặp`;
    const bestEl = document.getElementById('speedMatchBest');
    if (bestEl) bestEl.textContent = label;
}

function startSpeedMatch() {
    const mode = document.getElementById('speedMatchMode').value;
    const lesson = document.getElementById('speedMatchLesson').value;
    const pool = getSpeedMatchPool(mode, lesson);

    if (pool.length < 1) {
        alert('Không có từ vựng cho chế độ này!');
        return;
    }

    speedMatchMode = mode;
    speedMatchLesson = lesson;
    speedMatchTotalTime = mode === 'all' ? 300 : 90;
    speedMatchTimeLeft = speedMatchTotalTime;
    speedMatchScore = 0;
    speedMatchSelectedLeftId = null;
    speedMatchIsPlaying = true;
    speedMatchActivePool = [...shuffleArray(pool)];
    const boardSize = Math.min(5, speedMatchActivePool.length);
    speedMatchLeftItems = speedMatchActivePool.slice(0, boardSize);
    speedMatchRemainingPool = speedMatchActivePool.slice(boardSize);

    document.getElementById('speedMatchStart').style.display = 'none';
    document.getElementById('speedMatchActive').style.display = 'block';
    document.getElementById('speedMatchResult').style.display = 'none';

    renderSpeedMatchBoard();
    updateSpeedMatchUI();

    clearInterval(speedMatchTimerId);
    speedMatchTimerId = setInterval(() => {
        speedMatchTimeLeft--;
        updateSpeedMatchUI();
        if (speedMatchTimeLeft <= 0) {
            endSpeedMatch();
        }
    }, 1000);
}

function shuffleArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function renderSpeedMatchBoard() {
    if (!speedMatchIsPlaying) return;

    speedMatchLeftItems = shuffleArray(speedMatchLeftItems);
    speedMatchRightItems = shuffleArray(speedMatchLeftItems.map(v => ({ id: v.id, meaning: v.meaning })));

    const leftList = document.getElementById('speedMatchLeftList');
    const rightList = document.getElementById('speedMatchRightList');

    leftList.innerHTML = speedMatchLeftItems.map(v => `
        <button data-id="${v.id}" class="speedmatch-item left-item ${speedMatchSelectedLeftId === v.id ? 'selected' : ''}" onclick="selectSpeedMatchLeft(${v.id})">
            <span class="speedmatch-word">${v.kanji}</span>
            <span class="speedmatch-reading">${v.reading}</span>
        </button>
    `).join('');

    rightList.innerHTML = speedMatchRightItems.map(v => `
        <button class="speedmatch-item right-item" onclick="selectSpeedMatchRight(${v.id})">
            <span class="speedmatch-meaning">${v.meaning}</span>
        </button>
    `).join('');
}

function selectSpeedMatchLeft(id) {
    if (!speedMatchIsPlaying) return;
    speedMatchSelectedLeftId = id;
    document.querySelectorAll('.speedmatch-item.left-item').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.dataset.id) === id);
    });
}

function selectSpeedMatchRight(id) {
    if (!speedMatchIsPlaying || speedMatchSelectedLeftId == null) return;

    const leftWord = speedMatchLeftItems.find(v => v.id === speedMatchSelectedLeftId);
    const rightWord = speedMatchLeftItems.find(v => v.id === id);

    if (!leftWord || !rightWord) return;

    const isCorrect = leftWord.id === rightWord.id;

    const feedback = document.getElementById('speedMatchFeedback');
    const feedbackText = document.getElementById('speedMatchFeedbackText');
    feedback.style.display = 'block';

    if (isCorrect) {
        speedMatchScore++;
        correctSound.currentTime = 0;
        correctSound.play();
        feedbackText.textContent = `✅ Đúng: ${leftWord.kanji} = ${rightWord.meaning}`;

        speedMatchLeftItems = speedMatchLeftItems.filter(v => v.id !== leftWord.id);
        if (speedMatchRemainingPool.length > 0) {
            speedMatchLeftItems.push(speedMatchRemainingPool.shift());
        }

        if (speedMatchLeftItems.length === 0) {
            updateSpeedMatchUI();
            endSpeedMatch();
            return;
        }

        speedMatchSelectedLeftId = null;
        renderSpeedMatchBoard();
        updateSpeedMatchUI();
    } else {
        wrongSound.currentTime = 0;
        wrongSound.play();
        feedbackText.textContent = `❌ Sai rồi, hãy chọn lại ý nghĩa của ${leftWord.kanji}`;
        speedMatchSelectedLeftId = leftWord.id;
    }

    setTimeout(() => {
        if (feedback) feedback.style.display = 'none';
    }, 900);
}

function updateSpeedMatchUI() {
    const timeEl = document.getElementById('speedMatchTime');
    const scoreEl = document.getElementById('speedMatchScore');
    const bestEl = document.getElementById('speedMatchBest');
    if (timeEl) timeEl.textContent = speedMatchTimeLeft;
    if (scoreEl) scoreEl.textContent = speedMatchScore;

    const record = loadSpeedMatchRecord(speedMatchMode, speedMatchLesson);
    const bestLabel = record.bestTime != null ? `${record.bestScore} cặp / ${record.bestTime}s` : `${record.bestScore} cặp`;
    if (bestEl) bestEl.textContent = bestLabel;
}

function endSpeedMatch(forceEnd = false) {
    if (!speedMatchIsPlaying && !forceEnd) return;
    clearInterval(speedMatchTimerId);
    speedMatchTimerId = null;
    speedMatchIsPlaying = false;

    const elapsed = speedMatchTotalTime - speedMatchTimeLeft;
    const totalPool = getSpeedMatchPool(speedMatchMode, speedMatchLesson).length;
    const completed = speedMatchScore === totalPool;

    const currentRecord = loadSpeedMatchRecord(speedMatchMode, speedMatchLesson);
    const nextRecord = { ...currentRecord };

    if (speedMatchScore > nextRecord.bestScore) {
        nextRecord.bestScore = speedMatchScore;
    }
    if (completed) {
        if (nextRecord.bestTime == null || elapsed < nextRecord.bestTime) {
            nextRecord.bestTime = elapsed;
        }
    }
    saveSpeedMatchRecord(speedMatchMode, speedMatchLesson, nextRecord);
    updateSpeedMatchUI();

    document.getElementById('speedMatchActive').style.display = 'none';
    document.getElementById('speedMatchResult').style.display = 'block';
    document.getElementById('speedMatchResultScore').textContent = `${speedMatchScore}/${totalPool}`;
    document.getElementById('speedMatchResultTime').textContent = completed
        ? `Hoàn thành trong ${elapsed}s`
        : `Hết giờ sau ${elapsed}s`;
    document.getElementById('speedMatchResultMessage').textContent = completed
        ? '🎉 Hoàn thành toàn bộ trong thời gian giới hạn!'
        : '⏳ Hết giờ, chơi lại để phá kỷ lục nhé!';

    if (completed && speedMatchTimeLeft > 0) {
        correctSound.currentTime = 0;
        correctSound.play();
    }
}

function resetSpeedMatch() {
    clearInterval(speedMatchTimerId);
    speedMatchTimerId = null;
    speedMatchIsPlaying = false;
    speedMatchSelectedLeftId = null;
    speedMatchLeftItems = [];
    speedMatchRightItems = [];
    speedMatchRemainingPool = [];
    speedMatchScore = 0;
    speedMatchTotalTime = 90;
    speedMatchTimeLeft = 90;
    document.getElementById('speedMatchStart').style.display = 'block';
    document.getElementById('speedMatchActive').style.display = 'none';
    document.getElementById('speedMatchResult').style.display = 'none';
    document.getElementById('speedMatchFeedback').style.display = 'none';
    initSpeedMatch();
}

// ========== PROGRESS ==========
function updateProgress() {
    const total = vocabData.length;
    const known = knownWordsSet.size;
    const learning = total - known;
    const percentage = total > 0 ? Math.round((known / total) * 100) : 0;

    document.getElementById('totalWords').textContent = total;
    document.getElementById('knownWords').textContent = known;
    document.getElementById('learningWords').textContent = learning;
    document.getElementById('quizHighScore').textContent = quizHighScore + '%';
    document.getElementById('overallProgress').style.width = percentage + '%';
    document.getElementById('progressText').textContent = percentage + '%';

    // Known words list
    const knownList = document.getElementById('knownWordsList');
    const knownVocab = vocabData.filter(v => knownWordsSet.has(v.id));
    
    if (knownVocab.length === 0) {
        knownList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem;">Chưa có từ nào được đánh dấu đã thuộc. Nhấn vào thẻ từ vựng để đánh dấu!</p>';
    } else {
        knownList.innerHTML = knownVocab.map(v => `
            <span class="known-tag">${v.kanji} - ${v.meaning}</span>
        `).join('');
    }
}

function saveProgress() {
    localStorage.setItem('knownWords', JSON.stringify([...knownWordsSet]));
    updateProgress();
}

function resetProgress() {
    if (confirm('Bạn có chắc muốn đặt lại toàn bộ tiến độ?')) {
        knownWordsSet.clear();
        quizHighScore = 0;
        localStorage.removeItem('knownWords');
        localStorage.removeItem('quizHighScore');
        saveProgress();
        renderVocabGrid();
        alert('Đã đặt lại tiến độ!');
    }
}

// ========== VOICE CONVERSATION ==========
function initConversation() {
    const topicSelect = document.getElementById('conversationTopic');
    const customTopicWrap = document.getElementById('conversationCustomTopicWrap');
    const startButton = document.getElementById('conversationStartBtn');
    const micButton = document.getElementById('conversationMicBtn');
    const endButton = document.getElementById('conversationEndBtn');
    const stopSpeakingButton = document.getElementById('conversationStopSpeakingBtn');

    topicSelect.addEventListener('change', () => {
        customTopicWrap.hidden = topicSelect.value !== '自由なテーマ';
    });
    startButton.addEventListener('click', startConversation);
    micButton.addEventListener('click', toggleConversationListening);
    endButton.addEventListener('click', () => endConversation(true));
    stopSpeakingButton.addEventListener('click', stopConversationSpeech);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        document.getElementById('conversationSetupNote').textContent =
            'Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Hãy thử Chrome hoặc Edge trên HTTPS/localhost.';
        startButton.disabled = true;
        startButton.title = 'Trình duyệt chưa hỗ trợ Web Speech API';
        return;
    }

    conversationRecognition = new SpeechRecognition();
    conversationRecognition.lang = 'ja-JP';
    conversationRecognition.continuous = false;
    conversationRecognition.interimResults = true;
    conversationRecognition.maxAlternatives = 1;

    conversationRecognition.onstart = () => {
        conversationIsRecognizing = true;
        updateConversationMicButton();
        setConversationStatus('Đang nghe bạn nói tiếng Nhật…', 'listening');
    };

    conversationRecognition.onresult = event => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let index = event.resultIndex; index < event.results.length; index++) {
            const text = event.results[index][0].transcript;
            if (event.results[index].isFinal) finalTranscript += text;
            else interimTranscript += text;
        }

        const liveTranscript = document.getElementById('conversationLiveTranscript');
        liveTranscript.textContent = interimTranscript ? `🎧 ${interimTranscript}` : '';
        liveTranscript.hidden = !interimTranscript;

        if (finalTranscript.trim()) {
            void respondToConversation(finalTranscript.trim());
        }
    };

    conversationRecognition.onerror = event => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            conversationManualPause = true;
            setConversationStatus('Chưa được cấp quyền micro. Hãy cho phép micro trong cài đặt trình duyệt.', 'error');
            return;
        }
        if (event.error === 'audio-capture') {
            conversationManualPause = true;
            setConversationStatus('Không tìm thấy micro. Hãy kiểm tra thiết bị âm thanh.', 'error');
            return;
        }
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setConversationStatus('Micro gặp sự cố. Hãy thử bấm nút micro để nghe lại.', 'error');
        }
    };

    conversationRecognition.onend = () => {
        conversationIsRecognizing = false;
        updateConversationMicButton();
        if (!conversationActive || conversationIsProcessing || conversationIsSpeaking) return;

        if (document.getElementById('conversationAutoListen').checked && !conversationManualPause) {
            clearTimeout(conversationRestartTimer);
            conversationRestartTimer = setTimeout(startConversationListening, 450);
        } else if (!conversationManualPause) {
            setConversationStatus('Đến lượt bạn. Bấm micro để nói.', '');
        }
    };
}

function startConversation() {
    const selectedTopic = document.getElementById('conversationTopic').value;
    const customTopic = document.getElementById('conversationCustomTopic').value.trim();
    const topic = selectedTopic === '自由なテーマ' ? (customTopic || 'あなたの好きなこと') : selectedTopic;

    conversationActive = true;
    conversationIsProcessing = false;
    conversationIsSpeaking = false;
    conversationManualPause = false;
    conversationApiUnavailable = false;
    conversationMessages = [];

    document.getElementById('conversationSetup').hidden = true;
    document.getElementById('conversationRoom').hidden = false;
    document.getElementById('conversationRoomTopic').textContent = topic;
    document.getElementById('conversationMessages').replaceChildren();
    document.getElementById('conversationLiveTranscript').hidden = true;
    document.getElementById('conversationModeNote').hidden = true;
    document.getElementById('conversationStopSpeakingBtn').hidden = true;
    updateConversationMicButton();

    const greeting = getConversationGreeting(topic);
    addConversationMessage('assistant', greeting);
    speakConversationText(greeting);
}

function getConversationGreeting(topic) {
    const greetingByTopic = {
        'カフェで注文する': 'いらっしゃいませ。ご注文はお決まりですか？',
        '旅行と観光': '日本旅行について話しましょう。日本で行ってみたい場所はありますか？',
        '趣味と休日': 'こんにちは！休日はいつも何をして過ごしますか？',
        '日本の食べ物': '日本の食べ物について話しましょう。好きな日本料理は何ですか？',
        '買い物': 'こんにちは！今日は何を買いに来ましたか？'
    };
    return greetingByTopic[topic] || `こんにちは！「${topic}」について話しましょう。まず、どんなことが好きですか？`;
}

function toggleConversationListening() {
    if (!conversationActive || !conversationRecognition) return;
    if (conversationIsRecognizing) {
        conversationManualPause = true;
        conversationRecognition.stop();
        setConversationStatus('聞き取りを一時停止しました。再開するにはマイクを押してください。', '');
        updateConversationMicButton();
        return;
    }

    conversationManualPause = false;
    startConversationListening();
}

function startConversationListening() {
    if (!conversationActive || !conversationRecognition || conversationIsRecognizing ||
        conversationIsProcessing || conversationIsSpeaking || conversationManualPause) return;
    try {
        conversationRecognition.start();
    } catch (error) {
        if (error.name !== 'InvalidStateError') {
            setConversationStatus('Không thể bật micro. Hãy thử lại sau.', 'error');
        }
    }
}

async function respondToConversation(userText) {
    if (conversationIsProcessing) return;
    conversationIsProcessing = true;
    document.getElementById('conversationLiveTranscript').hidden = true;
    addConversationMessage('user', userText);
    setConversationStatus('Đang nghĩ câu trả lời…', 'thinking');

    let reply;
    if (!conversationApiUnavailable) {
        try {
            const response = await fetch('/api/conversation/reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: document.getElementById('conversationRoomTopic').textContent,
                    history: conversationMessages.slice(-12)
                })
            });
            if (!response.ok) throw new Error(`Conversation API returned ${response.status}`);
            const result = await response.json();
            if (!result.reply || typeof result.reply !== 'string') throw new Error('Empty conversation reply');
            reply = result.reply.trim();
        } catch (error) {
            conversationApiUnavailable = true;
            const modeNote = document.getElementById('conversationModeNote');
            modeNote.textContent = 'Đang dùng phản hồi cơ bản. Hãy cấu hình OPENAI_API_KEY và chạy ứng dụng qua máy chủ để trò chuyện AI tự nhiên hơn.';
            modeNote.hidden = false;
        }
    }

    if (!reply) reply = createLocalConversationReply(userText, document.getElementById('conversationRoomTopic').textContent);
    addConversationMessage('assistant', reply);
    conversationIsProcessing = false;
    speakConversationText(reply);
}

function createLocalConversationReply(userText, topic) {
    const text = userText.toLowerCase();
    if (/こんにちは|こんばんは|おはよう|はじめまして/.test(text)) {
        return 'こんにちは！お話しできてうれしいです。今日はどんな一日でしたか？';
    }
    if (/ありがとう|ありがと/.test(text)) {
        return 'どういたしまして！こちらこそ、話してくれてありがとうございます。ほかにはどんなことが好きですか？';
    }
    if (/わかりません|分かりません|もう一度|ゆっくり/.test(text)) {
        return 'もちろんです。ゆっくり話しますね。焦らなくて大丈夫ですよ。';
    }
    if (/はい|そうです|好きです|いいです/.test(text)) {
        return 'そうなんですね！いいですね。いつから好きなんですか？';
    }
    if (/いいえ|ありません|好きじゃない/.test(text)) {
        return 'そうなんですね。教えてくれてありがとうございます。では、最近興味があることはありますか？';
    }
    if (/\?|？|ですか|ますか|何|どこ|いつ|どうして/.test(text)) {
        return `いい質問ですね！${topic}については、あなたはどう思いますか？`;
    }

    const followUps = [
        'そうなんですね！もう少し聞かせてください。',
        'いいですね！それについて、どんなところが一番好きですか？',
        'なるほど。最近、そのことで何か楽しいことがありましたか？',
        `面白いですね！${topic}について、ほかにも話したいことはありますか？`
    ];
    return followUps[Math.floor(Math.random() * followUps.length)];
}

function addConversationMessage(role, text) {
    conversationMessages.push({ role, content: text });
    const message = document.createElement('div');
    message.className = `conversation-message ${role === 'user' ? 'conversation-message-user' : 'conversation-message-assistant'}`;

    const speaker = document.createElement('span');
    speaker.className = 'conversation-message-speaker';
    speaker.textContent = role === 'user' ? 'あなた' : '日本語パートナー';
    const content = document.createElement('p');
    content.className = 'conversation-message-text';
    content.lang = 'ja';
    content.textContent = text;
    message.append(speaker, content);
    document.getElementById('conversationMessages').append(message);
    message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function speakConversationText(text) {
    if (!conversationActive || !('speechSynthesis' in window)) {
        conversationIsSpeaking = false;
        if (conversationActive && document.getElementById('conversationAutoListen').checked && !conversationManualPause) {
            startConversationListening();
        }
        return;
    }

    window.speechSynthesis.cancel();
    conversationIsSpeaking = true;
    setConversationStatus('Đang trả lời bằng giọng nói…', 'speaking');
    document.getElementById('conversationStopSpeakingBtn').hidden = false;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onend = finishConversationSpeech;
    utterance.onerror = finishConversationSpeech;
    window.speechSynthesis.speak(utterance);
}

function finishConversationSpeech() {
    conversationIsSpeaking = false;
    document.getElementById('conversationStopSpeakingBtn').hidden = true;
    if (!conversationActive) return;
    if (document.getElementById('conversationAutoListen').checked && !conversationManualPause) {
        startConversationListening();
    } else {
        setConversationStatus('Đến lượt bạn. Bấm micro để nói.', '');
    }
}

function stopConversationSpeech() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    finishConversationSpeech();
}

function setConversationStatus(text, state) {
    const status = document.getElementById('conversationStatus');
    status.classList.remove('is-listening', 'is-thinking', 'is-speaking', 'is-error');
    if (state) status.classList.add(`is-${state}`);
    document.getElementById('conversationStatusText').textContent = text;
}

function updateConversationMicButton() {
    const button = document.getElementById('conversationMicBtn');
    const label = document.getElementById('conversationMicLabel');
    const listening = conversationIsRecognizing;
    button.classList.toggle('is-listening', listening);
    button.setAttribute('aria-label', listening ? 'Tạm dừng nghe' : 'Bắt đầu nghe');
    label.textContent = listening ? 'Tạm dừng nghe' : (conversationManualPause ? 'Tiếp tục nghe' : 'Bắt đầu nghe');
}

function endConversation(returnToSetup) {
    conversationActive = false;
    conversationIsProcessing = false;
    conversationIsSpeaking = false;
    conversationManualPause = true;
    clearTimeout(conversationRestartTimer);
    if (conversationRecognition && conversationIsRecognizing) conversationRecognition.stop();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    document.getElementById('conversationLiveTranscript').hidden = true;
    document.getElementById('conversationStopSpeakingBtn').hidden = true;
    document.getElementById('conversationRoom').hidden = true;
    document.getElementById('conversationSetup').hidden = !returnToSetup;
    updateConversationMicButton();
}
