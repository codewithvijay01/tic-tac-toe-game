const clickSound = new Audio("click.mp3");
const winSound = new Audio("Victory.mp3");
const boxes = [...document.querySelectorAll(".box")];
const $ = selector => document.querySelector(selector);
const levelButtons = [...document.querySelectorAll(".level-btn")];
const levels = [
  { name: "Easy", hint: "AI random moves karegi — practice ke liye best.", mode: "easy" },
  { name: "Medium", hint: "AI jeetne aur rokne ki koshish karegi, par galti bhi karegi.", mode: "medium" },
  { name: "Hard", hint: "AI perfect strategy khelegi — draw karna bhi achievement hai.", mode: "hard" }
];
const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const puzzles = [
  ["X","O","X","X","O","","","",""],
  ["O","O","","X","X","","","", ""],
  ["X","","X","O","O","","","", ""],
  ["","","","X","X","","O","O", ""]
];
let level = 0;
let board = Array(9).fill("");
let turn = "O", gameOver = false, aiThinking = false, history = [];
let replayMoves = [], replayStart = Array(9).fill("");
let lastReplay = null;
let mode = "ai", seriesLength = 1, scores = { O: 0, X: 0, draw: 0 };
let soundOn = true;
let dailyGame = false;
let stats = { wins:0, losses:0, draws:0, streak:0, best:0, daily:"" };
let wallet = { xp:0, coins:0 };
let replayTimer = null;
let unlocks = { themes:["ocean"], boards:["classic"] };
let profileId = "";
let profiles = JSON.parse(localStorage.getItem("tttProfiles") || "{}");
let aiTimer = null;
let bossWins = 0, badges = [];
const bosses = [
  { name:"The Gatekeeper", rule:"Center tile locked", blocked:[4], desc:"The center is sealed. Find a winning path around it.", badge:"🔐 Gatekeeper" },
  { name:"The Corner King", rule:"Opposite corners locked", blocked:[0,8], desc:"Two corners are off-limits. The boss is smarter this time.", badge:"👑 Corner King" },
  { name:"The Twin Titan", rule:"Side tiles locked", blocked:[1,7], desc:"Top and bottom edges are blocked. Beat the strongest arena AI.", badge:"⚡ Twin Titan" }
];

function saveProfile() {
  if (!profileId) return;
  profiles[profileId] = {
    ...(profiles[profileId] || {}), level, stats, wallet, unlocks, soundOn, mode, seriesLength, scores, bossWins, badges,
    theme: document.body.dataset.theme || "ocean", boardSkin: document.body.dataset.board || "classic", lastReplay,
    savedGame: { board:[...board], turn, gameOver, mode, seriesLength, scores:{...scores}, history:history.map(h=>({board:[...h.board],turn:h.turn})), replayMoves:replayMoves.map(m=>({mark:m.mark,board:[...m.board]})), replayStart:[...replayStart], dailyGame }
  };
  localStorage.setItem("tttProfiles", JSON.stringify(profiles));
}
function loadProfile(id) {
  profileId = id;
  const p = profiles[id];
  level = p.level || 0; stats = p.stats || {wins:0,losses:0,draws:0,streak:0,best:0,daily:""};
  wallet = p.wallet || {xp:0,coins:0}; unlocks = p.unlocks || {themes:["ocean"],boards:["classic"]};
  bossWins=p.bossWins||0;badges=p.badges||[];
  soundOn = p.soundOn !== false; mode = p.mode || "ai"; seriesLength = p.seriesLength || 1; scores = p.scores || {O:0,X:0,draw:0};
  lastReplay = p.lastReplay || null;
  $("#profile-name").textContent = p.name; $("#profile-tag").textContent = `@${id}`;
  $("#mode-select").value = mode; $("#series-select").value = String(seriesLength);
  $("#series-label").classList.toggle("hide",mode==="daily");
  $("#player-o-name").textContent=mode==="local"?"Player O":"You (O)"; $("#player-x-name").textContent=mode==="local"?"Player X":"AI (X)";
  $("#level-label").parentElement.parentElement.classList.toggle("hide",mode!=="ai");
  document.body.dataset.theme=p.theme||"ocean"; document.body.dataset.board=p.boardSkin||"classic";
  renderBoss();
  $("#theme-select").value=document.body.dataset.theme; $("#board-select").value=document.body.dataset.board;
  $("#sound-btn").textContent=soundOn?"🔊 Sound on":"🔇 Sound off"; $("#sound-btn").setAttribute("aria-pressed",String(soundOn));
  const saved=p.savedGame;
  if(saved) {
    board=[...saved.board]; turn=saved.turn; gameOver=saved.gameOver; aiThinking=false; history=saved.history||[]; replayMoves=saved.replayMoves||[]; replayStart=saved.replayStart||Array(9).fill(""); dailyGame=saved.dailyGame; scores=saved.scores||scores;
    if(gameOver){$("#msg").textContent="Aapka pichhla round complete hua tha.";$("#reward-msg").textContent="Profile progress save hai.";$("#new-btn").textContent="Agla round";$("#result-dialog").classList.remove("hide");}
  } else startRound(false);
  $("#auth-screen").classList.add("hide"); $("#game-app").classList.remove("hide");
  renderStats(); renderUnlocks(); renderLevel(); renderScore(); renderBoard();
  if(!gameOver && mode!=="local" && turn==="X"){aiThinking=true;renderBoard();aiTimer=setTimeout(aiMove,450);}
  localStorage.setItem("tttLastId",id); saveProfile();
}

