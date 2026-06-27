/* ============================================================
   ИГРОША — образовательное SPA. Чистый Vanilla JS.
   Структура файла (логические модули):
     1) ХРАНИЛИЩЕ (localStorage, версии, миграция)
     2) ОЗВУЧКА (Web Speech API)
     3) УТИЛИТЫ (random, перемешивание и т.п.)
     4) ОБЩИЙ UI (экраны, шапка, модалки, конфетти, награды)
     5) ДВИЖОК ВИКТОРИН и ВЫБОР УРОВНЯ
     6) РЕЕСТР ИГР
     7) РЕАЛИЗАЦИИ 13 ИГР
     8) ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

'use strict';

/* ============================================================
   1) ХРАНИЛИЩЕ
   ============================================================ */
const APP_VERSION = 2;            // текущая версия структуры данных
const STORAGE_KEY = 'igrosha_data';

// Значения по умолчанию
function defaultData(){
  return {
    appVersion: APP_VERSION,
    profile: { name:'', avatar:'🦊' },
    stars: 0,
    played: 0,
    soundOn: true,
    bestScores: {},   // { gameId: число }
    achievements: []  // массив id достижений
  };
}

let DATA = loadData();

// Загрузка с безопасной миграцией/сбросом
function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultData();
    const obj = JSON.parse(raw);
    // если версия не совпала — мигрируем (сохраняем профиль, остальное сбрасываем)
    if(obj.appVersion !== APP_VERSION){
      const fresh = defaultData();
      if(obj.profile && obj.profile.name) fresh.profile = obj.profile;
      return fresh;
    }
    // защита от повреждённых полей
    const d = defaultData();
    return Object.assign(d, obj, { appVersion: APP_VERSION });
  }catch(e){
    return defaultData();
  }
}

function saveData(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(DATA)); }
  catch(e){ /* приватный режим и т.п. — молча игнорируем */ }
}

// Начислить звёзды + анимация + обновить шапку
function addStars(n){
  if(n<=0) return;
  DATA.stars += n;
  saveData();
  updateHeader();
  confettiBurst();
}

// Запомнить лучший результат (больше = лучше)
function saveBest(gameId, value){
  const cur = DATA.bestScores[gameId] || 0;
  if(value > cur){ DATA.bestScores[gameId] = value; saveData(); return true; }
  return false;
}

// Сыграна партия
function markPlayed(){ DATA.played++; saveData(); }

/* ============================================================
   2) ОЗВУЧКА
   ============================================================ */
function speak(text){
  if(!DATA.soundOn) return;
  if(!('speechSynthesis' in window)) return;
  try{
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU';
    u.rate = 0.95; u.pitch = 1.15;
    speechSynthesis.speak(u);
  }catch(e){}
}

/* ============================================================
   3) УТИЛИТЫ
   ============================================================ */
const rnd = (min,max)=> Math.floor(Math.random()*(max-min+1))+min;
const pick = arr => arr[rnd(0,arr.length-1)];
function shuffle(a){
  a = a.slice();
  for(let i=a.length-1;i>0;i--){
    const j = rnd(0,i);
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}
const $ = id => document.getElementById(id);

/* ============================================================
   4) ОБЩИЙ UI
   ============================================================ */
const AVATARS = ['🦊','🐱','🐶','🐼','🐯','🦁','🐸','🐵','🦄','🐢','🐧','🦉'];

// Достижения: id, эмодзи, название, проверка(data)
const ACHIEVEMENTS = [
  { id:'first',  ico:'🌟', name:'Первая игра',  test:d=> d.played>=1 },
  { id:'star10', ico:'⭐', name:'10 звёзд',      test:d=> d.stars>=10 },
  { id:'star50', ico:'💫', name:'50 звёзд',      test:d=> d.stars>=50 },
  { id:'star100',ico:'🏆', name:'100 звёзд',     test:d=> d.stars>=100 },
  { id:'play10', ico:'🎮', name:'10 партий',     test:d=> d.played>=10 },
  { id:'play30', ico:'🎖️', name:'30 партий',     test:d=> d.played>=30 },
];

function checkAchievements(){
  let unlocked = false;
  ACHIEVEMENTS.forEach(a=>{
    if(!DATA.achievements.includes(a.id) && a.test(DATA)){
      DATA.achievements.push(a.id);
      unlocked = true;
    }
  });
  if(unlocked){ saveData(); renderAchievements(); }
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.add('hidden'));
  $(id).classList.remove('hidden');
}

function updateHeader(){
  $('meName').textContent = DATA.profile.name || 'Друг';
  $('meAvatar').textContent = DATA.profile.avatar || '🦊';
  $('starCount').textContent = DATA.stars;
}

// Конфетти-анимация награды
function confettiBurst(){
  const layer = $('confetti');
  layer.classList.remove('hidden');
  const icons = ['⭐','🌟','✨','🎉','💫'];
  for(let i=0;i<24;i++){
    const s = document.createElement('span');
    s.className='cf';
    s.textContent = pick(icons);
    s.style.left = rnd(0,100)+'%';
    s.style.top = '-40px';
    s.style.animationDuration = (rnd(15,30)/10)+'s';
    s.style.animationDelay = (rnd(0,8)/10)+'s';
    layer.appendChild(s);
    setTimeout(()=>s.remove(), 3200);
  }
  setTimeout(()=>layer.classList.add('hidden'), 3400);
}

// Универсальная модалка результата
let _againCb = null;
function showResult({title, msg, emoji='🎉', stars=0, again=null}){
  $('modalEmoji').textContent = emoji;
  $('modalTitle').textContent = title;
  $('modalMsg').textContent = msg || '';
  $('modalStars').textContent = stars>0 ? '⭐'.repeat(Math.min(stars,5)) : '';
  _againCb = again;
  $('modalAgain').style.display = again ? '' : 'none';
  $('modal').classList.remove('hidden');
  speak(title + '. ' + (msg||''));
}
function closeModal(){ $('modal').classList.add('hidden'); }

// Завершение партии: звёзды, рекорд, достижения, модалка
function finishGame(gameId, {win, stars=0, scoreForBest=null, title, msg, emoji, again}){
  markPlayed();
  if(stars>0) addStars(stars);
  let recordMsg = '';
  if(scoreForBest!=null && saveBest(gameId, scoreForBest)){
    recordMsg = ' 🏅 Новый рекорд!';
  }
  checkAchievements();
  showResult({
    title: title || (win?'Молодец!':'Попробуй ещё раз!'),
    msg: (msg||'') + recordMsg,
    emoji: emoji || (win?'🎉':'💪'),
    stars,
    again
  });
}

/* ============================================================
   5) ДВИЖОК ВЫБОРА УРОВНЯ и ВИКТОРИН
   ============================================================ */
// Показать выбор уровня (1/2/3 класс), затем вызвать callback(level)
function chooseLevel(area, title, cb, labels){
  labels = labels || ['1 класс 🐣','2 класс 🐤','3 класс 🐔'];
  area.innerHTML = `
    <div class="level-pick">
      <h3>${title}</h3>
      <p class="hint">Выбери сложность</p>
    </div>`;
  const row = document.createElement('div');
  row.className='row';
  labels.forEach((lab,i)=>{
    const b=document.createElement('button');
    b.className='btn btn-big';
    b.textContent=lab;
    b.onclick=()=>cb(i+1);
    row.appendChild(b);
  });
  area.querySelector('.level-pick').appendChild(row);
}

/* Универсальный движок викторины из вопросов.
   questions: [{prompt, options:[...], answer, speak?}]
   onDone(correctCount, total) */
function runQuiz(area, gameId, questions, opts={}){
  let idx=0, correct=0;
  const total = questions.length;

  function render(){
    if(idx>=total){
      const stars = correct>=total ? 3 : correct>=total*0.6 ? 2 : correct>0?1:0;
      finishGame(gameId,{
        win: correct>=total*0.6,
        stars,
        scoreForBest: correct,
        title: correct>=total?'Отлично! Всё верно! 🎉':'Хорошая игра!',
        msg:`Правильных ответов: ${correct} из ${total}`,
        again:()=>runQuiz(area,gameId,opts.regen?opts.regen():questions,opts)
      });
      return;
    }
    const q = questions[idx];
    setScore(`${idx+1}/${total}`);
    area.innerHTML = `<div class="center"><p class="hint">Вопрос ${idx+1} из ${total}</p>
      <div class="prompt">${q.prompt}</div></div>`;
    speak(q.speak || q.prompt.replace(/<[^>]+>/g,''));
    const row=document.createElement('div'); row.className='row';
    shuffle(q.options).forEach(o=>{
      const b=document.createElement('button');
      b.className='tile opt';
      b.textContent=o;
      b.onclick=()=>{
        if(String(o)===String(q.answer)){
          b.classList.add('correct'); correct++; speak('Верно!');
        }else{
          b.classList.add('wrong'); speak('Почти! Правильно: '+q.answer);
          // подсветить правильный
          [...row.children].forEach(c=>{ if(c.textContent===String(q.answer)) c.classList.add('correct'); });
        }
        [...row.children].forEach(c=>c.disabled=true);
        setTimeout(()=>{ idx++; render(); }, 900);
      };
      row.appendChild(b);
    });
    area.appendChild(row);
  }
  render();
}

function setScore(txt){ $('gameScore').textContent = txt; }

/* ============================================================
   6) РЕЕСТР ИГР
   ============================================================ */
const GAMES = [
  {id:'bulls',   ico:'🐂', name:'Быки и коровы', ds:'Угадай число', run:gameBulls},
  {id:'ttt',     ico:'⭕', name:'Крестики-нолики', ds:'Исчезающие фишки', run:gameTTT},
  {id:'race',    ico:'🏎️', name:'Мат. гонки', ds:'Считай на скорость', run:gameRace},
  {id:'memory',  ico:'🃏', name:'Найди пару', ds:'Пример и ответ', run:gameMemory},
  {id:'seq',     ico:'🔢', name:'Числовые ряды', ds:'Продолжи ряд', run:gameSeq},
  {id:'cat',     ico:'🐱', name:'Спаси котёнка', ds:'Угадай слово', run:gameCat},
  {id:'anagram', ico:'🔤', name:'Составь слово', ds:'Собери из букв', run:gameAnagram},
  {id:'scales',  ico:'⚖️', name:'Логические весы', ds:'Найди число', run:gameScales},
  {id:'sudoku',  ico:'🧩', name:'Судоку 4×4', ds:'Расставь числа', run:gameSudoku},
  {id:'odd',     ico:'🔍', name:'Что лишнее', ds:'Найди лишнее', run:gameOdd},
  {id:'clock',   ico:'🕒', name:'Часики', ds:'Сколько времени?', run:gameClock},
  {id:'compare', ico:'⚜️', name:'Больше-меньше', ds:'Сравни числа', run:gameCompare},
  {id:'shop',    ico:'💰', name:'Магазин', ds:'Посчитай сдачу', run:gameShop},
  {id:'connect4',ico:'🔴', name:'4 в ряд', ds:'Собери линию', run:gameConnect4},
  {id:'laser',   ico:'🔦', name:'Лазерный лабиринт', ds:'Доведи луч до цели', run:gameLaser},
  {id:'factor',  ico:'♟️', name:'Захват чисел',       ds:'Делители-стратегия', run:gameFactor},
  {id:'wslide',  ico:'🔡', name:'Словесный сдвиг',    ds:'Собери слова сдвигом', run:gameWordSlide},
];

