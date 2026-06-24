import { loadPlayers } from "./csvLoader.js";
import { ABILITIES, createGame, finishGame, highLowResult, placeCurrentPlayer, substituteCurrentPlayer, swapRanks, useAbility } from "./game.js";
import { buildShareText, copyText, twitterIntent } from "./share.js";

const app = document.querySelector("#app");
const modalRoot = document.querySelector("#modal-root");
const toast = document.querySelector("#toast");
const confettiCanvas = document.querySelector("#confetti");
const STORAGE_KEY = "muchiRank";
const PLACEHOLDER = "./assets/placeholder.svg";

const state = {
  players: [],
  game: null,
  score: null,
  rating: null,
  settings: loadStorage(),
  additionalSelection: []
};

init();

async function init() {
  try {
    state.players = await loadPlayers();
    renderHome();
  } catch (error) {
    renderError(error);
  }
}

function loadStorage() {
  const defaults = {
    highScore: 0,
    totalPlayCount: 0,
    dailyBest: 0,
    settings: {
      showFace: true,
      showName: true,
      abilities: {
        ovrOpen: true,
        teamOpen: true,
        highLow: true,
        substitution: true
      }
    }
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...defaults,
      ...saved,
      settings: {
        ...defaults.settings,
        ...(saved.settings || {}),
        abilities: {
          ...defaults.settings.abilities,
          ...(saved.settings?.abilities || {})
        }
      }
    };
  } catch {
    return defaults;
  }
}

function saveStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}

function renderHome() {
  app.innerHTML = `
    <main class="screen home">
      ${logoMarkup()}
      <section class="home-panel" aria-label="ホーム">
        <div class="panel-section button-stack">
          <button class="primary-button" data-action="start-normal" aria-label="通常プレイを開始">通常プレイ</button>
          <button class="secondary-button" data-action="start-daily" aria-label="デイリーチャレンジを開始">デイリーチャレンジ</button>
          <button class="secondary-button" data-action="rules" aria-label="ルール説明を開く">ルール説明</button>
        </div>
        <div class="panel-section">
          <p class="section-title">表示設定</p>
          ${toggleRow("顔表示", "showFace", state.settings.settings.showFace)}
          ${toggleRow("名前表示", "showName", state.settings.settings.showName)}
          <div id="home-error" class="danger-text"></div>
        </div>
        <div class="panel-section">
          <p class="section-title">アビリティ設定</p>
          ${abilityCheckRows()}
        </div>
        <div class="panel-section">
          <div class="stat-row"><span>最高スコア</span><strong>${state.settings.highScore}</strong></div>
          <div class="stat-row"><span>プレイ回数</span><strong>${state.settings.totalPlayCount}</strong></div>
          <div class="stat-row"><span>デイリー最高</span><strong>${state.settings.dailyBest}</strong></div>
        </div>
      </section>
    </main>
  `;

  app.querySelector("[data-action='start-normal']").addEventListener("click", () => startGame("normal"));
  app.querySelector("[data-action='start-daily']").addEventListener("click", () => startGame("daily"));
  app.querySelector("[data-action='rules']").addEventListener("click", showRules);
  bindHomeSettings();
}

function bindHomeSettings() {
  app.querySelectorAll("[data-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.toggle;
      state.settings.settings[key] = !state.settings.settings[key];
      saveStorage();
      renderHome();
    });
  });

  app.querySelectorAll("[data-ability-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      state.settings.settings.abilities[input.dataset.abilitySetting] = input.checked;
      saveStorage();
    });
  });
}

function startGame(mode) {
  const displayValid = state.settings.settings.showFace || state.settings.settings.showName;
  if (!displayValid) {
    app.querySelector("#home-error").textContent = "顔表示と名前表示を両方OFFにはできません。";
    return;
  }

  try {
    state.game = createGame(state.players, mode, state.settings.settings);
    state.score = null;
    state.rating = null;
    state.additionalSelection = [];
    renderPlay();
  } catch (error) {
    showToast(error.message);
  }
}

