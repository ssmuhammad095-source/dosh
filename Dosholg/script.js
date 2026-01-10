document.addEventListener('DOMContentLoaded', () => {
    // --- ПЕРЕМЕННЫЕ СОСТОЯНИЯ ---
    let MAX_ATTEMPTS = 6; 
    let WORD_LENGTH = 5; 
    let currentRow = 0;
    let currentTile = 0;
    let currentGuess = [];
    let SECRET_WORD = '';
    let SECRET_TRANSLATION = ''; 
    let isGameOver = true;
    let CHECHEN_WORDS_DATA = null;
    let totalStars = parseInt(localStorage.getItem('totalStars')) || 0;
    let foundTypesCount = parseInt(localStorage.getItem('foundTypesCount')) || 0;
    
    // ПЕРЕМЕННЫЕ ДЛЯ РАСЧЕТА ОЧКОВ И ТАЙПА
    let WORD_SOURCE_DIFFICULTY = ''; 
    let IS_TYPE_WORD = false; 

    let startTime, timerInterval, timeElapsed = 0;

    const gameBoard = document.getElementById('game-board');
    const messageArea = document.getElementById('message-area');
    const lengthSelect = document.getElementById('word-length-select');
    const difficultySelect = document.getElementById('difficulty-select'); 
    const startGameBtn = document.getElementById('start-game-btn');
    const giveUpBtn = document.getElementById('give-up-btn'); // Кнопка сдаться
    const timerDisplay = document.getElementById('timer-display');

    const typeSound = document.getElementById('type-sound');
    const winSound = document.getElementById('win-sound');
    const loseSound = document.getElementById('lose-sound');

    // ЭЛЕМЕНТЫ ДЛЯ ОБЫЧНОГО МОДАЛА
    const modal = document.getElementById('results-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalAttempts = document.getElementById('modal-attempts');
    const modalTime = document.getElementById('modal-time');
    const modalSecretWordDisplay = document.getElementById('modal-secret-word-display');
    const restartModalBtn = document.getElementById('restart-modal-btn');
    const closeButton = modal.querySelector('.close-button');
    const modalStarsDisplay = document.getElementById('modal-stars-display');

    // ЭЛЕМЕНТЫ ДЛЯ ТАЙП МОДАЛА
    const typeWinModal = document.getElementById('type-win-modal');
    const typeWordDisplay = document.getElementById('type-word-display');
    const typeAttempts = document.getElementById('type-attempts');
    const typeStarsDisplay = document.getElementById('type-stars-display');
    const typeTime = document.getElementById('type-time');
    const typeRestartBtn = document.getElementById('type-restart-btn');
    const typeCloseButton = typeWinModal ? typeWinModal.querySelector('.close-button') : null;

    const BANNED_KEYS = ['Я', 'Ю', 'Ё'];

    // 2. Исправление выборки длины слова
    function getAttemptsAndLengthRange(categoryValue) {
        if (categoryValue === '2-4') return { attempts: 5, lengthRange: [2, 3, 4] };
        if (categoryValue === '5-7') return { attempts: 6, lengthRange: [5, 6, 7] };
        if (categoryValue === '8-12') return { attempts: 8, lengthRange: [8, 9, 10, 11, 12] };
        if (categoryValue === '13+') return { attempts: 10, lengthRange: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25] }; 
        return { attempts: 6, lengthRange: [5, 6, 7] };
    }

    // ЛОГИКА РАСЧЕТА ОЧКОВ (ЗВЕЗД)
    function calculateScore(wordLength, attemptsUsed, sourceDifficulty) {
        if (IS_TYPE_WORD) {
            return 50; 
        }
        
        let baseScore = wordLength;
        let finalScore = baseScore;
        if (attemptsUsed === 1) finalScore += 2;
        if (sourceDifficulty === 'HARD') finalScore *= 2;
        
        return finalScore;
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

    function createBoard(length) {
        gameBoard.innerHTML = '';
        currentRow = 0; currentTile = 0; currentGuess = []; isGameOver = false;
        
        // Адаптация сетки для длинных слов
        if (length > 10) {
            gameBoard.classList.add('small-tiles');
        } else {
            gameBoard.classList.remove('small-tiles');
        }

        for (let r = 0; r < MAX_ATTEMPTS; r++) {
            const row = document.createElement('div');
            row.className = 'row';
            for (let c = 0; c < length; c++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                row.appendChild(tile);
            }
            gameBoard.appendChild(row);
        }
        document.querySelectorAll('#keyboard button').forEach(btn => btn.classList.remove('correct', 'present', 'absent'));
    }

    function startGame() {
        if (!CHECHEN_WORDS_DATA) return;

        let category = lengthSelect.value;
        if (category === 'random') {
            const modes = ['2-4', '5-7', '8-12', '13+'];
            category = modes[Math.floor(Math.random() * modes.length)];
        }

        const { attempts, lengthRange } = getAttemptsAndLengthRange(category);
        MAX_ATTEMPTS = attempts; 
        
        const difficulty = difficultySelect.value;
        let availableWords = []; 

        lengthRange.forEach(len => {
            const L = String(len);
         // Берем данные строго по выбранной категории
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

        // Если после фильтрации пусто - выводим ошибку, а не берем что попало
        if (availableWords.length === 0) {
            showMessage(`Кху чолхаллехь дешнаш дац! (${difficulty})`, 3000);
            return;
        }
        
        const chosenObject = availableWords[Math.floor(Math.random() * availableWords.length)];
        SECRET_WORD = chosenObject.word.toUpperCase();
        WORD_LENGTH = SECRET_WORD.length; 
        SECRET_TRANSLATION = chosenObject.translation;
        WORD_SOURCE_DIFFICULTY = chosenObject.source; 
        
        IS_TYPE_WORD = SECRET_TRANSLATION && SECRET_TRANSLATION.toUpperCase().trim() === 'ТАЙП';

        createBoard(WORD_LENGTH);
        showMessage(`Ловзар доладелла! Дохалла: ${WORD_LENGTH} элп.`, 1800);
        
        // Управление кнопками
        startGameBtn.classList.add('hidden'); // Скрываем старт
        giveUpBtn.classList.remove('hidden'); // Показываем сдаться

        startTime = Date.now();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (!isGameOver) {
                timeElapsed = Date.now() - startTime;
                timerDisplay.textContent = `Хан: ${(timeElapsed / 1000).toFixed(0)} с`;
            }
        }, 1000); 
    }

    // 3. Функция Сдаться
    function giveUpGame() {
        if (isGameOver) return;
        
        isGameOver = true;
        clearInterval(timerInterval);
        
        // Играем звук проигрыша мгновенно
        if (loseSound) {
            loseSound.currentTime = 0;
            loseSound.play().catch(() => {});
        }

        showMessage(`Жоп: ${SECRET_WORD}`, 3000);
        
        // Мгновенно меняем видимость кнопок
        giveUpBtn.classList.add('hidden');
        startGameBtn.classList.remove('hidden');

        // Показываем модальное окно БЕЗ setTimeout
        showResultsModal(false); 
    }

    function handleKeyPress(key) {
        if (isGameOver) return;

        if (key === "Enter") {
            if (currentGuess.length === WORD_LENGTH) {
                checkGuess();
                // updateKeyboard удален отсюда, так как он вызывается внутри checkGuess и здесь вызывал бы ошибку
            } else {
                showMessage("Дош иштта доца дац!", 800);
            }
            return;
        }
        
        if (key === "Delete" || key === "Backspace") {
            if (currentTile > 0) {
                currentTile--;
                const row = gameBoard.querySelectorAll('.row')[currentRow];
                const tiles = row.querySelectorAll('.tile');
                tiles[currentTile].textContent = '';
                currentGuess.pop();
            }
            return;
        }
        
        if (BANNED_KEYS.includes(key)) return;

        if (/^[А-ЯЁI]{1}$/i.test(key) && currentTile < WORD_LENGTH) {
            const row = gameBoard.querySelectorAll('.row')[currentRow];
            const tiles = row.querySelectorAll('.tile');
            tiles[currentTile].textContent = key.toUpperCase();
            currentGuess.push(key.toUpperCase());
            currentTile++;
            if (typeSound) { typeSound.currentTime = 0; typeSound.play().catch(()=>{}); }
        }
    }

    function checkGuess() {
        const guessString = currentGuess.join('');

        // --- НОВАЯ ПРОВЕРКА: Существует ли слово в словаре ---
        if (!isWordInDictionary(guessString)) {
            showMessage("Дошам чохь иштта дош дац!", 2000); // "Такого слова нет в словаре!"
            
            // Тряска строки (визуальный эффект ошибки)
            const row = gameBoard.querySelectorAll('.row')[currentRow];
            row.classList.add('shake');
            setTimeout(() => row.classList.remove('shake'), 500);
            return; 
        }
        // ----------------------------------------------------

        const row = gameBoard.querySelectorAll('.row')[currentRow];
        const tiles = row.querySelectorAll('.tile');
        const feedback = new Array(WORD_LENGTH).fill('absent');
        const tempSecret = SECRET_WORD.split('');

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

        const animationTime = 800;
        if (guessString !== SECRET_WORD && currentRow + 1 === MAX_ATTEMPTS) {
            if (loseSound) loseSound.play().catch(() => {});
        }

        setTimeout(() => {
            if (guessString === SECRET_WORD) endGame(true);
            else if (currentRow + 1 === MAX_ATTEMPTS) endGame(false);
            else { currentRow++; currentTile = 0; currentGuess = []; }
        }, animationTime);
    }

    // Вспомогательная функция для проверки слова
    function isWordInDictionary(word) {
        if (!CHECHEN_WORDS_DATA) return true;
        
        const allWords = [
            ...Object.values(CHECHEN_WORDS_DATA.EASY).flat(),
            ...Object.values(CHECHEN_WORDS_DATA.HARD).flat()
        ];

        return allWords.some(item => 
            item.word.toUpperCase().replace(/[Ӏ1]/g, 'I') === word
        );
    }

    function updateKeyboard(letter, status) {
        // Находим все кнопки и ищем ту, у которой data-key совпадает с буквой
        const buttons = document.querySelectorAll('#keyboard button');
        let btn = null;
        
        buttons.forEach(b => {
            const key = b.getAttribute('data-key');
            // Проверка на совпадение буквы или спецсимвола I
            if (key === letter || (letter === 'I' && (key === 'Ӏ' || key === 'I'))) {
                btn = b;
            }
        });

        if (!btn) return;

        if (status === 'correct') {
            btn.classList.remove('present', 'absent');
            btn.classList.add('correct');
        } else if (status === 'present') {
            if (!btn.classList.contains('correct')) {
                btn.classList.remove('absent');
                btn.classList.add('present');
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
        
        if (starsElem) {
            // Берем текущее число из HTML и плавно ведем его до нового значения totalStars
            const startValue = parseInt(starsElem.textContent) || 0;
            animateValue(starsElem, startValue, totalStars, 1000);
        }
        
        if (typesElem) {
            typesElem.textContent = foundTypesCount;
        }
    }

    // Вспомогательная функция для анимации чисел
    function animateValue(obj, start, end, duration) {
        if (start === end) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function endGame(win) {
        isGameOver = true;
        clearInterval(timerInterval);

        let earnedStars = 0;
        if (win) {
            if (winSound) winSound.play().catch(() => {});
            
            // Считаем звезды: чем меньше попыток, тем лучше
            // currentRow начинается с 0, поэтому 0 - это первая попытка
            if (currentRow === 0) earnedStars = 3;
            else if (currentRow < 3) earnedStars = 2;
            else earnedStars = 1;

            totalStars += earnedStars;
            
            if (IS_TYPE_WORD) {
                foundTypesCount++;
                saveStats(); // Сохраняем статистику
            } else {
                 saveStats(); // Сохраняем просто звезды
            }

            const counterElem = document.getElementById('stats-counter');
            if (counterElem) {
                counterElem.classList.add('bump');
                setTimeout(() => counterElem.classList.remove('bump'), 400);
            }
            updateTopCounter();
        }

        // Показываем модалку (передаем earnedStars, чтобы не было 0)
        if (IS_TYPE_WORD && win) {
            showTypeWinModal(earnedStars);
        } else {
            showResultsModal(win, earnedStars);
        }

        giveUpBtn.classList.add('hidden');
        startGameBtn.classList.remove('hidden');
    }

    function showTypeWinModal(score) {
    const typeModal = document.getElementById('type-win-modal');
    if (!typeModal) return;

    document.getElementById('type-word-display').textContent = `${SECRET_WORD} (${SECRET_TRANSLATION.toUpperCase()})`;
    document.getElementById('type-attempts').textContent = `${currentRow + 1}/${MAX_ATTEMPTS}`;
    document.getElementById('type-stars-display').textContent = `${score} ⭐`;
    document.getElementById('type-time').textContent = `${(timeElapsed / 1000).toFixed(1)} с`;
    document.getElementById('type-count-display').textContent = foundTypesCount;

    typeModal.classList.add('visible'); // Добавляем показ
}

    function showResultsModal(isWin, earnedStars = 0) {
    const modal = document.getElementById('results-modal');
    if (!modal) return;
    
    document.getElementById('modal-title').textContent = isWin ? "🎯 Толам!" : "😥 Эшам!";
    document.getElementById('modal-attempts').textContent = `${currentRow + (isWin ? 1 : 0)}/${MAX_ATTEMPTS}`;
    document.getElementById('modal-time').textContent = `${(timeElapsed / 1000).toFixed(1)} с`;
    document.getElementById('modal-secret-word-display').textContent = `${SECRET_WORD} (${SECRET_TRANSLATION.toUpperCase()})`;
    
    const starsDisplay = document.getElementById('modal-stars-display');
    if (starsDisplay) starsDisplay.textContent = isWin ? `✨ ${earnedStars}` : "0 ⭐";

    modal.classList.add('visible'); // Добавляем показ
}

    function showMessage(msg, dur) {
        messageArea.textContent = msg;
        messageArea.classList.remove('hidden');
        messageArea.classList.add('visible');
        setTimeout(() => {
            messageArea.classList.remove('visible');
            messageArea.classList.add('hidden');
        }, dur);
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
    document.addEventListener('keyup', e => {
        if (e.key === 'Enter') {
            handleKeyPress('Enter');
            return;
        }
        if (e.key === 'Backspace') {
            handleKeyPress('Delete');
            return;
        }

        let key = e.key.toUpperCase();
        if (e.key === '1' || key === 'I' || key === 'Ӏ') key = 'I';
        
        handleKeyPress(key);
    });

    document.querySelectorAll('#keyboard button').forEach(b => {
        b.onclick = () => { 
            handleKeyPress(b.getAttribute('data-key')); 
            b.blur(); 
        };
    });

    startGameBtn.onclick = () => { 
        startGame(); 
        startGameBtn.blur(); 
    };
    
    // Обработчик кнопки сдаться
    giveUpBtn.onclick = () => {
        giveUpGame();
        giveUpBtn.blur();
    };

    if(restartModalBtn) {
        restartModalBtn.onclick = () => { 
            modal.classList.remove('visible'); 
            startGame(); 
            restartModalBtn.blur();
        };
    }

    if(closeButton) closeButton.onclick = () => modal.classList.remove('visible');
    
    if (typeRestartBtn) {
        typeRestartBtn.onclick = () => { 
            typeWinModal.classList.remove('visible'); 
            startGame(); 
            typeRestartBtn.blur();
        };
    }
    
    if (typeCloseButton) {
        typeCloseButton.onclick = () => typeWinModal.classList.remove('visible');
    }

    window.onclick = e => { 
        if(e.target === modal) modal.classList.remove('visible'); 
        if(typeWinModal && e.target === typeWinModal) typeWinModal.classList.remove('visible');
    };
    
    updateTopCounter(); 
    loadWords();
});