function renderGames(){
  const grid=$('gamesGrid'); grid.innerHTML='';
  GAMES.forEach(g=>{
    const card=document.createElement('div');
    card.className='game-card';
    const best = DATA.bestScores[g.id];
    card.innerHTML=`<span class="ico">${g.ico}</span>
      <div class="nm">${g.name}</div>
      <div class="ds">${g.ds}</div>
      ${best?`<div class="bs">🏅 ${best}</div>`:''}`;
    card.onclick=()=>openGame(g);
    grid.appendChild(card);
  });
}

function renderAchievements(){
  const box=$('achievementsBox'); box.innerHTML='<div style="width:100%;text-align:center;font-weight:bold;margin-bottom:6px">🏅 Достижения</div>';
  ACHIEVEMENTS.forEach(a=>{
    const got = DATA.achievements.includes(a.id);
    const el=document.createElement('div');
    el.className='badge'+(got?'':' locked');
    el.textContent=`${a.ico} ${a.name}`;
    box.appendChild(el);
  });
}

function openGame(g){
  showScreen('screen-game');
  $('gameTitle').textContent = g.ico+' '+g.name;
  setScore('');
  closeModal();
  g.run($('gameArea'));
}

/* ============================================================
   7) РЕАЛИЗАЦИИ ИГР
   ============================================================ */

/* ---------- СЛОВАРИ (для слов, анаграмм, котёнка) ---------- */
const WORDS = [
  {w:'КОТ', cat:'Животные 🐾'}, {w:'СОБАКА', cat:'Животные 🐾'},
  {w:'ЛИСА', cat:'Животные 🐾'}, {w:'ВОЛК', cat:'Животные 🐾'},
  {w:'ЗАЯЦ', cat:'Животные 🐾'}, {w:'МЕДВЕДЬ', cat:'Животные 🐾'},
  {w:'ТИГР', cat:'Животные 🐾'}, {w:'СЛОН', cat:'Животные 🐾'},
  {w:'ЁЖИК', cat:'Животные 🐾'}, {w:'РЫБА', cat:'Животные 🐾'},
  {w:'ХЛЕБ', cat:'Еда 🍎'}, {w:'СЫР', cat:'Еда 🍎'},
  {w:'МОЛОКО', cat:'Еда 🍎'}, {w:'ЯБЛОКО', cat:'Еда 🍎'},
  {w:'БАНАН', cat:'Еда 🍎'}, {w:'КАША', cat:'Еда 🍎'},
  {w:'СУП', cat:'Еда 🍎'}, {w:'ТОРТ', cat:'Еда 🍎'},
  {w:'СОК', cat:'Еда 🍎'}, {w:'МЁД', cat:'Еда 🍎'},
  {w:'ШКОЛА', cat:'Школа ✏️'}, {w:'КНИГА', cat:'Школа ✏️'},
  {w:'РУЧКА', cat:'Школа ✏️'}, {w:'ПЕНАЛ', cat:'Школа ✏️'},
  {w:'УРОК', cat:'Школа ✏️'}, {w:'ПАРТА', cat:'Школа ✏️'},
  {w:'ДОСКА', cat:'Школа ✏️'}, {w:'МЕЛ', cat:'Школа ✏️'},
  {w:'ЛЕТО', cat:'Природа 🌳'}, {w:'ЗИМА', cat:'Природа 🌳'},
  {w:'ДОЖДЬ', cat:'Природа 🌳'}, {w:'СОЛНЦЕ', cat:'Природа 🌳'},
  {w:'РЕКА', cat:'Природа 🌳'}, {w:'ЛЕС', cat:'Природа 🌳'},
  {w:'ЦВЕТОК', cat:'Природа 🌳'}, {w:'ГОРА', cat:'Природа 🌳'},
];
const WORDSET = new Set(WORDS.map(o=>o.w));

/* ---------- 1. БЫКИ И КОРОВЫ ---------- */
function gameBulls(area){
  chooseLevel(area,'🐂 Быки и коровы','run',['3 цифры 🙂','4 цифры 😎']);
  // переопределяем кнопки (длина числа)
  area.querySelectorAll('.btn-big').forEach((b,i)=> b.onclick=()=>start(i+3));

  function start(len){
    // секретное число с уникальными цифрами
    let digits=shuffle('0123456789'.split('')).slice(0,len);
    const secret = digits.join('');
    let tries=0;
    const history=[];

    function render(){
      setScore('Ходов: '+tries);
      area.innerHTML=`
        <div class="center">
          <p class="hint">Я загадал число из ${len} разных цифр. Угадай его!</p>
          <p class="hint">🐂 бык = цифра на своём месте, 🐄 корова = есть, но не там.</p>
          <input id="guessIn" class="tile" style="font-size:1.6rem;letter-spacing:6px;width:160px;text-align:center"
                 inputmode="numeric" maxlength="${len}" placeholder="${'?'.repeat(len)}">
          <div><button id="guessBtn" class="btn btn-green">Проверить ✅</button></div>
          <div id="hist" style="margin-top:12px;text-align:left;max-width:300px;margin-inline:auto"></div>
        </div>`;
      const inp=$('guessIn');
      inp.oninput=()=> inp.value=inp.value.replace(/\D/g,'');
      $('guessBtn').onclick=check;
      inp.addEventListener('keydown',e=>{ if(e.key==='Enter') check(); });
      inp.focus();
      const h=$('hist');
      history.slice().reverse().forEach(x=>{
        const d=document.createElement('div');
        d.style.cssText='background:#eef0ff;border-radius:10px;padding:6px 10px;margin:4px 0;font-size:1.1rem';
        d.textContent=`${x.g} → 🐂 ${x.b}  🐄 ${x.c}`;
        h.appendChild(d);
      });
    }

    function check(){
      const g=$('guessIn').value;
      if(g.length!==len){ speak('Нужно '+len+' цифры'); return; }
      if(new Set(g).size!==len){ alert('Цифры должны быть разными!'); return; }
      tries++;
      let bulls=0, cows=0;
      for(let i=0;i<len;i++){
        if(g[i]===secret[i]) bulls++;
        else if(secret.includes(g[i])) cows++;
      }
      history.push({g, b:bulls, c:cows});
      if(bulls===len){
        const stars = tries<=4?3:tries<=7?2:1;
        finishGame('bulls',{win:true,stars,scoreForBest:Math.max(0,20-tries),
          title:'Угадал! 🎉', msg:`Число ${secret} за ${tries} ходов`, again:()=>gameBulls(area)});
      }else{
        render();
      }
    }
    render();
  }
}

/* ---------- 2. КРЕСТИКИ-НОЛИКИ (исчезающие фишки) ---------- */
function gameTTT(area){
  chooseLevel(area,'⭕ Крестики-нолики','run',['Легко 🙂','Умный бот 🤖']);
  area.querySelectorAll('.btn-big').forEach((b,i)=> b.onclick=()=>start(i===0?'easy':'hard'));

  function start(mode){
    const PLAYER='❌', BOT='⭕';
    let board=Array(9).fill('');
    let pMoves=[], bMoves=[];   // очереди ходов (для исчезновения)
    let over=false;
    let busy=false;             // Блокировка кликов во время хода бота
    let lastBot=-1;             // Индекс последнего хода бота

    // Нахождение выигрышной комбинации из 3 клеток
    function getWinCombination(b, s){
      const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      return L.find(l=>l.every(i=>b[i]===s)) || null;
    }

    function wins(b,s){
      return !!getWinCombination(b,s);
    }

    function place(i,sym,queue){
      board[i]=sym; queue.push(i);
      if(queue.length>3){ const old=queue.shift(); board[old]=''; }
    }

    // старая фишка, которая исчезнет следующей (для мигания)
    function oldestOf(queue){ return queue.length>=3 ? queue[0] : -1; }

    function botMove(){
      const empty=[...Array(9).keys()].filter(i=>!board[i]);
      if(!empty.length) return -1;
      let move;
      if(mode==='hard'){
        // 1) выиграть
        move=findWinning(BOT,bMoves) ?? findWinning(PLAYER,pMoves) ?? (empty.includes(4)?4:null) ?? pick(empty);
      }else{
        move=pick(empty);
      }
      place(move,BOT,bMoves);
      return move;
    }

    // ищем клетку, поставив куда sym победит (с учётом исчезновения)
    function findWinning(sym,queue){
      const empty=[...Array(9).keys()].filter(i=>!board[i]);
      for(const i of empty){
        const b=board.slice(); const q=queue.slice();
        b[i]=sym; q.push(i);
        if(q.length>3) b[q.shift()]='';
        if(wins(b,sym)) return i;
      }
      return null;
    }

    function render(winCells = null){
      setScore('');
      area.innerHTML=`<p class="hint center">У каждого только 3 фишки! Мигающая исчезнет следующей.</p>`;
      const g=document.createElement('div'); g.className='ttt-board';
      const oldP=oldestOf(pMoves), oldB=oldestOf(bMoves);
      for(let i=0;i<9;i++){
        const c=document.createElement('button');
        c.className='ttt-cell';
        if(i===oldP || i===oldB) c.classList.add('old'); // мигает — исчезнет следующей
        
        // Сбрасываем стили по умолчанию
        c.style.border = '';
        c.style.boxShadow = '';

        // 1. Зелёная обводка для выигрышных клеток
        if(winCells && winCells.includes(i)){
          c.style.border = '4px solid #4caf50';
          c.style.boxShadow = '0 0 10px rgba(76, 175, 80, 0.8)';
        }
        // 2. Оранжевая обводка для последнего хода бота
        else if(i===lastBot){
          c.style.border = '3px solid #ff9800';
          c.style.boxShadow = '0 0 8px rgba(255, 152, 0, 0.6)';
        }

        c.textContent=board[i];
        c.onclick=()=>human(i);
        g.appendChild(c);
      }
      area.appendChild(g);
    }

    function human(i){
      if(over || busy || board[i]) return;
      
      lastBot = -1; // Стираем подсветку прошлого хода бота
      place(i,PLAYER,pMoves);
      
      const winComb = getWinCombination(board, PLAYER);
      if(winComb){ 
        end(true, winComb); 
        return; 
      }
      
      render();

      // Ход бота через 500мс
      busy = true;
      setTimeout(() => {
        const move = botMove();
        lastBot = move; // Запоминаем ход бота
        
        const botComb = getWinCombination(board, BOT);
        if(botComb){
          busy = false;
          end(false, botComb);
          return;
        }
        
        busy = false;
        render();
      }, 500);
    }

    function end(win, winCells){
      over=true;
      render(winCells); // Сразу перерисовываем доску с зелёной обводкой линии

      // Задержка: 3500мс при победе бота, 1000мс при победе игрока
      const delay = win ? 1000 : 3500;

      setTimeout(() => {
        finishGame('ttt',{win, stars:win?3:1,
          title: win?'Ты выиграл! 🎉':'Бот хитрый! Попробуй ещё!',
          emoji: win?'🏆':'🤖',
          msg: win?'Отличная стратегия!':'В следующий раз получится!',
          again:()=>gameTTT(area)});
      }, delay);
    }
    render();
  }
}