function renderPlay() {
  const game = state.game;
  const current = game.selectedPlayers[game.currentIndex];
  app.innerHTML = `
    <main class="screen">
      ${topBarMarkup(`${Math.min(game.currentIndex + 1, 10)} / 10`)}
      <section class="play-layout">
        <aside class="panel abilities-panel">
          <h2 class="panel-heading">アビリティ</h2>
          <div class="ability-list">
            ${Object.entries(ABILITIES).map(([key, label]) => abilityButtonMarkup(key, label)).join("")}
          </div>
        </aside>
        <section class="panel player-stage">
          <div class="player-card enter">
            ${playerClueMarkup(current)}
          </div>
        </section>
        <aside class="panel ranking-panel">
          <h2 class="panel-heading">ランキング</h2>
          <div class="ranking-list">
            ${game.playerRanking.map((player, index) => rankSlotMarkup(player, index, "place")).join("")}
          </div>
        </aside>
      </section>
    </main>
  `;

  app.querySelectorAll("[data-rank-place]").forEach((button) => {
    button.addEventListener("click", () => {
      const placed = placeCurrentPlayer(game, Number(button.dataset.rankPlace));
      if (!placed) return;
      if (game.phase === "additional") renderAdditionalTime();
      else renderPlay();
    });
  });

  app.querySelectorAll("[data-ability]").forEach((button) => {
    button.addEventListener("click", () => handleAbility(button.dataset.ability));
  });
}

function handleAbility(ability) {
  const game = state.game;
  const current = game.selectedPlayers[game.currentIndex];
  if (!game.abilities[ability] || game.usedAbilities[ability]) {
    showToast("このアビリティは使用できません。");
    return;
  }

  if (ability === "highLow") {
    const placed = game.playerRanking.filter(Boolean);
    if (!placed.length) {
      showToast("1人目には使用できません。");
      return;
    }
    showHighLowModal(current, placed);
    return;
  }

  if (!useAbility(game, ability)) return;

  if (ability === "ovrOpen") {
    showInfoModal("OVRオープン", `<p class="additional-title">OVR ${current.ovr}</p>`);
  }
  if (ability === "teamOpen") {
    showInfoModal("チームオープン", `
      <div class="team-open">
        ${current.emblem ? imageMarkup(current.emblem, current.club, "team-emblem") : ""}
        <p><strong>${escapeHtml(current.club)}</strong></p>
        <p>${escapeHtml(current.league)}</p>
      </div>
    `);
  }
  if (ability === "substitution") {
    const replacement = substituteCurrentPlayer(game, state.players);
    if (!replacement) {
      game.usedAbilities.substitution = false;
      showToast("同OVRの交代候補がいません。");
      return;
    }
    showInfoModal("SUBSTITUTION", `<p>${escapeHtml(current.name)}</p><p>↓</p><p><strong>${escapeHtml(replacement.name)}</strong></p>`, () => renderPlay());
  }
  renderPlay();
}

function showHighLowModal(current, placed) {
  const rows = placed.map((player) => `
    <button class="rank-slot ${rankColor(0)}" data-high-low="${escapeHtml(String(player.scoreId))}" aria-label="${escapeHtml(player.name)}と比較">
      <span class="rank-number">VS</span>
      ${imageMarkup(player.image, player.name, "rank-face")}
      <span class="rank-name">${escapeHtml(player.name)}</span>
      <span class="rank-ovr">?</span>
    </button>
  `).join("");

  showInfoModal("ハイアンドロー", `<div class="ranking-list">${rows}</div>`);
  modalRoot.querySelectorAll("[data-high-low]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = placed.find((player) => String(player.scoreId) === button.dataset.highLow);
      useAbility(state.game, "highLow");
      showInfoModal("判定", `<p>この選手は</p><p><strong>${escapeHtml(target.name)}</strong>より</p><p class="additional-title">${highLowResult(current, target)}</p>`, () => renderPlay());
    });
  });
}