function renderLevel() {
  $("#level-label").textContent = `Level ${level + 1}: ${levels[level].name}`;
  $("#level-hint").textContent = levels[level].hint;
  levelButtons.forEach((b, i) => { b.disabled = i > level; b.classList.toggle("active", i === level); b.textContent = `${i > level ? "🔒 " : ""}${levels[i].name}`; });
}
function renderStats() {
  $("#stat-wins").textContent = stats.wins; $("#stat-losses").textContent = stats.losses;
  $("#stat-draws").textContent = stats.draws; $("#stat-streak").textContent = stats.best;
  const rank = wallet.xp >= 500 ? "Arena Legend" : wallet.xp >= 250 ? "Grandmaster" : wallet.xp >= 100 ? "Pro Player" : wallet.xp >= 30 ? "Rising Star" : "Rookie";
  $("#xp-count").textContent = wallet.xp; $("#coin-count").textContent = wallet.coins;
  $("#arena-streak").textContent = `${stats.best} 🔥`; $("#rank-title").textContent = rank; $("#hall-rank").textContent = rank;
  const floor = wallet.xp >= 500 ? 500 : wallet.xp >= 250 ? 250 : wallet.xp >= 100 ? 100 : wallet.xp >= 30 ? 30 : 0;
  const next = wallet.xp >= 500 ? 500 : [30,100,250,500].find(x => x > wallet.xp);
  $("#xp-bar").style.width = `${next === floor ? 100 : ((wallet.xp-floor)/(next-floor))*100}%`;
  $("#xp-next").textContent = wallet.xp >= 500 ? "Max rank reached — Arena Legend!" : `${next-wallet.xp} XP to ${next === 30 ? "Rising Star" : next === 100 ? "Pro Player" : next === 250 ? "Grandmaster" : "Arena Legend"}`;
  $("#hall-record").textContent = `${stats.wins} wins • ${stats.best}-win best streak • ${wallet.coins} coins earned`;
  $("#badge-shelf").innerHTML = badges.map(b=>`<span class="badge">${b}</span>`).join("");
  $("#boss-badge-count").textContent=`${badges.length} / 3 badges`;
}
function renderBoss() {
  const banner=$("#boss-banner"), boss=bosses[bossWins%bosses.length];
  banner.classList.toggle("hide",mode!=="boss");
  if(mode==="boss"){$("#boss-name").textContent=boss.name;$("#boss-rule").textContent=boss.rule;$("#boss-desc").textContent=boss.desc;$("#boss-emoji").textContent=["🛡️","👑","⚡"][bossWins%bosses.length];}
}
function renderUnlocks() {
  const theme = $("#theme-select"), boardSkin = $("#board-select");
  [...theme.options].forEach(o => { const cost = o.value === "sunset" ? 30 : o.value === "forest" ? 60 : 0; const open = unlocks.themes.includes(o.value); o.textContent = `${o.value[0].toUpperCase()+o.value.slice(1)}${open ? "" : ` 🔒 ${cost}🪙`}`; });
  [...boardSkin.options].forEach(o => { const cost = o.value === "neon" ? 40 : o.value === "galaxy" ? 80 : 0; const open = unlocks.boards.includes(o.value); o.textContent = `${o.value[0].toUpperCase()+o.value.slice(1)}${open ? "" : ` 🔒 ${cost}🪙`}`; });
}
function renderScore() {
  $("#score-o").textContent = scores.O; $("#score-x").textContent = scores.X; $("#score-draw").textContent = scores.draw;
  const needed = Math.ceil(seriesLength / 2);
  $("#match-status").textContent = seriesLength === 1 ? "Single round" : `First to ${needed} wins`;
}
function renderBoard() {
  boxes.forEach((b, i) => {
    b.textContent = board[i] === "#" ? "🔒" : board[i]; b.classList.toggle("blocked", board[i] === "#"); b.classList.toggle("o-mark", board[i] === "O"); b.classList.toggle("x-mark", board[i] === "X");
    b.disabled = gameOver || aiThinking || Boolean(board[i]) || (mode !== "local" && turn !== "O");
  });
  $("#status").textContent = gameOver ? "Round complete" : aiThinking ? aiLine() : turn === "O" ? (mode === "local" ? "Player O ki baari" : "Aapki baari — O") : mode === "local" ? "Player X ki baari" : aiLine();
  $("#undo-btn").disabled = !history.length || gameOver || aiThinking;
  $("#replay-btn").disabled = !lastReplay?.moves?.length;
  saveProfile();
}
function aiLine() {
  if (mode === "daily") return "Daily puzzle: winning move dhoondo!";
  const lines = ["AI soch rahi hai…", "Dekhte hain aapki chaal ka jawab…", "AI apni strategy bana rahi hai…"];
  return lines[Math.floor(Math.random() * lines.length)];
}
function startRound(keepScore = true) {
  clearTimeout(aiTimer); aiTimer=null;
  if (!keepScore) scores = { O: 0, X: 0, draw: 0 };
  board = Array(9).fill(""); history = []; replayMoves = []; replayStart = [...board]; turn = "O"; gameOver = false; aiThinking = false; dailyGame = mode === "daily";
  boxes.forEach(b => b.classList.remove("win-box")); $("#result-dialog").classList.add("hide");
  if (dailyGame) {
    const day = Math.floor(Date.now() / 86400000), puzzle = puzzles[day % puzzles.length];
    board = [...puzzle]; replayStart = [...board]; stats.daily = new Date().toISOString().slice(0, 10);
    $("#status").textContent = "Daily puzzle: O ki winning move dhoondo!";
  }
  if(mode==="boss"){
    const boss=bosses[bossWins%bosses.length];boss.blocked.forEach(i=>board[i]="#");replayStart=[...board];
  }
  renderBoss();
  renderBoard(); renderLevel(); renderScore();
}
function winnerOn(state) {
  for (const line of wins) { const [a,b,c] = line; if (state[a] && state[a] === state[b] && state[b] === state[c]) return { mark: state[a], line }; }
  return null;
}
function saveStats(result) {
  if (result === "O") { stats.wins++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); }
  else if (result === "X") { stats.losses++; stats.streak = 0; }
  else { stats.draws++; }
  renderStats();
}
function awardArena(result) {
  const xpGain = result === "O" ? 25 + (level + 1) * 10 : result === "draw" ? 8 : 5;
  const coinGain = result === "O" ? 8 + level * 4 : result === "draw" ? 2 : 1;
  wallet.xp += xpGain; wallet.coins += coinGain;
  renderStats();
  return `+${xpGain} XP  •  +${coinGain} coins`;
}
function endRound(result) {
  gameOver = true; aiThinking = false; scores[result]++;
  lastReplay = { start:[...replayStart], moves:replayMoves.map(move=>({mark:move.mark,board:[...move.board]})), result };
  const matchTarget = Math.ceil(seriesLength / 2);
  const matchWinner = scores.O >= matchTarget ? "O" : scores.X >= matchTarget ? "X" : "";
  let title;
  if (result === "draw") title = "Draw! Ek aur round khelein.";
  else if (matchWinner) title = matchWinner === "O" ? (mode === "local" ? "Player O ne match jeet liya! 🏆" : "Match aapne jeet liya! 🏆") : mode === "local" ? "Player X ne match jeet liya! 🏆" : "AI ne match jeet liya!";
  else title = result === "O" ? (mode === "local" ? "Player O round jeeta!" : "Shabash! Round aapka 🎉") : mode === "local" ? "Player X round jeeta!" : "AI round jeet gayi — dobara koshish karein!";
  if (result !== "draw") { const win = winnerOn(board); win?.line.forEach(i => boxes[i].classList.add("win-box")); }
  saveStats(result);
  if (result === "O" && mode === "ai" && !dailyGame && level < 2) level++;
  let reward = awardArena(result); renderUnlocks();
  if(mode==="boss"&&result==="O"){
    const badge=bosses[bossWins%bosses.length].badge;
    if(!badges.includes(badge))badges.push(badge);
    bossWins++;wallet.xp+=25;wallet.coins+=15;reward+="  •  Boss bonus +25 XP +15 coins";renderStats();
  }
  if (dailyGame && result === "O") { stats.daily = new Date().toISOString().slice(0, 10); title = "Daily challenge complete! Kal phir aana 🌟"; }
  if (result === "O" && soundOn) { winSound.currentTime = 0; winSound.play().catch(() => {}); celebrate(); }
  $(".win-burst").textContent = result === "draw" ? "🤝" : result === "O" ? "🏆" : "💥";
  $("#msg").textContent = title; $("#reward-msg").textContent = reward;
  $("#new-btn").textContent = matchWinner ? "Naya match" : "Agla round";
  $("#result-dialog").classList.remove("hide"); renderBoard(); renderLevel(); renderScore();
}
function checkResult() {
  const win = winnerOn(board);
  if (win) endRound(win.mark);
  else if (board.every(Boolean)) endRound("draw");
}
function winningMove(mark) {
  for (let i=0;i<9;i++) if (!board[i]) { board[i]=mark; const yes=Boolean(winnerOn(board)); board[i]=""; if (yes) return i; }
  return -1;
}
function minimax(state, max, depth=0) {
  const result=winnerOn(state); if(result?.mark==="X")return 10-depth; if(result?.mark==="O")return depth-10; if(state.every(Boolean))return 0;
  let best=max?-Infinity:Infinity;
  for(let i=0;i<9;i++)if(!state[i]){state[i]=max?"X":"O";const s=minimax(state,!max,depth+1);state[i]="";best=max?Math.max(best,s):Math.min(best,s);}
  return best;
}
function hardMove() {
  let best=-Infinity, choices=[];
  for(let i=0;i<9;i++)if(!board[i]){board[i]="X";const s=minimax(board,false);board[i]="";if(s>best){best=s;choices=[i];}else if(s===best)choices.push(i);}
  return choices[Math.floor(Math.random()*choices.length)];
}
function playSound(audio) { if (!soundOn) return; audio.currentTime=0; audio.play().catch(()=>{}); }
function aiMove() {
  aiTimer=null;
  if (gameOver || mode === "local") { aiThinking=false; renderBoard(); return; }
  const empty=board.map((v,i)=>v?-1:i).filter(i=>i>=0); if(!empty.length)return;
  let move;
  if(mode==="boss") {
    const bossIndex=bossWins%bosses.length, optimal=hardMove(), mistakes=bossIndex===0?0.55:bossIndex===1?0.28:0.12;
    move=Math.random()<mistakes?empty[Math.floor(Math.random()*empty.length)]:optimal;
  }
  else if(mode==="daily" || levels[level].mode==="hard") move=hardMove();
  else if(levels[level].mode==="medium") { const win=winningMove("X"), block=winningMove("O"); if(win>=0&&Math.random()<.75)move=win;else if(block>=0&&Math.random()<.75)move=block;else move=empty[Math.floor(Math.random()*empty.length)]; }
  else move=empty[Math.floor(Math.random()*empty.length)];
  board[move]="X"; replayMoves.push({ mark:"X", board:[...board] }); turn="O"; aiThinking=false; playSound(clickSound); checkResult(); renderBoard();
}
function makeMove(index) {
  if (gameOver || aiThinking || board[index] || (mode !== "local" && turn !== "O")) return;
  history.push({ board:[...board], turn }); board[index]=turn; replayMoves.push({ mark:turn, board:[...board] }); playSound(clickSound);
  checkResult(); if(gameOver)return;
  if(mode==="local") turn=turn==="O"?"X":"O";
  else { turn="X"; aiThinking=true; renderBoard(); aiTimer=setTimeout(aiMove,450); }
  renderBoard();
}
boxes.forEach((box,i)=>box.addEventListener("click",()=>makeMove(i)));
$("#undo-btn").addEventListener("click",()=>{
  if(!history.length||gameOver||aiThinking)return;
  const h=history.pop(); board=h.board; turn=mode==="local"?h.turn:"O";
  const initialFilled=replayStart.filter(Boolean).length;
  replayMoves.splice(Math.max(0,board.filter(Boolean).length-initialFilled));
  renderBoard();
});
$("#reset-btn").addEventListener("click",()=>startRound(true));
$("#new-btn").addEventListener("click",()=>{
  const target=Math.ceil(seriesLength/2); if(scores.O>=target||scores.X>=target) startRound(false); else startRound(true);
});
$("#mode-select").addEventListener("change",e=>{
  mode=e.target.value; $("#series-label").classList.toggle("hide",mode==="daily");
  $("#player-o-name").textContent=mode==="local"?"Player O":"You (O)"; $("#player-x-name").textContent=mode==="local"?"Player X":"AI (X)";
  $("#level-label").parentElement.parentElement.classList.toggle("hide",mode!=="ai"); startRound(false);
});
$("#series-select").addEventListener("change",e=>{seriesLength=Number(e.target.value);startRound(false);});
$("#theme-select").addEventListener("change",e=>{
  const value=e.target.value, cost=value==="sunset"?30:value==="forest"?60:0;
  if(!unlocks.themes.includes(value)){if(wallet.coins<cost){alert(`Is theme ko unlock karne ke liye ${cost} coins chahiye.`);e.target.value=document.body.dataset.theme||"ocean";return;}wallet.coins-=cost;unlocks.themes.push(value);}
  document.body.dataset.theme=value;renderStats();renderUnlocks();saveProfile();
});
$("#board-select").addEventListener("change",e=>{
  const value=e.target.value,cost=value==="neon"?40:value==="galaxy"?80:0;
  if(!unlocks.boards.includes(value)){if(wallet.coins<cost){alert(`Is board ko unlock karne ke liye ${cost} coins chahiye.`);e.target.value=document.body.dataset.board||"classic";return;}wallet.coins-=cost;unlocks.boards.push(value);}
  document.body.dataset.board=value;renderStats();renderUnlocks();saveProfile();
});
$("#sound-btn").addEventListener("click",e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?"🔊 Sound on":"🔇 Sound off";e.currentTarget.setAttribute("aria-pressed",String(soundOn));saveProfile();});
levelButtons.forEach(b=>b.addEventListener("click",()=>{const requested=Number(b.dataset.level);if(requested<=level){level=requested;startRound(false);}}));
function celebrate(){const c=$("#confetti");c.classList.remove("hide");c.innerHTML="";for(let i=0;i<30;i++){const s=document.createElement("span");s.textContent="🎉";s.style.left=`${Math.random()*100}%`;s.style.top=`${Math.random()*100+400}px`;s.style.animationDuration=`${Math.random()+1.5}s`;c.appendChild(s);}setTimeout(()=>c.classList.add("hide"),2500);}
function showReplay(step=0){
  const source=lastReplay||{start:replayStart,moves:replayMoves};
  const max=source.moves.length,slider=$("#replay-slider"),grid=$("#replay-board");
  slider.max=String(max);slider.value=String(Math.min(step,max));
  const at=Number(slider.value),state=at===0?[...source.start]:source.moves[at-1].board;
  grid.innerHTML="";state.forEach(mark=>{const cell=document.createElement("div");cell.className=`replay-cell ${mark==="O"?"o-mark":mark==="X"?"x-mark":""}`;cell.textContent=mark;grid.appendChild(cell);});
  $("#replay-caption").textContent=at===0?"Starting position":`Move ${at} of ${max} — ${source.moves[at-1].mark} played`;
  $("#replay-prev").disabled=at===0;$("#replay-next").disabled=at>=max;
}
$("#replay-btn").addEventListener("click",()=>{if(!lastReplay?.moves?.length)return;$("#replay-dialog").classList.remove("hide");showReplay();});
$("#close-replay").addEventListener("click",()=>{clearInterval(replayTimer);replayTimer=null;$("#replay-play").textContent="▶ Play";$("#replay-dialog").classList.add("hide");});
$("#replay-slider").addEventListener("input",e=>showReplay(Number(e.target.value)));
$("#replay-prev").addEventListener("click",()=>showReplay(Number($("#replay-slider").value)-1));
$("#replay-next").addEventListener("click",()=>showReplay(Number($("#replay-slider").value)+1));
$("#replay-play").addEventListener("click",e=>{const replayLength=lastReplay?.moves?.length||0;if(replayTimer){clearInterval(replayTimer);replayTimer=null;e.currentTarget.textContent="▶ Play";}else{if(Number($("#replay-slider").value)>=replayLength)showReplay(0);e.currentTarget.textContent="❚❚ Pause";replayTimer=setInterval(()=>{const at=Number($("#replay-slider").value);if(at>=replayLength){clearInterval(replayTimer);replayTimer=null;e.currentTarget.textContent="▶ Play";}else showReplay(at+1);},700);}});
$("#login-id").value=localStorage.getItem("tttLastId")||"";
document.querySelectorAll(".auth-tab").forEach(tab=>tab.addEventListener("click",()=>{
  const create=tab.dataset.auth==="create";
  document.querySelectorAll(".auth-tab").forEach(t=>t.classList.toggle("active",t===tab));
  $("#login-form").classList.toggle("hide",create);$("#create-form").classList.toggle("hide",!create);$("#auth-message").textContent="";
}));
$("#login-form").addEventListener("submit",e=>{
  e.preventDefault();const id=$("#login-id").value.trim().toLowerCase();
  profiles=JSON.parse(localStorage.getItem("tttProfiles")||"{}");
  if(!profiles[id]){$("#auth-message").textContent="Yeh Player ID nahi mili. Pehle nayi profile banayein.";return;}
  loadProfile(id);
});
$("#create-form").addEventListener("submit",e=>{
  e.preventDefault();const name=$("#create-name").value.trim(),id=$("#create-id").value.trim().toLowerCase();
  if(!/^[a-z0-9_]{3,20}$/.test(id)){$("#auth-message").textContent="Player ID 3–20 letters/numbers/_ ki honi chahiye.";return;}
  profiles=JSON.parse(localStorage.getItem("tttProfiles")||"{}");
  if(profiles[id]){$("#auth-message").textContent="Yeh ID pehle se bani hai. Login tab se kholein.";return;}
  profiles[id]={name,level:0,stats:{wins:0,losses:0,draws:0,streak:0,best:0,daily:""},wallet:{xp:0,coins:0},unlocks:{themes:["ocean"],boards:["classic"]},soundOn:true,mode:"ai",seriesLength:1,scores:{O:0,X:0,draw:0},theme:"ocean",boardSkin:"classic",lastReplay:null,bossWins:0,badges:[],savedGame:null};
  localStorage.setItem("tttProfiles",JSON.stringify(profiles));loadProfile(id);
});
$("#logout-btn").addEventListener("click",()=>{
  saveProfile();clearTimeout(aiTimer);aiTimer=null;aiThinking=false;profileId="";$("#result-dialog").classList.add("hide");$("#game-app").classList.add("hide");$("#auth-screen").classList.remove("hide");
  $("#login-id").value=localStorage.getItem("tttLastId")||"";$("#auth-message").textContent="Profile save ho gayi. Ab doosri ID se login karein.";
});
window.addEventListener("pagehide",saveProfile);