/* ---------- 3. МАТЕМАТИЧЕСКИЕ ГОНКИ ---------- */
function gameRace(area){
  chooseLevel(area,'🏎️ Математические гонки', start);

  function genQ(level){
    let a,b,op,ans;
    if(level===1){ // в пределах 20, +/-
      op=pick(['+','-']);
      if(op==='+'){ a=rnd(1,15); b=rnd(1,20-a); ans=a+b; }
      else { a=rnd(2,20); b=rnd(1,a); ans=a-b; }
    }else if(level===2){ // до 100, + - и таблица умножения
      op=pick(['+','-','×']);
      if(op==='×'){ a=rnd(2,9); b=rnd(2,9); ans=a*b; }
      else if(op==='+'){ a=rnd(10,60); b=rnd(5,40); ans=a+b; }
      else { a=rnd(20,99); b=rnd(5,a-1); ans=a-b; }
    }else{ // 3 класс: × ÷ до 100
      op=pick(['×','÷','+','-']);
      if(op==='×'){ a=rnd(2,12); b=rnd(2,9); ans=a*b; }
      else if(op==='÷'){ ans=rnd(2,9); b=rnd(2,9); a=ans*b; }
      else if(op==='+'){ a=rnd(50,400); b=rnd(20,300); ans=a+b; }
      else { a=rnd(100,900); b=rnd(20,a-1); ans=a-b; }
    }
    // варианты ответов
    const opts=new Set([ans]);
    while(opts.size<4){ opts.add(ans+rnd(-5,5)); }
    return {prompt:`${a} ${op} ${b} = ?`, answer:ans, options:[...opts].filter(x=>x>=0)};
  }

  function start(level){
    let myPos=0, botPos=0, score=0;
    const GOAL=8; // правильных ответов до финиша
    let botTimer=null;

    function render(){
      setScore('🏁 '+score+'/'+GOAL);
      area.innerHTML=`
        <div class="race-track"><span class="racer" id="me">🏎️</span><span class="race-finish">🏁</span></div>
        <div class="race-track"><span class="racer" id="bot">🚗</span><span class="race-finish">🏁</span></div>
        <div id="qbox" class="center"></div>`;
      $('me').style.left = (myPos/GOAL*88)+'%';
      $('bot').style.left = (botPos/GOAL*88)+'%';
      ask();
    }

    function ask(){
      const q=genQ(level);
      const box=$('qbox');
      box.innerHTML=`<div class="prompt">${q.prompt}</div>`;
      speak(q.prompt.replace('×','умножить').replace('÷','разделить'));
      const row=document.createElement('div'); row.className='row';
      shuffle(q.options).forEach(o=>{
        const b=document.createElement('button');
        b.className='tile opt'; b.textContent=o;
        b.onclick=()=>{
          [...row.children].forEach(c=>c.disabled=true);
          if(o===q.answer){
            b.classList.add('correct'); myPos++; score++; speak('Молодец!');
          }else{
            b.classList.add('wrong'); speak('Не верно');
          }
          setTimeout(()=>{
            if(myPos>=GOAL){ win(true); return; }
            render();
          },550);
        };
        row.appendChild(b);
      });
      box.appendChild(row);
    }

    // бот едет сам по таймеру (скорость зависит от уровня)
    function startBot(){
      const speed = level===1?5200 : level===2?4200 : 3500;
      botTimer=setInterval(()=>{
        botPos++;
        const be=$('bot'); if(be) be.style.left=(botPos/GOAL*88)+'%';
        if(botPos>=GOAL){ win(false); }
      }, speed);
    }

    function win(meWon){
      clearInterval(botTimer);
      const stars=meWon?3:1;
      finishGame('race',{win:meWon,stars,scoreForBest:score,
        title: meWon?'Ты первый! 🏆':'Машинка догнала! Ещё разок?',
        emoji: meWon?'🏎️':'🚗',
        msg:`Правильных ответов: ${score}`,
        again:()=>gameRace(area)});
    }

    render();
    startBot();
  }
}

/* ---------- 4. НАЙДИ ПАРУ (мемори с примерами) ---------- */
function gameMemory(area){
  chooseLevel(area,'🃏 Найди пару',start,['4 пары 🙂','6 пар 😎','8 пар 🤩']);
  area.querySelectorAll('.btn-big').forEach((b,i)=> b.onclick=()=>start([4,6,8][i]));

  function start(pairs){
    // генерируем пары пример↔ответ
    const cards=[];
    const used=new Set();
    while(cards.length < pairs*2){
      const a=rnd(2,9), b=rnd(2,9), op=pick(['+','-']);
      let res = op==='+'? a+b : a-b;
      if(res<0){ continue; }
      if(used.has(res)) continue; // уникальные ответы, чтобы пары не путались
      used.add(res);
      const ex = `${a}${op}${b}`;
      cards.push({key:res, txt:ex, type:'ex'});
      cards.push({key:res, txt:String(res), type:'ans'});
    }
    const deck=shuffle(cards);
    let open=[], matched=0, moves=0, lock=false;

    function render(){
      setScore('Ходов: '+moves);
      area.innerHTML=`<p class="hint center">Соедини пример с ответом!</p>`;
      const grid=document.createElement('div');
      grid.className='memory-grid';
      const cols = pairs<=4?4 : pairs<=6?4 : 4;
      grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
      deck.forEach((c,i)=>{
        const b=document.createElement('button');
        b.className='mem-card';
        if(c.done){ b.classList.add('done'); b.textContent=c.txt; }
        else if(open.includes(i)){ b.classList.add('open'); b.textContent=c.txt; }
        else { b.textContent='?'; }
        b.onclick=()=>flip(i);
        grid.appendChild(b);
      });
      area.appendChild(grid);
    }

    function flip(i){
      if(lock || open.includes(i) || deck[i].done) return;
      open.push(i);
      render();
      if(open.length===2){
        moves++;
        const [a,b]=open;
        if(deck[a].key===deck[b].key && deck[a].type!==deck[b].type){
          deck[a].done=deck[b].done=true; matched++;
          open=[]; speak('Пара!');
          render();
          if(matched===pairs){
            const stars=moves<=pairs+2?3:moves<=pairs*2?2:1;
            finishGame('memory',{win:true,stars,scoreForBest:Math.max(0,40-moves),
              title:'Все пары найдены! 🎉',msg:`Ходов: ${moves}`,
              again:()=>gameMemory(area)});
          }
        }else{
          lock=true;
          setTimeout(()=>{ open=[]; lock=false; render(); },800);
        }
      }
    }
    render();
  }
}

/* ---------- 5. ЧИСЛОВЫЕ РЯДЫ ---------- */
function gameSeq(area){
  chooseLevel(area,'🔢 Числовые ряды',start);

  function genSeq(level){
    let start, step, len=5;
    if(level===1){ step=pick([1,2,2,5]); start=rnd(1,5); }
    else if(level===2){ step=pick([2,3,4,5,10]); start=rnd(1,10); }
    else { step=pick([3,4,6,7,8,9,11]); start=rnd(2,15); }
    const seq=[];
    for(let i=0;i<len;i++) seq.push(start+step*i);
    const answer=seq[len-1];
    seq[len-1]='?';
    // варианты
    const opts=new Set([answer]);
    while(opts.size<4){ opts.add(answer+pick([-step,step,1,-1,step*2,-2])); }
    return {prompt:seq.join(',  '), answer, options:[...opts].filter(x=>x>0)};
  }

  function start(level){
    const qs=[];
    for(let i=0;i<6;i++) qs.push(genSeq(level));
    runQuiz(area,'seq',qs,{regen:()=>{ const a=[];for(let i=0;i<6;i++)a.push(genSeq(level));return a;}});
  }
}

/* ---------- 6. СПАСИ КОТЁНКА (угадай слово) ---------- */
function gameCat(area){
  const flowers=['🌸','🌸','🌸','🌸','🌸','🌸']; // лепестки/жизни
  start();

  function start(){
    const item=pick(WORDS);
    const word=item.w;
    const guessed=new Set();
    const wrong=new Set();
    let lives=6;

    const ALPHA='АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'.split('');

    function masked(){
      return word.split('').map(ch=> guessed.has(ch)?ch:'_').join(' ');
    }
    function flowerView(){
      // цветок теряет лепестки
      return '🌼'.repeat(lives) + '🥀'.repeat(6-lives);
    }

    function render(){
      setScore('❤️ '+lives);
      area.innerHTML=`
        <div class="center">
          <p class="hint">Подсказка: ${item.cat}</p>
          <div style="font-size:2rem;margin:8px">${flowerView()}</div>
          <div class="prompt" style="letter-spacing:4px">${masked()}</div>
        </div>`;
      const kb=document.createElement('div'); kb.className='row';
      ALPHA.forEach(ch=>{
        const b=document.createElement('button');
        b.className='tile';
        b.style.minWidth='44px'; b.style.minHeight='44px'; b.style.fontSize='1.1rem';
        b.textContent=ch;
        if(guessed.has(ch)){ b.classList.add('correct'); b.disabled=true; }
        if(wrong.has(ch)){ b.classList.add('wrong'); b.disabled=true; }
        b.onclick=()=>guess(ch);
        kb.appendChild(b);
      });
      area.appendChild(kb);
    }

    function guess(ch){
      if(word.includes(ch)){
        guessed.add(ch); speak('Есть буква '+ch);
        if(word.split('').every(c=>guessed.has(c))){
          finishGame('cat',{win:true,stars:lives>=4?3:lives>=2?2:1,scoreForBest:lives,
            title:'Котёнок спасён! 🐱🎉',msg:'Слово: '+word,
            again:()=>gameCat(area)});
          return;
        }
      }else{
        wrong.add(ch); lives--; speak('Нет такой буквы');
        if(lives<=0){
          finishGame('cat',{win:false,stars:0,
            title:'Цветок завял! Попробуй ещё 💪',emoji:'🌱',
            msg:'Слово было: '+word, again:()=>gameCat(area)});
          return;
        }
      }
      render();
    }
    render();
  }
}