function renderAdditionalTime() {
  const game = state.game;

  app.innerHTML = `
    <main class="screen additional">
      ${topBarMarkup("ADDITIONAL TIME")}

      <section class="additional-hero">
        <h1 class="additional-title">ADDITIONAL TIME</h1>
        <p>一度だけ選手を入れ替えることができます。選手を2名選択してください。</p>

        <button
          class="secondary-button"
          data-action="finish-additional"
          aria-label="アディショナルタイムを終了して結果を表示"
        >
          アディショナルタイムを終了して結果を表示
        </button>
      </section>

      <section class="panel">
        <div class="ranking-list">
          ${game.playerRanking
            .map((player, index) => rankSlotMarkup(player, index, "swap"))
            .join("")}
        </div>
      </section>

      <section id="swap-modal" class="panel hidden">
        <p id="swap-confirm-message"></p>

        <div class="button-row">
          <button id="confirm-swap" class="primary-button">
            入れ替える
          </button>

          <button id="cancel-swap" class="secondary-button">
            キャンセル
          </button>
        </div>
      </section>
    </main>
  `;

  app
    .querySelector("[data-action='finish-additional']")
    .addEventListener("click", showResult);

  const rankingButtons = app.querySelectorAll("[data-rank-swap]");

  rankingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (game.additionalTimeUsed) return;

      const index = Number(button.dataset.rankSwap);

      const existingIndex =
        state.additionalSelection.indexOf(index);

      // 選択解除
      if (existingIndex !== -1) {
        state.additionalSelection.splice(existingIndex, 1);
        button.classList.remove("selected-slot");
        hideSwapConfirmation();
        return;
      }

      // 3人目は選べない
      if (state.additionalSelection.length >= 2) {
        return;
      }

      // 選択
      state.additionalSelection.push(index);
      button.classList.add("selected-slot");

      // 2人揃ったら確認表示
      if (state.additionalSelection.length === 2) {
        showSwapConfirmation();
      }
    });
  });

  function showSwapConfirmation() {
    const [indexA, indexB] = state.additionalSelection;

    const playerA = game.playerRanking[indexA];
    const playerB = game.playerRanking[indexB];

    const panel =
      document.getElementById("swap-modal");

    const message =
      document.getElementById("swap-confirm-message");

    message.textContent =
      `${playerA.name} と ${playerB.name} を入れ替えて結果を表示しますか？`;

    panel.classList.remove("hidden");

    document
      .getElementById("confirm-swap")
      .addEventListener("click", () => {
        swapRanks(game, indexA, indexB);
        game.additionalTimeUsed = true;
        showResult();
      });

    document
      .getElementById("cancel-swap")
      .addEventListener("click", () => {
        state.additionalSelection = [];

        rankingButtons.forEach((btn) =>
          btn.classList.remove("selected-slot")
        );

        hideSwapConfirmation();
      });
  }

  function hideSwapConfirmation() {
    document
      .getElementById("swap-modal")
      .classList.add("hidden");
  }
}

function showResult() {
  const game = state.game;
  const result = finishGame(game, state.players);
  state.score = result.score;
  state.rating = result.rating;
  state.settings.totalPlayCount += 1;
  state.settings.highScore = Math.max(state.settings.highScore, result.score.total);
  if (game.mode === "daily") state.settings.dailyBest = Math.max(state.settings.dailyBest, result.score.total);
  saveStorage();
  renderResult(0);
  animateScore(result.score.total);
  if (result.score.total >= 150) runConfetti();
}

function renderResult(displayScore = state.score.total) {
  const scoreClass = state.score.total >= 150 ? "rainbow-glow" : state.score.total >= 120 ? "gold-glow" : "";
  app.innerHTML = `
    <main class="screen result-grid">
      ${topBarMarkup("RESULT")}
      <section class="result-hero">
        <p id="score-number" class="score-number ${scoreClass}">${displayScore}</p>
        <div class="rating-block">
          ${imageMarkup(state.rating.image, state.rating.playerName, "rating-face")}
          <div class="rating-name">${escapeHtml(state.rating.playerName)}級</div>
          <div>${escapeHtml(state.rating.label)}</div>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-heading">スコア内訳</h2>
        <div class="panel-section">
          ${scoreRow("素点", `${state.score.baseScore}/100`)}
          ${scoreRow("連続正解ボーナス(連続数×2)", `${state.score.streakBonus}/20`)}
          ${scoreRow("1位的中ボーナス", `${state.score.firstBonus}/10`)}
          ${scoreRow("最下位的中ボーナス", `${state.score.lastBonus}/20`)}
          ${scoreRow("合計得点", `${state.score.total}/150`)}
        </div>
      </section>
      <section class="columns-2">
        <div class="panel">
          <h2 class="panel-heading">あなたが決めつけた順位</h2>
          <div class="ranking-list">${state.game.playerRanking.map(resultRowMarkup).join("")}</div>
        </div>
        <div class="panel">
          <h2 class="panel-heading">正解の順位</h2>
          <div class="ranking-list">${state.game.answerRanking.map(resultRowMarkup).join("")}</div>
        </div>
      </section>
      <section class="panel">
        <h2 class="panel-heading">退場選手</h2>
        <div class="ranking-list">
          ${state.game.retiredPlayers.length ? state.game.retiredPlayers.map(resultRowMarkup).join("") : "<p class='panel-section'>退場選手はいません。</p>"}
        </div>
      </section>
      <section class="panel-section button-stack">
        <button class="primary-button" data-action="share" aria-label="結果をシェアする">結果をシェアする</button>
        <button class="secondary-button" data-action="replay" aria-label="もう一度遊ぶ">もう一度遊ぶ</button>
        <button class="secondary-button" data-action="home" aria-label="ホームに戻る">ホームに戻る</button>
      </section>
    </main>
  `;

  app.querySelector("[data-action='share']").addEventListener("click", showShareModal);
  app.querySelector("[data-action='replay']").addEventListener("click", () => startGame(state.game.mode));
  app.querySelector("[data-action='home']").addEventListener("click", renderHome);
}

