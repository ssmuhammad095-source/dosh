document.addEventListener('DOMContentLoaded', () => {
    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let MAX_ATTEMPTS = 6; 
    let WORD_LENGTH = 5; 
    let currentRow = 0;
    let currentTile = 0; // Индекс в пределах строки
    let currentGuess = []; 
    let SECRET_WORD = '';
    let SECRET_TRANSLATION = ''; 
    let isGameOver = true;
    let CHECHEN_WORDS_DATA = null;
    
    // Статистика
    let totalStars = parseInt(localStorage.getItem('totalStars')) || 0;
    let foundTypesCount = parseInt(localStorage.getItem('foundTypesCount')) || 0;
    
    let WORD_SOURCE_DIFFICULTY = ''; 
    let IS_TYPE_WORD = false; 

    let startTime, timerInterval, timeElapsed = 0;

    // DOM Элементы
    const gameBoard = document.getElementById('game-board');
    const messageArea = document.getElementById('message-area');
    // const lengthSelect = document.getElementById('word-length-select'); // Убрано
    const difficultySelect = document.getElementById('difficulty-select'); 
    const startGameBtn = document.getElementById('start-game-btn');
    const giveUpBtn = document.getElementById('give-up-btn');
    const timerDisplay = document.getElementById('timer-display');

    // Аудио
    const typeSound = document.getElementById('type-sound');
    const winSound = document.getElementById('win-sound');
    const loseSound = document.getElementById('lose-sound');

    // Модальные окна
    const modal = document.getElementById('results-modal');
    const typeWinModal = document.getElementById('type-win-modal');
    const translationModal = document.getElementById('translation-modal');
    
    const BANNED_KEYS = ['Я', 'Ю', 'Ё'];

    // Вспомогательная функция для получения длин слов из значений чекбоксов
    function getLengthsFromCategory(cat) {
        if (cat === '2-4') return [2, 3, 4];
        if (cat === '5-7') return [5, 6, 7];
        if (cat === '8-12') return [8, 9, 10, 11, 12];
        if (cat === '13+') return [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
        return [];
    }

    // Расчет количества попыток в зависимости от ДЛИНЫ ВЫБРАННОГО СЛОВА
    // Добавлено по 2 попытки к каждому уровню, как вы просили
    function calculateAttemptsByLength(length) {
        if (length <= 4) return 7;   // Было 5, стало 7
        if (length <= 7) return 8;   // Было 6, стало 8
        if (length <= 12) return 10; // Было 8, стало 10
        return 12;                   // Было 10, стало 12
    }

    async function loadWords() {
        startGameBtn.disabled = true;
        startGameBtn.textContent = 'Дошам чуйаккхар...';
        try {
            const response = await fetch('words.json');
            const data = await response.json();
            CHECHEN_WORDS_DATA = data.CHECHEN_WORDS; 
            startGameBtn.disabled = false;
            startGameBtn.textContent = 'Ловзар доладан';
        } catch (error) {
            console.error(error);
            showMessage("Дошам чуйаьлла йац!", 6000);
        }
    }

    // Создание доски. ТЕПЕРЬ БЕЗ ЛИШНИХ ОБЕРТОК.
    function createBoard(length) {
        gameBoard.innerHTML = '';
        currentRow = 0; 
        currentTile = 0; 
        currentGuess = new Array(length).fill(''); 
        isGameOver = false;
        
        if (length > 10) {
            gameBoard.classList.add('small-tiles');
        } else {
            gameBoard.classList.remove('small-tiles');
        }

        for (let r = 0; r < MAX_ATTEMPTS; r++) {
            const row = document.createElement('div');
            row.className = 'row';
            row.setAttribute('data-row-index', r);

            for (let c = 0; c < length; c++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.setAttribute('data-tile-index', c);
                
                // Обработчик клика для перемещения курсора
                tile.addEventListener('click', () => {
                    if (!isGameOver && r === currentRow) {
                        setActiveTile(c);
                    }
                });

                row.appendChild(tile);
            }
            gameBoard.appendChild(row);
        }
        
        document.querySelectorAll('#keyboard button').forEach(btn => btn.classList.remove('correct', 'present', 'absent'));
        
        setActiveTile(0);
    }

    // Установка активной клетки (курсора)
    function setActiveTile(index) {
        if (index < 0 || index >= WORD_LENGTH) return;
        currentTile = index;
        
        const row = gameBoard.querySelectorAll('.row')[currentRow];
        if (!row) return;
        
        const tiles = row.querySelectorAll('.tile');
        
        // Сбрасываем активность у всех
        tiles.forEach(t => t.classList.remove('active'));
        
        // Ставим на нужную
        tiles[currentTile].classList.add('active');
    }

    function startGame() {
        if (!CHECHEN_WORDS_DATA) return;

        // --- НОВАЯ ЛОГИКА ВЫБОРА ДЛИНЫ ЧЕРЕЗ ЧЕКБОКСЫ ---
        const checkboxes = document.querySelectorAll('input[name="word-length"]:checked');
        let selectedCategories = Array.from(checkboxes).map(cb => cb.value);

        // Если ничего не выбрано, выбираем всё (как "Ларамаза" раньше)
        if (selectedCategories.length === 0) {
            selectedCategories = ['2-4', '5-7', '8-12', '13+'];
        }

        // Собираем все доступные длины в один массив
        let allowedLengths = [];
        selectedCategories.forEach(cat => {
            allowedLengths.push(...getLengthsFromCategory(cat));
        });

        // --- ЛОГИКА ВЫБОРА СЛОВА ---
        const difficulty = difficultySelect.value;
        let availableWords = []; 

        allowedLengths.forEach(len => {
            const L = String(len);
            const easyList = (CHECHEN_WORDS_DATA.EASY[L] || []).map(w => ({...w, source: 'EASY'}));
            const hardList = (CHECHEN_WORDS_DATA.HARD[L] || []).map(w => ({...w, source: 'HARD'}));

            if (difficulty === 'easy') {
                availableWords.push(...easyList);
            } else if (difficulty === 'hard') {
                availableWords.push(...hardList);
            } else if (difficulty === 'combined') {
                availableWords.push(...easyList, ...hardList);
            }
        });

        if (availableWords.length === 0) {
            showMessage(`Кху чолхаллехь дешнаш дац! (${difficulty})`, 3000);
            return;
        }
        
        const chosenObject = availableWords[Math.floor(Math.random() * availableWords.length)];
        SECRET_WORD = chosenObject.word.toUpperCase();
        WORD_LENGTH = SECRET_WORD.length; 
        SECRET_TRANSLATION = chosenObject.translation;
        WORD_SOURCE_DIFFICULTY = chosenObject.source; 
        
        // --- ДИНАМИЧЕСКИЙ РАСЧЕТ ПОПЫТОК ---
        MAX_ATTEMPTS = calculateAttemptsByLength(WORD_LENGTH);

        IS_TYPE_WORD = SECRET_TRANSLATION && SECRET_TRANSLATION.toUpperCase().trim() === 'ТАЙП';

        createBoard(WORD_LENGTH);
        showMessage(`Ловзар доладелла! Дохалла: ${WORD_LENGTH} элп. Попыток: ${MAX_ATTEMPTS}`, 1500);
        
        startGameBtn.classList.add('hidden');
        giveUpBtn.classList.remove('hidden');

        startTime = Date.now();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!isGameOver) {
                timeElapsed = Date.now() - startTime;
                timerDisplay.textContent = `Хан: ${(timeElapsed / 1000).toFixed(0)} с`;
            }
        }, 1000); 
    }

    function giveUpGame() {
        if (isGameOver) return;
        isGameOver = true;
        clearInterval(timerInterval);
        if (loseSound) { loseSound.currentTime = 0; loseSound.play().catch(() => {}); }
        showMessage(`Жоп: ${SECRET_WORD}`, 3000);
        giveUpBtn.classList.add('hidden');
        startGameBtn.classList.remove('hidden');
        showResultsModal(false); 
    }

    function handleKeyPress(key) {
        if (isGameOver) return;

        if (key === "Enter") {
            if (currentGuess.join('').length === WORD_LENGTH && !currentGuess.includes('')) {
                checkGuess();
            } else {
                showMessage("Дош дуьззина дац!", 800);
            }
            return;
        }
        
        if (key === "Delete" || key === "Backspace") {
            const row = gameBoard.querySelectorAll('.row')[currentRow];
            const tiles = row.querySelectorAll('.tile');

            // Если текущая клетка пуста, идем назад
            if (currentGuess[currentTile] === '' || currentGuess[currentTile] === undefined) {
                 if (currentTile > 0) {
                    setActiveTile(currentTile - 1);
                    tiles[currentTile].textContent = '';
                    tiles[currentTile].setAttribute('data-state', 'empty'); // сброс
                    currentGuess[currentTile] = '';
                 }
            } else {
                tiles[currentTile].textContent = '';
                tiles[currentTile].setAttribute('data-state', 'empty');
                currentGuess[currentTile] = '';
            }
            return;
        }
        
        if (BANNED_KEYS.includes(key)) return;

        if (/^[А-ЯЁI]{1}$/i.test(key)) {
            const row = gameBoard.querySelectorAll('.row')[currentRow];
            const tiles = row.querySelectorAll('.tile');
            
            tiles[currentTile].textContent = key.toUpperCase();
            tiles[currentTile].setAttribute('data-state', 'active'); // Анимация
            currentGuess[currentTile] = key.toUpperCase();
            
            if (typeSound) { typeSound.currentTime = 0; typeSound.play().catch(()=>{}); }
            
            if (currentTile < WORD_LENGTH - 1) {
                setActiveTile(currentTile + 1);
            }
        }
    }

    function checkGuess() {
        const guessString = currentGuess.join('');

        if (!isWordInDictionary(guessString)) {
            showMessage("Дошам чохь иштта дош дац!", 2000);
            const row = gameBoard.querySelectorAll('.row')[currentRow];
            row.classList.add('shake');
            setTimeout(() => row.classList.remove('shake'), 500);
            return; 
        }

        const row = gameBoard.querySelectorAll('.row')[currentRow];
        const tiles = row.querySelectorAll('.tile');
        const feedback = new Array(WORD_LENGTH).fill('absent');
        const tempSecret = SECRET_WORD.split('');

        tiles.forEach(t => t.classList.remove('active'));

        currentGuess.forEach((l, i) => {
            if (l === tempSecret[i]) { feedback[i] = 'correct'; tempSecret[i] = null; }
        });
        currentGuess.forEach((l, i) => {
            if (feedback[i] !== 'correct' && tempSecret.includes(l)) {
                feedback[i] = 'present'; tempSecret[tempSecret.indexOf(l)] = null;
            }
        });

        tiles.forEach((tile, i) => {
            setTimeout(() => {
                tile.classList.add(feedback[i], 'flip');
                updateKeyboard(currentGuess[i], feedback[i]);
            }, i * 150);
        });

        // Добавляем кнопку перевода ПРЯМО В РЯД
        const wordTranslation = getTranslationFromDict(guessString);
        if (wordTranslation) {
            setTimeout(() => {
                addTranslateButtonToRow(row, guessString, wordTranslation);
            }, WORD_LENGTH * 150); 
        }

        const animationTime = 800;
        if (guessString !== SECRET_WORD && currentRow + 1 === MAX_ATTEMPTS) {
            if (loseSound) loseSound.play().catch(() => {});
        }

        setTimeout(() => {
            if (guessString === SECRET_WORD) endGame(true);
            else if (currentRow + 1 === MAX_ATTEMPTS) endGame(false);
            else { 
                currentRow++; 
                currentGuess = new Array(WORD_LENGTH).fill('');
                setActiveTile(0); 
            }
        }, animationTime);
    }

    // Функция добавления кнопки в ряд
    function addTranslateButtonToRow(rowElement, word, translation) {
        // Проверяем, нет ли уже кнопки
        if (rowElement.querySelector('.row-translate-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'row-translate-btn';
        btn.textContent = 'Гочдан';
        btn.onclick = (e) => {
            e.stopPropagation();
            openTranslationModal(word, translation);
        };
        rowElement.appendChild(btn);
    }

    function getTranslationFromDict(word) {
        if (!CHECHEN_WORDS_DATA) return null;
        const target = word.toUpperCase().replace(/[Ӏ1]/g, 'I');
        
        const allWords = [
            ...Object.values(CHECHEN_WORDS_DATA.EASY).flat(),
            ...Object.values(CHECHEN_WORDS_DATA.HARD).flat()
        ];
        
        const found = allWords.find(item => item.word.toUpperCase().replace(/[Ӏ1]/g, 'I') === target);
        return found ? found.translation : null;
    }

    function isWordInDictionary(word) {
        return getTranslationFromDict(word) !== null;
    }

    function updateKeyboard(letter, status) {
        const buttons = document.querySelectorAll('#keyboard button');
        let btn = null;
        buttons.forEach(b => {
            const key = b.getAttribute('data-key');
            if (key === letter || (letter === 'I' && (key === 'Ӏ' || key === 'I'))) {
                btn = b;
            }
        });
        if (!btn) return;
        if (status === 'correct') {
            btn.classList.remove('present', 'absent'); btn.classList.add('correct');
        } else if (status === 'present') {
            if (!btn.classList.contains('correct')) {
                btn.classList.remove('absent'); btn.classList.add('present');
            }
        } else if (status === 'absent') {
            if (!btn.classList.contains('correct') && !btn.classList.contains('present')) {
                btn.classList.add('absent');
            }
        }
    }

    function saveStats() {
        localStorage.setItem('totalStars', totalStars);
        localStorage.setItem('foundTypesCount', foundTypesCount);
    }

    function updateTopCounter() {
        const starsElem = document.getElementById('total-stars-count');
        const typesElem = document.getElementById('total-types-count');
        if (starsElem) animateValue(starsElem, parseInt(starsElem.textContent)||0, totalStars, 1000);
        if (typesElem) typesElem.textContent = foundTypesCount;
    }

    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    function endGame(win) {
        isGameOver = true;
        clearInterval(timerInterval);
        let earnedStars = 0;
        if (win) {
            if (winSound) winSound.play().catch(() => {});
            if (currentRow === 0) earnedStars = 3;
            else if (currentRow < 3) earnedStars = 2;
            else earnedStars = 1;
            totalStars += earnedStars;
            if (IS_TYPE_WORD) { foundTypesCount++; saveStats(); } else { saveStats(); }
            updateTopCounter();
        }
        if (IS_TYPE_WORD && win) showTypeWinModal(earnedStars);
        else showResultsModal(win, earnedStars);
        
        giveUpBtn.classList.add('hidden');
        startGameBtn.classList.remove('hidden');
    }

    // --- МОДАЛЬНЫЕ ОКНА ---

    function openTranslationModal(word, translation) {
        const modal = document.getElementById('translation-modal');
        document.getElementById('translation-word-title').textContent = word;
        document.getElementById('translation-text').textContent = translation;
        modal.classList.add('visible');
    }

    function showTypeWinModal(score) {
        const typeModal = document.getElementById('type-win-modal');
        if (!typeModal) return;
        document.getElementById('type-word-display').textContent = SECRET_WORD;
        document.getElementById('type-attempts').textContent = `${currentRow + 1}/${MAX_ATTEMPTS}`;
        document.getElementById('type-stars-display').textContent = `${score} ⭐`;
        document.getElementById('type-time').textContent = `${(timeElapsed / 1000).toFixed(1)} с`;
        document.getElementById('type-count-display').textContent = foundTypesCount;

        const transBtn = document.getElementById('type-translate-btn');
        transBtn.classList.remove('hidden');
        transBtn.onclick = () => openTranslationModal(SECRET_WORD, SECRET_TRANSLATION);

        typeModal.classList.add('visible');
    }

    function showResultsModal(isWin, earnedStars = 0) {
        const modal = document.getElementById('results-modal');
        if (!modal) return;
        document.getElementById('modal-title').textContent = isWin ? "🎯 Толам!" : "😥 Эшам!";
        document.getElementById('modal-attempts').textContent = `${currentRow + (isWin ? 1 : 0)}/${MAX_ATTEMPTS}`;
        document.getElementById('modal-time').textContent = `${(timeElapsed / 1000).toFixed(1)} с`;
        document.getElementById('modal-secret-word-display').textContent = SECRET_WORD;
        
        const transBtn = document.getElementById('modal-translate-btn');
        transBtn.classList.remove('hidden');
        transBtn.onclick = () => openTranslationModal(SECRET_WORD, SECRET_TRANSLATION);

        const starsDisplay = document.getElementById('modal-stars-display');
        if (starsDisplay) starsDisplay.textContent = isWin ? `✨ ${earnedStars}` : "0 ⭐";
        
        modal.classList.add('visible');
    }

    // --- ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ ---

    function showMessage(msg, dur) {
        messageArea.textContent = msg;
        messageArea.classList.remove('hidden');
        messageArea.classList.add('visible');
        setTimeout(() => {
            messageArea.classList.remove('visible');
            messageArea.classList.add('hidden');
        }, dur);
    }

    document.addEventListener('keyup', e => {
        if (e.key === 'Enter') { handleKeyPress('Enter'); return; }
        if (e.key === 'Backspace') { handleKeyPress('Delete'); return; }
        let key = e.key.toUpperCase();
        if (e.key === '1' || key === 'I' || key === 'Ӏ') key = 'I';
        handleKeyPress(key);
    });

    document.querySelectorAll('#keyboard button').forEach(b => {
        b.onclick = (e) => { 
            e.preventDefault();
            handleKeyPress(b.getAttribute('data-key')); 
        };
    });

    startGameBtn.onclick = () => { startGame(); startGameBtn.blur(); };
    giveUpBtn.onclick = () => { giveUpGame(); giveUpBtn.blur(); };

    const closeTranslationBtn = document.getElementById('close-translation-btn');
    if (closeTranslationBtn) {
        closeTranslationBtn.onclick = () => document.getElementById('translation-modal').classList.remove('visible');
    }

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.onclick = function() {
            this.closest('.modal').classList.remove('visible');
        }
    });

    document.getElementById('restart-modal-btn').onclick = () => {
        document.getElementById('results-modal').classList.remove('visible');
        startGame();
    };
    
    const typeRestartBtn = document.getElementById('type-restart-btn');
    if (typeRestartBtn) {
        typeRestartBtn.onclick = () => {
            document.getElementById('type-win-modal').classList.remove('visible');
            startGame();
        };
    }

    window.onclick = e => { 
        if (e.target.classList.contains('modal')) e.target.classList.remove('visible');
    };
    
    updateTopCounter(); 
    loadWords();
});