/* ---------- 7. СОСТАВЬ СЛОВО (анаграммы) ---------- */
function gameAnagram(area){
  let round=0, correct=0;
  const TOTAL=6;
  start();

  function start(){
    if(round>=TOTAL){
      const stars=correct>=TOTAL?3:correct>=TOTAL*0.6?2:correct>0?1:0;
      finishGame('anagram',{win:correct>=TOTAL*0.6,stars,scoreForBest:correct,
        title:'Игра окончена!',msg:`Собрано слов: ${correct} из ${TOTAL}`,
        again:()=>gameAnagram(area)});
      return;
    }
    round++;
    const item=pick(WORDS.filter(o=>o.w.length>=4 && o.w.length<=6));
    const word=item.w;
    let letters=shuffle(word.split(''));
    // гарантируем перемешанность
    if(letters.join('')===word) letters=shuffle(letters);
    let built=[];

    function render(){
      setScore(round+'/'+TOTAL);
      area.innerHTML=`
        <div class="center">
          <p class="hint">Подсказка: ${item.cat}</p>
          <p class="hint">Собери слово из букв:</p>
          <div class="prompt" id="builtBox" style="min-height:50px;letter-spacing:4px">${built.join('')||'…'}</div>
        </div>`;
      const pool=document.createElement('div'); pool.className='row';
      letters.forEach((ch,i)=>{
        const b=document.createElement('button');
        b.className='tile'; b.textContent=ch;
        if(usedIdx.has(i)){ b.disabled=true; b.style.opacity=.3; }
        b.onclick=()=>{ built.push(ch); usedIdx.add(i); check(); };
        pool.appendChild(b);
      });
      area.appendChild(pool);
      const ctrl=document.createElement('div'); ctrl.className='row';
      ctrl.innerHTML=`<button id="undo" class="btn btn-soft">⬅ Стереть</button>
        <button id="skip" class="btn btn-soft">Пропустить ⏭</button>`;
      area.appendChild(ctrl);
      $('undo').onclick=()=>{ if(built.length){ built.pop(); // вернуть последнюю использованную
          const arr=[...usedIdx]; usedIdx.delete(arr[arr.length-1]); render(); } };
      $('skip').onclick=()=>{ speak('Слово было '+word); start(); };
    }
    const usedIdx=new Set();

    function check(){
      if(built.length===word.length){
        if(built.join('')===word){
          correct++; speak('Верно! '+word);
          finishMini(true);
        }else{
          speak('Не то слово, попробуй снова');
          built=[]; usedIdx.clear(); render();
        }
      }else render();
    }
    function finishMini(ok){
      setScore(round+'/'+TOTAL);
      area.innerHTML=`<div class="center"><div class="prompt">✅ ${word}</div>
        <p class="big">Отлично!</p></div>`;
      setTimeout(start,900);
    }
    render();
  }
}

/* ---------- 8. ЛОГИЧЕСКИЕ ВЕСЫ ---------- */
function gameScales(area){
  chooseLevel(area,'⚖️ Логические весы',start);

  function genQ(level){
    const fruit=pick(['🍎','🍌','🍐','🍓','🍊','🍇']);
    let val,prompt,answer;
    if(level===1){
      // 🍎 + 🍎 = 8, 🍎 = ?
      val=rnd(2,6);
      prompt=`${fruit} + ${fruit} = ${val*2}<br>${fruit} = ?`;
      answer=val;
    }else if(level===2){
      // 🍎 * 3 = 15
      val=rnd(2,8); const k=rnd(2,4);
      prompt=`${fruit.repeat(k)} = ${val*k}<br>${fruit} = ?`;
      answer=val;
    }else{
      // 🍎 + 🍎 + 🍌 = ... two unknowns simplified: 🍌 known
      val=rnd(2,9); const other=rnd(2,6);
      prompt=`🍌 = ${other}<br>${fruit} + ${fruit} + 🍌 = ${val*2+other}<br>${fruit} = ?`;
      answer=val;
    }
    const opts=new Set([answer]);
    while(opts.size<4) opts.add(answer+rnd(-3,3));
    return {prompt, answer, options:[...opts].filter(x=>x>0)};
  }

  function start(level){
    const qs=[]; for(let i=0;i<6;i++) qs.push(genQ(level));
    runQuiz(area,'scales',qs,{regen:()=>{const a=[];for(let i=0;i<6;i++)a.push(genQ(level));return a;}});
  }
}

/* ---------- 9. СУДОКУ 4×4 ---------- */
function gameSudoku(area){
  // готовые решённые сетки 4х4 (блоки 2х2, числа 1-4)
  const SOLUTIONS=[
    [1,2,3,4, 3,4,1,2, 2,1,4,3, 4,3,2,1],
    [2,1,4,3, 4,3,2,1, 1,2,3,4, 3,4,1,2],
    [1,3,2,4, 2,4,1,3, 3,1,4,2, 4,2,3,1],
    [4,2,1,3, 1,3,4,2, 2,4,3,1, 3,1,2,4],
    [3,4,1,2, 1,2,3,4, 4,3,2,1, 2,1,4,3],
  ];
  start();

  function start(){
    const sol=pick(SOLUTIONS);
    // прячем часть клеток (6-8 пустых)
    const holes=rnd(6,8);
    const hideIdx=shuffle([...Array(16).keys()]).slice(0,holes);
    const puzzle=sol.map((v,i)=> hideIdx.includes(i)?0:v);
    const cur=puzzle.slice();
    let selected=-1;

    function render(){
      const filled=cur.filter((v,i)=>v!==0).length;
      setScore(filled+'/16');
      area.innerHTML=`<p class="hint center">Заполни так, чтобы в каждой строке, столбце и квадрате 2×2 были числа 1–4.</p>`;
      const grid=document.createElement('div'); grid.className='sudoku-grid';
      cur.forEach((v,i)=>{
        const c=document.createElement('button');
        c.className='su-cell';
        if(puzzle[i]!==0) c.classList.add('fixed');
        if(i===selected) c.classList.add('sel');
        // подсветка ошибок
        if(v!==0 && !validAt(cur,i,v)) c.classList.add('err');
        c.textContent=v||'';
        c.onclick=()=>{ if(puzzle[i]===0){ selected=i; render(); } };
        grid.appendChild(c);
      });
      area.appendChild(grid);
      // цифровая клавиатура
      const kb=document.createElement('div'); kb.className='row';
      [1,2,3,4].forEach(n=>{
        const b=document.createElement('button'); b.className='tile opt'; b.textContent=n;
        b.onclick=()=>setNum(n);
        kb.appendChild(b);
      });
      const er=document.createElement('button'); er.className='tile'; er.textContent='⌫';
      er.onclick=()=>setNum(0);
      kb.appendChild(er);
      area.appendChild(kb);
    }

    function setNum(n){
      if(selected<0 || puzzle[selected]!==0) return;
      cur[selected]=n;
      if(cur.every((v,i)=>v===sol[i])){
        finishGame('sudoku',{win:true,stars:3,scoreForBest:1,
          title:'Судоку решено! 🧩🎉',msg:'Все числа на местах!',
          again:()=>gameSudoku(area)});
        return;
      }
      render();
    }

    // проверка: нет ли повтора числа v в строке/столбце/блоке клетки i
    function validAt(b,i,v){
      const r=Math.floor(i/4), c=i%4;
      for(let x=0;x<4;x++){
        if(x!==c && b[r*4+x]===v) return false;
        if(x!==r && b[x*4+c]===v) return false;
      }
      const br=Math.floor(r/2)*2, bc=Math.floor(c/2)*2;
      for(let dr=0;dr<2;dr++)for(let dc=0;dc<2;dc++){
        const j=(br+dr)*4+(bc+dc);
        if(j!==i && b[j]===v) return false;
      }
      return true;
    }
    render();
  }
}

/* ---------- 10. ЧТО ЛИШНЕЕ ---------- */
function gameOdd(area){
  // банк заданий: 3 из одной категории + 1 лишний
  const BANK=[
    {items:['🍎','🍌','🍐','🚗'], odd:'🚗', why:'это не фрукт'},
    {items:['🐶','🐱','🐰','🌳'], odd:'🌳', why:'это не животное'},
    {items:['🔴','🔵','🟢','⭐'], odd:'⭐', why:'это не круг'},
    {items:['🚗','🚕','🚌','🍎'], odd:'🍎', why:'это не транспорт'},
    {items:['1','3','5','8'], odd:'8', why:'остальные нечётные'},
    {items:['2','4','6','7'], odd:'7', why:'остальные чётные'},
    {items:['🌸','🌷','🌹','🐝'], odd:'🐝', why:'это не цветок'},
    {items:['👕','👖','🧦','🍕'], odd:'🍕', why:'это не одежда'},
    {items:['☀️','🌙','⭐','🐟'], odd:'🐟', why:'это не на небе'},
        {items:['🍓','🍒','🍅','🚲'], odd:'🚲', why:'это не красное и не еда'},
    {items:['🐟','🐠','🐬','🐦'], odd:'🐦', why:'это не живёт в воде'},
    {items:['10','20','30','25'], odd:'25', why:'остальные делятся на 10'},
    {items:['🍴','🥄','🔪','✏️'], odd:'✏️', why:'это не посуда'},
    {items:['🎸','🥁','🎺','⚽'], odd:'⚽', why:'это не музыкальный инструмент'},
  ];

  let round=0, correct=0;
  const TOTAL=6;
  const pool=shuffle(BANK);
  start();

  function start(){
    if(round>=TOTAL){
      const stars=correct>=TOTAL?3:correct>=TOTAL*0.6?2:correct>0?1:0;
      finishGame('odd',{win:correct>=TOTAL*0.6,stars,scoreForBest:correct,
        title:'Игра окончена!',msg:`Правильно: ${correct} из ${TOTAL}`,
        again:()=>gameOdd(area)});
      return;
    }
    const q=pool[round % pool.length];
    round++;
    setScore(round+'/'+TOTAL);
    area.innerHTML=`<div class="center"><p class="hint">Что здесь лишнее?</p></div>`;
    const row=document.createElement('div'); row.className='row';
    shuffle(q.items).forEach(it=>{
      const b=document.createElement('button');
      b.className='tile'; b.style.fontSize='2.2rem'; b.textContent=it;
      b.onclick=()=>{
        [...row.children].forEach(c=>c.disabled=true);
        if(it===q.odd){
          b.classList.add('correct'); correct++; speak('Верно! '+q.why);
        }else{
          b.classList.add('wrong'); speak('Лишнее другое: '+q.why);
          [...row.children].forEach(c=>{ if(c.textContent===q.odd) c.classList.add('correct'); });
        }
        setTimeout(start,1100);
      };
      row.appendChild(b);
    });
    area.appendChild(row);
    const w=document.createElement('p'); w.className='hint'; w.id='whyBox';
    area.appendChild(w);
  }
}