function animateScore(total) {
  const start = performance.now();
  const duration = total >= 120 ? 1800 : 1200;
  function frame(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(eased * total);
    const node = document.querySelector("#score-number");
    if (node) node.textContent = value;
    if (progress < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function showShareModal() {
  const text = buildShareText(state.score, state.rating, state.game.playerRanking);
  showInfoModal("結果をシェア", `<textarea class="share-preview" readonly>${escapeHtml(text)}</textarea>`, null, [
    { label: "コピー", action: async () => { await copyText(text); showToast("クリップボードにコピーしました。"); closeModal(); } },
    { label: "Xで共有", action: () => window.open(twitterIntent(text), "_blank", "noopener") }
  ]);
}

function showRules() {
  showInfoModal("Muchi Rankとは", `
    <p><strong>10人のサッカー選手を、能力（OVR）が高い順になるようランキングへ配置します。</strong></p>

<p>※OVR…サッカーゲーム「FCシリーズ」で用いられる選手の総合能力値です。<br>
最高91、最低47となっています。</p>

<p><strong>【アビリティ】</strong><br>
ゲーム中、各アビリティを1回ずつ使用できます。</p>

<p>
・OVRオープン … その選手のOVRが分かります。<br>
・チームオープン … その選手の所属クラブと所属リーグが分かります。<br>
・ハイアンドロー … すでにランキングに配置した選手を1人選び、その選手より「強い」か「弱い」かが分かります。<br>
・選手交代 … 同じOVRを持つ別の選手と入れ替えることができます。
</p>

<p><strong>【アディショナルタイム】</strong><br>
10人全員を配置した後、一度だけ2名の順位を入れ替えることができます。</p>

<p><strong>【採点方式】</strong><br>
10人の選手から作られる45組のペアについて、それぞれの上下関係が正しく予想できているかを判定します。<br>
その正答率が100点満点の素点となります。</p>

<p>さらに以下のボーナス点が加算され、満点は150点となります。</p>

<p>
・連続正解ボーナス … 連続して順位を的中させた数 × 2点<br>
・1位的中ボーナス … 1位の選手を的中で +10点<br>
・最下位的中ボーナス … 最下位の選手を的中で +20点
</p>

<p>※選手データはすべてFC26リリース時点のステータスを使用しています。</p>
  `);
}

function showInfoModal(title, body, onClose, extraActions = []) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <section class="modal">
        <h2 class="panel-heading">${escapeHtml(title)}</h2>
        <div class="modal-body">${body}</div>
        <div class="modal-actions">
          ${extraActions.map((action, index) => `<button class="primary-button" data-extra-action="${index}">${escapeHtml(action.label)}</button>`).join("")}
          <button class="secondary-button" data-modal-close aria-label="閉じる">閉じる</button>
        </div>
      </section>
    </div>
  `;

  modalRoot.querySelector("[data-modal-close]").addEventListener("click", () => {
    closeModal();
    if (onClose) onClose();
  });
  extraActions.forEach((action, index) => {
    modalRoot.querySelector(`[data-extra-action="${index}"]`).addEventListener("click", action.action);
  });
}

function closeModal() {
  modalRoot.innerHTML = "";
}

function runConfetti() {
  const ctx = confettiCanvas.getContext("2d");
  const random = state.game?.random || (() => 0.5);
  const colors = ["#f4c95d", "#d9dee8", "#c8844a", "#38c172", "#4aa3ff"];
  const pieces = Array.from({ length: 140 }, () => ({
    x: random() * window.innerWidth,
    y: -20 - random() * window.innerHeight,
    size: 4 + random() * 8,
    speed: 2 + random() * 5,
    color: colors[Math.floor(random() * colors.length)]
  }));
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  let frames = 0;
  function frame() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    pieces.forEach((piece) => {
      piece.y += piece.speed;
      piece.x += Math.sin((frames + piece.y) / 18);
      ctx.fillStyle = piece.color;
      ctx.fillRect(piece.x, piece.y, piece.size, piece.size);
    });
    frames += 1;
    if (frames < 180) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }
  frame();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderError(error) {
  app.innerHTML = `
    <main class="screen error-box">
      <h1>CSV読込エラー</h1>
      <p>${escapeHtml(error.message)}</p>
      <button class="secondary-button" onclick="location.reload()" aria-label="再読み込み">再読み込み</button>
    </main>
  `;
}

function logoMarkup() {
  return `
    <div>
      <div class="logo" aria-label="Muchi Rank">
        <span class="logo-main">MUCHI</span>
        <span class="logo-sub">RANK</span>
      </div>
      <p>Make Rank By Face</p>
    </div>
  `;
}

function topBarMarkup(progress) {
  return `
    <header class="top-bar">
      <button class="logo" aria-label="ホームに戻る" onclick="location.reload()">
        <span class="logo-main">MUCHI</span>
        <span class="logo-sub">RANK</span>
      </button>
      <div class="progress">${escapeHtml(progress)}</div>
    </header>
  `;
}

function toggleRow(label, key, value) {
  return `
    <div class="setting-row">
      <span>${label}</span>
      <button class="toggle" data-toggle="${key}" aria-pressed="${value}" aria-label="${label}を切り替え"><span></span></button>
    </div>
  `;
}

function abilityCheckRows() {
  return Object.entries(ABILITIES).map(([key, label]) => `
    <label class="check-row">
      <span>${label}</span>
      <input type="checkbox" data-ability-setting="${key}" ${state.settings.settings.abilities[key] ? "checked" : ""}>
    </label>
  `).join("");
}

function abilityButtonMarkup(key, label) {
  const game = state.game;
  const enabled = game.abilities[key] && !game.usedAbilities[key];
  return `
    <button class="ability-button ${game.usedAbilities[key] ? "used" : ""}" data-ability="${key}" ${enabled ? "" : "disabled"} title="${escapeHtml(abilityHelp(key))}" aria-label="${escapeHtml(label)}">
      <span>${escapeHtml(label)}</span>
      <span class="ability-state">${game.usedAbilities[key] ? "使用済" : "使用可能"}</span>
    </button>
  `;
}

function abilityHelp(key) {
  return {
    ovrOpen: "現在の選手のOVRを表示します",
    teamOpen: "所属クラブとリーグを表示します",
    highLow: "配置済み選手と強さを比較します",
    substitution: "同じOVRの別選手へ交代します"
  }[key];
}

function playerClueMarkup(player) {
  return `
    ${state.settings.settings.showFace ? imageMarkup(player.image, player.name, "player-image") : "<div class='hidden-clue'>FACE HIDDEN</div>"}
    ${state.settings.settings.showName ? `<h1 class="player-name">${escapeHtml(player.name)}</h1>` : "<div class='hidden-clue'>NAME HIDDEN</div>"}
  `;
}

function rankSlotMarkup(player, index, mode) {
  const action = mode === "place" ? `data-rank-place="${index}"` : `data-rank-swap="${index}"`;
  const disabled = mode === "place" && player ? "disabled" : "";
  return `
    <button class="rank-slot ${rankColor(index)}" ${action} ${disabled} aria-label="${index + 1}位">
      <span class="rank-number">${ordinal(index + 1)}</span>
      ${player ? imageMarkup(player.image, player.name, "rank-face") : "<span></span>"}
      <span class="rank-name">${player ? escapeHtml(player.name) : "未配置"}</span>
      <span class="rank-ovr">${player ? "OVR ?" : ""}</span>
    </button>
  `;
}

function resultRowMarkup(player, index) {
  return `
    <div class="result-row">
      <span class="rank-number">${index + 1}位</span>
      ${imageMarkup(player.image, player.name, "result-face")}
      <span class="result-name">${escapeHtml(player.name)}</span>
      <span class="rank-ovr">${player.ovr}</span>
    </div>
  `;
}

function scoreRow(label, value) {
  return `<div class="stat-row"><span>${label}</span><strong>${value}</strong></div>`;
}

function imageMarkup(src, alt, className) {
  return `<img class="${className}" src="${escapeAttribute(src || PLACEHOLDER)}" alt="${escapeAttribute(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
}

function rankColor(index) {
  if (index === 0) return "gold";
  if (index === 1) return "silver";
  if (index === 2) return "bronze";
  if (index >= 3 && index <= 6) return "green";
  return "gray";
}

function ordinal(number) {
  return ["1st", "2nd", "3rd"][number - 1] || `${number}th`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