/* ---------- 11. ЧАСИКИ (определи время) ---------- */
function gameClock(area){
  chooseLevel(area,'🕒 Часики',start,['Целые часы 🙂','Полчаса 😎','Любое время 🤓']);
  area.querySelectorAll('.btn-big').forEach((b,i)=> b.onclick=()=>start(i+1));

  function genTime(level){
    let h=rnd(1,12), m;
    if(level===1) m=0;
    else if(level===2) m=pick([0,30]);
    else m=pick([0,5,10,15,20,25,30,35,40,45,50,55]);
    return {h,m};
  }

  function timeStr(t){
    const mm=String(t.m).padStart(2,'0');
    return `${t.h}:${mm}`;
  }

  function start(level){
    const qs=[];
    for(let i=0;i<6;i++){
      const t=genTime(level);
      const ans=timeStr(t);
      const opts=new Set([ans]);
      while(opts.size<4){
        const f=genTime(level);
        opts.add(timeStr(f));
      }
      qs.push({t, answer:ans, options:[...opts]});
    }
    run(0,0);

    function run(idx,correct){
      if(idx>=qs.length){
        const stars=correct>=qs.length?3:correct>=qs.length*0.6?2:correct>0?1:0;
        finishGame('clock',{win:correct>=qs.length*0.6,stars,scoreForBest:correct,
          title:'Готово!',msg:`Правильно: ${correct} из ${qs.length}`,
          again:()=>gameClock(area)});
        return;
      }
      const q=qs[idx];
      setScore((idx+1)+'/'+qs.length);
      area.innerHTML=`<p class="hint center">Сколько времени показывают часы?</p>`;
      area.appendChild(drawClock(q.t));
      speak('Сколько времени?');
      const row=document.createElement('div'); row.className='row';
      shuffle(q.options).forEach(o=>{
        const b=document.createElement('button');
        b.className='tile opt'; b.textContent=o;
        b.onclick=()=>{
          [...row.children].forEach(c=>c.disabled=true);
          let cor=correct;
          if(o===q.answer){ b.classList.add('correct'); cor++; speak('Верно!'); }
          else { b.classList.add('wrong'); speak('Правильно: '+q.answer);
            [...row.children].forEach(c=>{ if(c.textContent===q.answer) c.classList.add('correct'); }); }
          setTimeout(()=>run(idx+1,cor),1000);
        };
        row.appendChild(b);
      });
      area.appendChild(row);
    }
  }

  // рисуем аналоговые часы стрелками
  function drawClock(t){
    const c=document.createElement('div'); c.className='clock';
    // цифры 1..12
    for(let n=1;n<=12;n++){
      const ang=n*30*Math.PI/180;
      const num=document.createElement('div');
      num.className='num';
      num.textContent=n;
      const R=78;
      num.style.left=(100+Math.sin(ang)*R)+'px';
      num.style.top=(100-Math.cos(ang)*R)+'px';
      c.appendChild(num);
    }
    const hAng=(t.h%12)*30 + t.m*0.5;   // часовая
    const mAng=t.m*6;                    // минутная
    const hh=document.createElement('div'); hh.className='hand hour';
    hh.style.transform=`translateX(-50%) rotate(${hAng}deg)`;
    const mh=document.createElement('div'); mh.className='hand minute';
    mh.style.transform=`translateX(-50%) rotate(${mAng}deg)`;
    const dot=document.createElement('div'); dot.className='dot';
    c.appendChild(hh); c.appendChild(mh); c.appendChild(dot);
    // часы 200px → центр 100px; но в media-query 170px. Используем относительный фон.
    c.style.width='200px'; c.style.height='200px';
    return c;
  }
}

/* ---------- 12. БОЛЬШЕ / МЕНЬШЕ ---------- */
function gameCompare(area){
  chooseLevel(area,'⚜️ Больше или меньше',start);

  function genPair(level){
    let max = level===1?20 : level===2?100 : 1000;
    let a=rnd(0,max), b=rnd(0,max);
    return {a,b};
  }

  function start(level){
    let round=0, correct=0;
    const TOTAL=8;
    next();

    function next(){
      if(round>=TOTAL){
        const stars=correct>=TOTAL?3:correct>=TOTAL*0.6?2:correct>0?1:0;
        finishGame('compare',{win:correct>=TOTAL*0.6,stars,scoreForBest:correct,
          title:'Отлично!',msg:`Правильно: ${correct} из ${TOTAL}`,
          again:()=>gameCompare(area)});
        return;
      }
      round++;
      const {a,b}=genPair(level);
      const right = a>b?'>' : a<b?'<' : '=';
      setScore(round+'/'+TOTAL);
      area.innerHTML=`<p class="hint center">Какой знак поставить?</p>
        <div class="prompt">${a} <span id="signSlot">❓</span> ${b}</div>`;
      speak(`${a} или ${b}`);
      const row=document.createElement('div'); row.className='row';
      ['<','=','>'].forEach(sign=>{
        const btn=document.createElement('button');
        btn.className='tile opt'; btn.style.fontSize='2rem'; btn.textContent=sign;
        btn.onclick=()=>{
          [...row.children].forEach(c=>c.disabled=true);
          $('signSlot').textContent=sign;
          if(sign===right){ btn.classList.add('correct'); correct++; speak('Верно!'); }
          else{ btn.classList.add('wrong'); speak('Правильный знак '+right);
            [...row.children].forEach(c=>{ if(c.textContent===right) c.classList.add('correct'); }); }
          setTimeout(next,900);
        };
        row.appendChild(btn);
      });
      area.appendChild(row);
    }
  }
}

/* ---------- 13. МАГАЗИН (посчитай сдачу) ---------- */
function gameShop(area){
  chooseLevel(area,'💰 Магазин',start);

  const GOODS=['🍎','🍌','🍭','🍪','🧃','🍦','🎈','✏️','📕','🧸'];

  function genQ(level){
    let priceMax = level===1?10 : level===2?50 : 100;
    const item=pick(GOODS);
    const price=rnd(1,priceMax);
    // платим круглой суммой больше цены
    let pay;
    if(level===1) pay = price + rnd(1,10);
    else pay = Math.ceil((price+rnd(1,20))/10)*10;
    const change=pay-price;
    const opts=new Set([change]);
    while(opts.size<4) opts.add(Math.max(0,change+rnd(-5,5)));
    return {prompt:`${item} стоит ${price} 🪙<br>Ты дал ${pay} 🪙.<br>Сколько сдачи?`,
            answer:change, options:[...opts]};
  }

  function start(level){
    const qs=[]; for(let i=0;i<6;i++) qs.push(genQ(level));
    runQuiz(area,'shop',qs,{regen:()=>{const a=[];for(let i=0;i<6;i++)a.push(genQ(level));return a;}});
  }
}

/* ---------- 14. ЧЕТЫРЕ В РЯД ---------- */
function gameConnect4(area){
  chooseLevel(area,'🔴 Четыре в ряд', null, ['Легко 🙂','Средне 😎','Умный бот 🤖']);
  area.querySelectorAll('.btn-big').forEach((b,i)=> b.onclick=()=>start(['easy','medium','hard'][i]));

  const ROWS=6, COLS=7;
  const PLAYER=1, BOT=2;       // 1 — игрок (🔴), 2 — бот (🟡)
  const SYM={0:'', 1:'🔴', 2:'🟡'};

  function start(mode){
    let board=Array(ROWS*COLS).fill(0);
    let over=false, busy=false;
	let lastBot=-1;

    const at=(r,c)=> board[r*COLS+c];
    const setAt=(r,c,v)=> board[r*COLS+c]=v;

    // в какую строку упадёт фишка в столбце c (или -1, если столбец полон)
    function dropRow(b,c){
      for(let r=ROWS-1;r>=0;r--){ if(b[r*COLS+c]===0) return r; }
      return -1;
    }

    // проверка победы: вернуть массив выигрышных индексов или null
    function findWin(b,sym){
      const dirs=[[0,1],[1,0],[1,1],[1,-1]];
      for(let r=0;r<ROWS;r++){
        for(let c=0;c<COLS;c++){
          if(b[r*COLS+c]!==sym) continue;
          for(const [dr,dc] of dirs){
            const cells=[r*COLS+c];
            let rr=r+dr, cc=c+dc;
            while(rr>=0&&rr<ROWS&&cc>=0&&cc<COLS&&b[rr*COLS+cc]===sym){
              cells.push(rr*COLS+cc);
              if(cells.length===4) return cells;
              rr+=dr; cc+=dc;
            }
          }
        }
      }
      return null;
    }

    function boardFull(b){ return b.every(v=>v!==0); }
    function validCols(b){ const a=[]; for(let c=0;c<COLS;c++) if(dropRow(b,c)>=0) a.push(c); return a; }

    // имитировать ход (вернуть новую доску)
    function play(b,c,sym){ const nb=b.slice(); const r=dropRow(nb,c); if(r<0) return null; nb[r*COLS+c]=sym; return nb; }

    /* --- ИИ бота --- */
    function botPick(){
      const cols=validCols(board);
      if(!cols.length) return -1;

      // 1) выиграть сразу
      for(const c of cols){ const nb=play(board,c,BOT); if(nb&&findWin(nb,BOT)) return c; }
      // 2) заблокировать немедленный выигрыш игрока
      for(const c of cols){ const nb=play(board,c,PLAYER); if(nb&&findWin(nb,PLAYER)) return c; }

      if(mode==='easy') return pick(cols);

      // не подставляться: исключаем ходы, после которых игрок выиграет сверху
      const safe=cols.filter(c=>{
        const nb=play(board,c,BOT);
        const r2=dropRow(nb,c);
        if(r2<0) return true;
        const nb2=play(nb,c,PLAYER);
        return !(nb2 && findWin(nb2,PLAYER));
      });
      const choice = safe.length?safe:cols;

      if(mode==='medium'){
        // medium: один уровень вперёд + защита от открытых троек
        let best=choice[0], bestScore=-Infinity;
        for(const c of choice){
          const nb=play(board,c,BOT);
          const sc=evaluate(nb)+(3-Math.abs(c-3));
          if(sc>bestScore){ bestScore=sc; best=c; }
        }
        return best;
      }

      // hard: minimax с альфа-бета отсечением
      const DEPTH=5; // глубина просчёта (ходов вперёд)
      let best=choice[0], bestScore=-Infinity;
      // порядок: сначала центр — улучшает отсечение
      const ordered=[...choice].sort((a,b)=>Math.abs(a-3)-Math.abs(b-3));
      for(const c of ordered){
        const nb=play(board,c,BOT);
        const sc=minimax(nb, DEPTH-1, -Infinity, Infinity, false);
        if(sc>bestScore){ bestScore=sc; best=c; }
      }
      return best;
    }

    // minimax: maximizing — ход бота, иначе ход игрока
    function minimax(b, depth, alpha, beta, maximizing){
      const botWin=findWin(b,BOT);
      if(botWin) return 100000+depth;        // быстрее выиграть — лучше
      const plWin=findWin(b,PLAYER);
      if(plWin) return -100000-depth;          // дольше продержаться — лучше
      if(boardFull(b)) return 0;
      if(depth===0) return evaluate(b);

      const cols=validCols(b);
      const ordered=cols.sort((a,c)=>Math.abs(a-3)-Math.abs(c-3));

      if(maximizing){
        let val=-Infinity;
        for(const c of ordered){
          const nb=play(b,c,BOT);
          val=Math.max(val, minimax(nb, depth-1, alpha, beta, false));
          alpha=Math.max(alpha,val);
          if(alpha>=beta) break;               // отсечение
        }
        return val;
      }else{
        let val=Infinity;
        for(const c of ordered){
          const nb=play(b,c,PLAYER);
          val=Math.min(val, minimax(nb, depth-1, alpha, beta, true));
          beta=Math.min(beta,val);
          if(alpha>=beta) break;               // отсечение
        }
        return val;
      }
    }

    // оценка позиции: считаем все «окна» из 4 клеток
    function evaluate(b){
      let score=0;
      const dirs=[[0,1],[1,0],[1,1],[1,-1]];
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        for(const [dr,dc] of dirs){
          const rr=r+3*dr, cc=c+3*dc;
          if(rr<0||rr>=ROWS||cc<0||cc>=COLS) continue;
          let bot=0,pl=0,empty=0;
          for(let k=0;k<4;k++){
            const v=b[(r+k*dr)*COLS+(c+k*dc)];
            if(v===BOT)bot++; else if(v===PLAYER)pl++; else empty++;
          }
          if(bot>0&&pl>0) continue;            // линия смешанная — нейтральна
          if(bot===3&&empty===1) score+=120;
          else if(bot===2&&empty===2) score+=15;
          else if(bot===1&&empty===3) score+=2;
          if(pl===3&&empty===1) score-=150;    // угроза игрока опаснее
          else if(pl===2&&empty===2) score-=20;
          else if(pl===1&&empty===3) score-=2;
        }
      }
      return score;
    }

    function render(winCells){
      setScore('');
      area.innerHTML=`<p class="hint center">Ты 🔴, бот 🟡. Собери 4 фишки в ряд: по горизонтали, вертикали или диагонали!</p>`;

      // кнопки-стрелки для столбцов
      const ctrl=document.createElement('div'); ctrl.className='c4-controls';
      for(let c=0;c<COLS;c++){
        const b=document.createElement('button');
        b.className='c4-drop'; b.textContent='⬇';
        if(over || dropRow(board,c)<0) b.disabled=true;
        b.onclick=()=>human(c);
        ctrl.appendChild(b);
      }
      area.appendChild(ctrl);

      const grid=document.createElement('div'); grid.className='c4-board';
      for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){
        const idx=r*COLS+c;
        const cell=document.createElement('div');
        cell.className='c4-cell';
        const v=at(r,c);
        if(v) { cell.classList.add('filled'); cell.textContent=SYM[v]; }
        if(idx===lastBot && !(winCells && winCells.includes(idx))) cell.classList.add('c4-last'); // ← последний ход бота
        if(winCells && winCells.includes(idx)) cell.classList.add('c4-win');
        grid.appendChild(cell);
      }
      area.appendChild(grid);
    }

    function human(c){
      if(over || busy) return;
      const r=dropRow(board,c);
      if(r<0) return;
      lastBot=-1;                    // ← убираем подсветку, пока ходит игрок
      setAt(r,c,PLAYER);
      const win=findWin(board,PLAYER);
      if(win){ end('win',win); return; }
      if(boardFull(board)){ end('draw'); return; }
      // ход бота с небольшой задержкой
      busy=true; render(); speak('Хм...');
      setTimeout(()=>{
        const bc=botPick();
        if(bc>=0){
          const br=dropRow(board,bc);
          setAt(br,bc,BOT);
          lastBot=br*COLS+bc;        // ← запоминаем, куда поставил бот
          const bwin=findWin(board,BOT);
          if(bwin){ busy=false; end('lose',bwin); return; }
        }
        busy=false;
        if(boardFull(board)){ end('draw'); return; }
        render();
      }, 500);
    }

    function end(result, winCells){
      over=true;
      render(winCells);              // сразу показываем доску с выигрышной линией

      // озвучиваем результат сразу, а плашку показываем с задержкой,
      // чтобы игрок успел рассмотреть выигрышную линию
      const delay = result==='draw' ? 800 : 3500;
      if(result==='win')  speak('Ты собрал четыре в ряд!');
      else if(result==='lose') speak('Бот собрал четыре в ряд!');
      else speak('Ничья!');

      setTimeout(()=>{
        if(result==='win'){
          finishGame('connect4',{win:true, stars:mode==='hard'?3:mode==='medium'?2:1, scoreForBest:1,
            title:'Ты собрал 4 в ряд! 🎉', emoji:'🏆',
            msg:'Отличная стратегия!', again:()=>gameConnect4(area)});
        }else if(result==='lose'){
          finishGame('connect4',{win:false, stars:0,
            title:'Бот собрал 4 в ряд! 🤖', emoji:'🟡',
            msg:'Попробуй закрывать его линии!', again:()=>gameConnect4(area)});
        }else{
          finishGame('connect4',{win:false, stars:1,
            title:'Ничья! 🤝', emoji:'🤝',
            msg:'Поле заполнено. Сыграем ещё?', again:()=>gameConnect4(area)});
        }
      }, delay);
    }

    render();
  }
}

/* ============================================================
   15. ЛАЗЕРНЫЙ ЛАБИРИНТ
   ============================================================
   Сетка N×N. Источник лазера светит в одну сторону, нужно
   расставить зеркала (/ и \), чтобы довести луч до приёмника,
   обходя чёрные блоки. Зеркало ставится кликом по пустой клетке,
   повторный клик меняет / ↔ \, третий — убирает.
   ============================================================ */
function gameLaser(area){
  chooseLevel(area,'🔦 Лазерный лабиринт', start,
    ['Лёгкий 🙂 (5×5)','Средний 😎 (6×6)','Сложный 🤓 (7×7)']);

  // Направления: вектор (dr, dc)
  const DIRS = {
    up:    [-1, 0],
    down:  [ 1, 0],
    left:  [ 0,-1],
    right: [ 0, 1]
  };

  // Правила отражения зеркал.
  // '/'  : right->up, up->right, left->down, down->left
  // '\\' : right->down, down->right, left->up, up->left
  function reflect(mirror, dir){
    if(mirror==='/'){
      return {right:'up', up:'right', left:'down', down:'left'}[dir];
    }else{ // '\'
      return {right:'down', down:'right', left:'up', up:'left'}[dir];
    }
  }

  function mirrorForTurn(incoming, outgoing){
    const pairs = {
      right:{up:'/', down:'\\'},
      left:{down:'/', up:'\\'},
      up:{right:'/', left:'\\'},
      down:{left:'/', right:'\\'}
    };
    return pairs[incoming][outgoing];
  }

  function manhattan(a,b){
    return Math.abs(a.r-b.r)+Math.abs(a.c-b.c);
  }

  function buildSolutionPath(source, requiredMirrors, minDistance, size){
    const pathCells = [];
    const mirrors = [];
    let r=source.r, c=source.c;
    let dir=source.dir;
    const pathSet = new Set();
    const addCell = (rr,cc)=>{
      const idx=rr*size+cc;
      if(!pathSet.has(idx)){ pathSet.add(idx); pathCells.push(idx); }
    };
    addCell(r,c);

    const turnDirs = {
      up:['left','right'],
      down:['left','right'],
      left:['up','down'],
      right:['up','down']
    };

    for(let m=0;m<requiredMirrors;m++){
      const available = dir==='up' ? r : dir==='down' ? size-1-r : dir==='left' ? c : size-1-c;
      const maxLen = Math.max(2, Math.min(size-2, available));
      if(maxLen < 2) return null;
      const segmentLen = rnd(2, maxLen);
      const next = {r:r+DIRS[dir][0]*segmentLen, c:c+DIRS[dir][1]*segmentLen};
      if(next.r<0 || next.r>=size || next.c<0 || next.c>=size) return null;

      let rr=r, cc=c;
      while(rr!==next.r || cc!==next.c){
        rr += DIRS[dir][0];
        cc += DIRS[dir][1];
        addCell(rr,cc);
      }

      const outgoing = pick(turnDirs[dir]);
      mirrors.push({idx:next.r*size+next.c, mirror:mirrorForTurn(dir, outgoing)});
      r=next.r; c=next.c; dir=outgoing;
    }

    const lastAvailable = dir==='up' ? r : dir==='down' ? size-1-r : dir==='left' ? c : size-1-c;
    const lastMaxLen = Math.max(2, Math.min(size-2, lastAvailable));
    if(lastMaxLen < 2) return null;
    const finalLen = rnd(2, lastMaxLen);
    const target = {r:r+DIRS[dir][0]*finalLen, c:c+DIRS[dir][1]*finalLen};
    if(target.r<0 || target.r>=size || target.c<0 || target.c>=size) return null;

    let rr=r, cc=c;
    while(rr!==target.r || cc!==target.c){
      rr += DIRS[dir][0];
      cc += DIRS[dir][1];
      addCell(rr,cc);
    }

    if(manhattan(source,target) < minDistance) return null;
    return {pathCells: pathCells, mirrorCells: mirrors, target};
  }

  function start(level){
    const N = level===1?5 : level===2?6 : 7;
    const requiredMirrors = level===1?1 : level===2?2 : 3;
    const minTargetDistance = level===1?4 : level===2?5 : 6;

    // Типы клеток: 'empty' | 'block' | 'mirror'
    // grid[i] = {type, mirror?: '/'|'\\'}
    let grid, source, target, mirrorsAllowed;

    function genLevel(){
      for(let attempt=0; attempt<500; attempt++){
        grid = Array(N*N).fill(0).map(()=>({type:'block'}));

        // Источник — на краю, светит внутрь
        const edges = [];
        for(let c=0;c<N;c++){ edges.push({r:0,c,dir:'down'}); edges.push({r:N-1,c,dir:'up'}); }
        for(let r=0;r<N;r++){ edges.push({r,c:0,dir:'right'}); edges.push({r,c:N-1,dir:'left'}); }
        source = pick(edges);

        const solution = buildSolutionPath(source, requiredMirrors, minTargetDistance, N);
        if(!solution) continue;

        const pathCells = new Set(solution.pathCells);
        const pathArray = [...pathCells];
        pathArray.forEach(idx=>{ grid[idx].type='empty'; });
        grid[source.r*N+source.c].type='empty';

        target = solution.target;
        const targetIdx = target.r*N+target.c;
        grid[targetIdx].type='empty';

        const freeCells = [];
        for(let i=0;i<N*N;i++) if(!pathCells.has(i)) freeCells.push(i);
        shuffle(freeCells).slice(0, Math.max(0, Math.min(freeCells.length, rnd(4, Math.min(10, freeCells.length))))).forEach(i=> grid[i].type='empty');
        freeCells.forEach(i=>{ if(grid[i].type!=='empty') grid[i].type='block'; });

        mirrorsAllowed = solution.mirrorCells.length;
        const test = grid.map(g=>({...g}));
        solution.mirrorCells.forEach(({idx, mirror})=>{ test[idx]={type:'mirror', mirror}; });
        if(traceHitsTarget(test)) return true;
      }
      return false;
    }

    function traceHitsTarget(g){
      const path = traceBeam(g);
      const last = path.length ? path[path.length-1] : null;
      return last && last.r===target.r && last.c===target.c && last.hit===true;
    }

    function traceBeam(g){
      const segs=[];
      let r=source.r, c=source.c, dir=source.dir;
      let steps=0, max=N*N*4;
      segs.push({r,c,dir, hit:false});
      while(steps++<max){
        const cur=g[r*N+c];
        if(cur && cur.type==='mirror'){
          dir = reflect(cur.mirror, dir);
        }
        const [dr,dc]=DIRS[dir];
        const nr=r+dr, nc=c+dc;
        if(nr<0||nr>=N||nc<0||nc>=N) break;
        const ncell=g[nr*N+nc];
        if(ncell.type==='block'){ break; }
        r=nr; c=nc;
        const isTarget = (r===target.r && c===target.c);
        segs.push({r,c,dir, hit:isTarget});
        if(isTarget) break;
      }
      return segs;
    }

    if(!genLevel()){
      grid=Array(N*N).fill(0).map(()=>({type:'empty'}));
      source={r:0,c:0,dir:'down'};
      target={r:N-1,c:0};
      mirrorsAllowed=1;
    }

    let started=false;
    let beamSegs=[];

    function placedMirrors(){
      return grid.filter(g=>g.type==='mirror').length;
    }

    function render(){
      setScore('Зеркал: '+placedMirrors()+'/'+mirrorsAllowed);
      area.innerHTML=`<p class="hint center">Клик по клетке ставит зеркало. Ещё клики: / → \\ → убрать.<br>
        Доведи 🔦 луч до 🎯, обойди ⬛. Нужно зеркал: ${mirrorsAllowed}.</p>`;

      const wrap=document.createElement('div');
      wrap.className='laser-grid';
      wrap.style.gridTemplateColumns=`repeat(${N},1fr)`;

      const beamSet=new Map();
      beamSegs.forEach(s=> beamSet.set(s.r*N+s.c, s.dir));

      for(let i=0;i<N*N;i++){
        const r=Math.floor(i/N), c=i%N;
        const cell=document.createElement('button');
        cell.className='laser-cell';
        const g=grid[i];

        if(r===source.r && c===source.c){
          cell.classList.add('laser-src');
          const arrowMap = { up: '↑', down: '↓', left: '←', right: '→' };
          const dirArrow = arrowMap[source.dir] || '';
          cell.textContent = '🔦' + dirArrow;
          cell.title = 'Направление: ' + (source.dir || '');
          cell.disabled = true;
        }
        else if(r===target.r && c===target.c){
          cell.classList.add('laser-tgt');
          cell.textContent='🎯';
          cell.onclick=()=>toggleMirror(i);
        }
        else if(g.type==='block'){
          cell.classList.add('laser-block');
          cell.textContent='⬛';
          cell.disabled=true;
        }
        else {
          if(g.type==='mirror'){
            cell.classList.add('laser-mirror');
            cell.textContent = g.mirror==='/' ? '╱' : '╲';
          }
          cell.onclick=()=>toggleMirror(i);
        }

        if(beamSet.has(i)){
          cell.classList.add('laser-beam');
        }

        wrap.appendChild(cell);
      }
      area.appendChild(wrap);

      const ctrl=document.createElement('div'); ctrl.className='row';
      ctrl.innerHTML=`<button id="laserStart" class="btn btn-green">▶ СТАРТ</button>
        <button id="laserClear" class="btn btn-soft">🧹 Очистить</button>`;
      area.appendChild(ctrl);
      $('laserStart').onclick=fire;
      $('laserClear').onclick=()=>{ grid.forEach(g=>{ if(g.type==='mirror') g.type='empty'; }); beamSegs=[]; render(); };
    }

    function toggleMirror(i){
      if(started) return;
      const g=grid[i];
      if(g.type==='block') return;
      if(g.type==='empty'){
        if(placedMirrors()>=mirrorsAllowed){ speak('Зеркала закончились'); return; }
        g.type='mirror'; g.mirror='/';
      } else if(g.type==='mirror'){
        if(g.mirror==='/') g.mirror='\\';
        else { g.type='empty'; delete g.mirror; }
      }
      render();
    }

    function fire(){
      started=true;
      const segs=traceBeam(grid);
      beamSegs=[];
      let k=0;
      const timer=setInterval(()=>{
        if(k>=segs.length){
          clearInterval(timer);
          const last=segs[segs.length-1];
          const win = last && last.r===target.r && last.c===target.c && last.hit;
          started=false;
          if(win){
            speak('Есть попадание!');
            finishGame('laser',{win:true, stars:3, scoreForBest:1,
              title:'Луч попал в цель! 🎯🎉', emoji:'🔦',
              msg:'Отличное пространственное мышление!',
              again:()=>gameLaser(area)});
          }else{
            speak('Луч не дошёл до цели. Попробуй переставить зеркала.');
            setTimeout(()=>{ beamSegs=[]; render(); }, 1200);
          }
          return;
        }
        beamSegs.push(segs[k]);
        k++;
        render();
      }, 120);
    }

    render();
  }
}

/* ============================================================
   16. ЗАХВАТ ЧИСЕЛ (The Factor Game)
   ============================================================
   Поле чисел 1..MAX. Игрок выбирает число (получает его очки),
   компьютер забирает все оставшиеся делители (получает их сумму).
   Ход допустим, только если у числа есть хотя бы один доступный
   делитель на поле. Затем ходит компьютер по той же логике.
   ============================================================ */
function gameFactor(area){
  chooseLevel(area,'♟️ Захват чисел', start,
    ['до 16 🙂','до 25 😎','до 30 🤓']);

  function divisorsOf(n){
    const d=[];
    for(let i=1;i<n;i++) if(n%i===0) d.push(i); // собственные делители (без самого n)
    return d;
  }

  function start(level){
    const MAX = level===1?16 : level===2?25 : 30;

    // taken[n] = 0 свободно, 1 — игрок, 2 — компьютер
    const taken = Array(MAX+1).fill(0);
    let pScore=0, cScore=0;
    let turn='player';   // 'player' | 'cpu'
    let busy=false;
    const history=[];

    // Доступные делители числа n на текущем поле
    function availDivisors(n){
      return divisorsOf(n).filter(d=> d<=MAX && taken[d]===0);
    }
    // Можно ли выбрать число n (свободно и есть хоть один делитель)
    function isLegal(n){
      return taken[n]===0 && availDivisors(n).length>0;
    }
    function anyLegalMove(){
      for(let n=2;n<=MAX;n++) if(isLegal(n)) return true;
      return false;
    }

    function render(msg){
      setScore(`Ты ${pScore} : ${cScore} 🤖`);
      area.innerHTML=`<div class="center">
        <p class="hint">Выбери число — заберёшь его очки. 🤖 заберёт сумму его делителей.<br>
        Нельзя брать число без свободных делителей!</p>
        <p class="big" id="factorTurn">${msg||(turn==='player'?'Твой ход 👇':'Ход компьютера…')}</p>
      </div>`;

      if(history.length){
        const log=document.createElement('div');
        log.style.marginTop='8px';
        history.forEach(entry=>{
          const p=document.createElement('p');
          p.className='hint';
          p.textContent=entry;
          log.appendChild(p);
        });
        area.appendChild(log);
      }

      const grid=document.createElement('div'); grid.className='factor-grid';
      const cols = MAX<=16?4 : 5;
      grid.style.gridTemplateColumns=`repeat(${cols},1fr)`;
      for(let n=1;n<=MAX;n++){
        const b=document.createElement('button');
        b.className='factor-cell';
        b.textContent=n;
        if(taken[n]===1) b.classList.add('mine');
        else if(taken[n]===2) b.classList.add('cpu');
        else if(turn==='player' && isLegal(n)) b.classList.add('legal');
        else if(turn==='player') b.classList.add('illegal');

        if(taken[n]===0 && turn==='player' && !busy){
          b.onclick=()=>playerPick(n);
        }
        grid.appendChild(b);
      }
      area.appendChild(grid);

      // легенда
      const leg=document.createElement('p'); leg.className='hint center';
      leg.innerHTML=`🟩 можно взять · 🟦 твои · 🟧 компьютера · ⬜ нельзя`;
      area.appendChild(leg);
    }

    function playerPick(n){
      if(busy || turn!=='player' || !isLegal(n)){
        if(taken[n]===0 && !isLegal(n)) speak('У этого числа нет свободных делителей');
        return;
      }
      busy=true;
      // игрок берёт n
      taken[n]=1; pScore+=n;
      const divs=availDivisors(n);
      const divSum=divs.reduce((a,b)=>a+b,0);
      // компьютер забирает делители
      divs.forEach(d=>{ taken[d]=2; cScore+=d; });
      const playerLine=`Ты выбрал ${n}. Бот получил ${divs.join(' + ')} = ${divSum}`;
      history.push(playerLine);
      speak(`Ты взял ${n}. Компьютер забрал ${divs.join(', ')}`);
      render(`Ты взял ${n} (+${n}). 🤖 забрал делители (+${divSum})`);

      setTimeout(()=>{
        if(!anyLegalMove()){ finish(); return; }
        turn='cpu';
        busy=false;
        cpuTurn();
      }, 1300);
    }

    function cpuTurn(){
      busy=true;
      render('Ход компьютера… 🤔');
      setTimeout(()=>{
        // CPU выбирает число, максимизируя (его очки - очки игрока за этот ход)
        let best=-1, bestVal=-Infinity;
        for(let n=2;n<=MAX;n++){
          if(taken[n]!==0) continue;
          const divs=divisorsOf(n).filter(d=>taken[d]===0);
          if(divs.length===0) continue; // нельзя
          const gain = n;                         // получит CPU
          const give = divs.reduce((a,b)=>a+b,0); // отдаст игроку
          const val = gain - give;
          if(val>bestVal){ bestVal=val; best=n; }
        }
        if(best<0){ finish(); return; }

        // CPU берёт best
        taken[best]=2; cScore+=best;
        const divs=divisorsOf(best).filter(d=>taken[d]===0);
        const divSum=divs.reduce((a,b)=>a+b,0);
        divs.forEach(d=>{ taken[d]=1; pScore+=d; });
        const cpuLine=`Бот выбрал ${best}. Ты получил ${divs.join(' + ')} = ${divSum}`;
        history.push(cpuLine);
        speak(`Компьютер взял ${best}. Тебе достались делители ${divs.join(', ')}`);
        render(`🤖 взял ${best} (+${best}). Тебе делители (+${divSum})`);

        setTimeout(()=>{
          turn='player';
          busy=false;
          if(!anyLegalMove()){ finish(); return; }
          render();
        }, 1300);
      }, 900);
    }

    function finish(){
      const win = pScore>cScore;
      const tie = pScore===cScore;
      finishGame('factor',{
        win,
        stars: win?3 : tie?1 : 1,
        scoreForBest: pScore,
        title: win?'Победа! ♟️🎉' : tie?'Ничья! 🤝' : 'Компьютер выиграл 🤖',
        emoji: win?'🏆' : tie?'🤝' : '🤖',
        msg:`Итог: ты ${pScore} — ${cScore} компьютер`,
        again:()=>gameFactor(area)
      });
    }

    render();
  }
}

/* ============================================================
   17. СЛОВЕСНЫЙ СДВИГ (Word Slide)
   ============================================================
   Поле 4×4 из букв. Игрок циклически сдвигает строки (◀▶) и
   столбцы (▲▼). Цель — собрать слова из словаря по горизонтали
   за ограниченное число сдвигов. Собранные слова "застывают".
   ============================================================ */
function gameWordSlide(area){
  // Наборы по 4 слова из 4 букв — буквы каждого набора в сумме
  // раскладываются в поле 4×4 (каждое слово = строка решения).
  const PUZZLES = [
    ['МИРА','ЛЕТО','СОВА','РУКА'],
    ['КОТЫ','ЛУНА','РЕКА','СОМЫ'],
    ['ДОМА','ГОРА','НЕБО','ЛИСА'],
    ['РОZA'.replace('Z','З'),'ВОДА','МЫLO'.replace('L','Л'),'СЫРЫ'],
    ['ПОLE'.replace('L','Л'),'СЕNO'.replace('N','Н'),'ГРАD'.replace('D','Д'),'ВЕТЕ'],
  ];

  // словарь допустимых слов для проверки (можно расширять)
  const VALID = new Set();
  PUZZLES.forEach(p=>p.forEach(w=>VALID.add(w)));
  // немного дополнительных слов из 4 букв
  ['ЗИМА','СОLЬ'.replace('L','Л'),'МОRE'.replace('R','Р'),'ПАRК'.replace('R','Р'),
   'СТОL'.replace('L','Л'),'КНИГ','РОТА','НОRA'.replace('R','Р')].forEach(w=>VALID.add(w));

  const SIZE=4;
  const MOVES_LIMIT=12;

  function start(){
    const puzzle = pick(PUZZLES); // 4 целевых слова (строки)
    // Стартовое поле = буквы решения, перемешанные сдвигами
    let grid = puzzle.map(w=>w.split('')); // [row][col]

    // Перемешаем случайными сдвигами, чтобы было решаемо
    for(let k=0;k<rnd(8,14);k++){
      if(Math.random()<0.5){
        const r=rnd(0,SIZE-1); shiftRow(grid, r, Math.random()<0.5?1:-1);
      }else{
        const c=rnd(0,SIZE-1); shiftCol(grid, c, Math.random()<0.5?1:-1);
      }
    }

    let movesLeft=MOVES_LIMIT;
    let found=Array(SIZE).fill(false); // зафиксированные строки
    let score=0;

    function shiftRow(g, r, dir){
      const row=g[r];
      if(dir>0){ row.unshift(row.pop()); }      // вправо
      else { row.push(row.shift()); }            // влево
    }
    function shiftCol(g, c, dir){
      const col=[]; for(let r=0;r<SIZE;r++) col.push(g[r][c]);
      if(dir>0){ col.unshift(col.pop()); }       // вниз
      else { col.push(col.shift()); }            // вверх
      for(let r=0;r<SIZE;r++) g[r][c]=col[r];
    }

    function rowWord(r){ return grid[r].join(''); }

    function checkRows(){
      let newly=0;
      for(let r=0;r<SIZE;r++){
        if(!found[r] && VALID.has(rowWord(r))){
          found[r]=true; newly++; score++;
          speak('Слово '+rowWord(r));
        }
      }
      return newly;
    }

    function allFound(){ return found.every(Boolean); }

    function doMove(type, idx, dir){
      if(movesLeft<=0) return;
      // нельзя двигать зафиксированную строку
      if(type==='row' && found[idx]){ speak('Эта строка уже собрана'); return; }
      // нельзя двигать столбец, если он задевает зафиксированную строку
      if(type==='col'){
        for(let r=0;r<SIZE;r++){
          if(found[r]){ speak('Нельзя — задевает собранное слово'); return; }
        }
      }

      if(type==='row') shiftRow(grid, idx, dir);
      else shiftCol(grid, idx, dir);

      movesLeft--;
      const newly=checkRows();
      if(newly>0){
        addStars(newly); // маленькая награда за каждое слово
      }

      if(allFound()){
        render();
        finishGame('wslide',{
          win:true, stars:3, scoreForBest:score,
          title:'Все слова собраны! 🔡🎉', emoji:'🏆',
          msg:`Собрано слов: ${score}. Осталось ходов: ${movesLeft}`,
          again:()=>gameWordSlide(area)
        });
        return;
      }
      if(movesLeft<=0){
        render();
        const win = score>0;
        finishGame('wslide',{
          win,
          stars: score>=3?3 : score>=2?2 : score>=1?1:0,
          scoreForBest:score,
          title: win?'Ходы закончились!':'Не получилось… 💪',
          emoji: win?'🔡':'🧩',
          msg:`Собрано слов: ${score} из ${SIZE}`,
          again:()=>gameWordSlide(area)
        });
        return;
      }
      render();
    }

    function render(){
      setScore('Ходы: '+movesLeft+' · Слов: '+score+'/'+SIZE);
      area.innerHTML=`<p class="hint center">Сдвигай строки ◀▶ и столбцы ▲▼, чтобы собрать слова по горизонтали.<br>
        Собранные слова застывают 🟡. Осталось ходов: <b>${movesLeft}</b>.</p>`;

      const wrap=document.createElement('div');
      wrap.className='wslide-wrap';

      // Верхний ряд: кнопки ▲ для столбцов
      const topRow=document.createElement('div'); topRow.className='wslide-controls-top';
      topRow.appendChild(spacer()); // угол
      for(let c=0;c<SIZE;c++){
        const b=arrowBtn('▲', ()=>doMove('col', c, -1));
        topRow.appendChild(b);
      }
      topRow.appendChild(spacer());
      wrap.appendChild(topRow);

      // Средние ряды: ◀ [4 буквы] ▶
      for(let r=0;r<SIZE;r++){
        const line=document.createElement('div'); line.className='wslide-line';
        line.appendChild(arrowBtn('◀', ()=>doMove('row', r, -1), found[r]));
        for(let c=0;c<SIZE;c++){
          const cell=document.createElement('div');
          cell.className='wslide-cell';
          if(found[r]) cell.classList.add('gold');
          cell.textContent=grid[r][c];
          line.appendChild(cell);
        }
        line.appendChild(arrowBtn('▶', ()=>doMove('row', r, 1), found[r]));
        wrap.appendChild(line);
      }

      // Нижний ряд: кнопки ▼ для столбцов
      const botRow=document.createElement('div'); botRow.className='wslide-controls-top';
      botRow.appendChild(spacer());
      for(let c=0;c<SIZE;c++){
        const b=arrowBtn('▼', ()=>doMove('col', c, 1));
        botRow.appendChild(b);
      }
      botRow.appendChild(spacer());
      wrap.appendChild(botRow);

      area.appendChild(wrap);

      // подсказка со словами-целями
      const hint=document.createElement('p'); hint.className='hint center';
      hint.style.fontSize='.85rem';
      hint.textContent='Спрятаны слова из 4 букв. Например: '+puzzle.slice(0,2).join(', ')+'…';
      area.appendChild(hint);
    }

    function spacer(){
      const s=document.createElement('div');
      s.className='wslide-spacer';
      return s;
    }
    function arrowBtn(txt, fn, disabled){
      const b=document.createElement('button');
      b.className='wslide-arrow';
      b.textContent=txt;
      if(disabled){ b.disabled=true; b.style.opacity=.25; }
      else b.onclick=fn;
      return b;
    }

    // первичная проверка (вдруг при перемешивании уже собралось слово)
    checkRows();
    render();
  }

  start();
}

/* ============================================================
   8) ИНИЦИАЛИЗАЦИЯ
   ============================================================ */

// --- Экран профиля ---
function initProfileScreen(){
  const grid=$('avatarGrid');
  let chosen=DATA.profile.avatar||'🦊';
  grid.innerHTML='';
  AVATARS.forEach(a=>{
    const b=document.createElement('button');
    b.textContent=a;
    if(a===chosen) b.classList.add('sel');
    b.onclick=()=>{
      chosen=a;
      [...grid.children].forEach(c=>c.classList.remove('sel'));
      b.classList.add('sel');
    };
    grid.appendChild(b);
  });
  $('nameInput').value=DATA.profile.name||'';
  $('startBtn').onclick=()=>{
    const name=$('nameInput').value.trim()||'Друг';
    DATA.profile={name, avatar:chosen};
    saveData();
    goHome();
  };
}

function goHome(){
  updateHeader();
  renderGames();
  renderAchievements();
  showScreen('screen-home');
  speak('Привет, '+(DATA.profile.name||'друг')+'! Выбери игру.');
}

// --- Кнопки навигации и настроек ---
function initControls(){
  // Назад из игры
  $('backBtn').onclick=()=>{ try{speechSynthesis.cancel();}catch(e){} goHome(); };

  // Модалка результата
  $('modalBack').onclick=()=>{ closeModal(); goHome(); };
  $('modalAgain').onclick=()=>{ closeModal(); if(_againCb) _againCb(); };

  // Настройки
  $('settingsBtn').onclick=openSettings;
  $('closeSettings').onclick=()=>$('settingsModal').classList.add('hidden');
  $('soundToggle').onchange=e=>{ DATA.soundOn=e.target.checked; saveData();
    if(DATA.soundOn) speak('Звук включён'); };
  $('resetBtn').onclick=()=>{
    if(confirm('Точно сбросить весь прогресс и звёзды? 😢')){
      const name=DATA.profile.name, av=DATA.profile.avatar;
      DATA=defaultData();
      DATA.profile={name, avatar:av};
      saveData();
      $('settingsModal').classList.add('hidden');
      goHome();
      alert('Прогресс сброшен. Начинаем сначала! 🌱');
    }
  };
}

function openSettings(){
  $('soundToggle').checked=DATA.soundOn;
  $('statsMini').innerHTML=`
    ⭐ Звёзд: <b>${DATA.stars}</b><br>
    🎮 Сыграно партий: <b>${DATA.played}</b><br>
    🏅 Достижений: <b>${DATA.achievements.length} из ${ACHIEVEMENTS.length}</b>`;
  $('settingsModal').classList.remove('hidden');
}

// --- Старт приложения ---
function init(){
  initControls();
  if(DATA.profile && DATA.profile.name){
    goHome();
  }else{
    initProfileScreen();
    showScreen('screen-profile');
  }
}

// «Разогрев» голосов для Web Speech (некоторые браузеры грузят асинхронно)
if('speechSynthesis' in window){
  speechSynthesis.onvoiceschanged=()=>{};
}

document.addEventListener('DOMContentLoaded', init);