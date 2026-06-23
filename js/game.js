import { dateSeed, mulberry32, pickOne, randomSeed, shuffle } from "./daily.js";
import { calculateScore, rankForScore } from "./score.js";

export const ABILITIES = {
  ovrOpen: "OVRオープン",
  teamOpen: "チームオープン",
  highLow: "ハイアンドロー",
  substitution: "選手交代"
};

export function createGame(players, mode, settings) {
  const seed = mode === "daily" ? dateSeed() : randomSeed();
  const random = mulberry32(seed);
  const selectedPlayers = generateQuestion(players, random, settings.minOvr ?? 75);
  const answerRanking = [...selectedPlayers].sort((a, b) => b.ovr - a.ovr);

  return {
    mode,
    seed,
    random,
    currentIndex: 0,
    selectedPlayers,
    playerRanking: Array(10).fill(null),
    answerRanking,
    retiredPlayers: [],
    abilities: { ...settings.abilities },
    usedAbilities: {
      ovrOpen: false,
      teamOpen: false,
      highLow: false,
      substitution: false
    },
    additionalTimeUsed: false,
    phase: "playing"
  };
}

export function generateQuestion(players, random, minOvr = 75) {
  const eligible = players.filter((player) => player.ovr >= minOvr);
  const source = eligible.length >= 10 ? eligible : players;
  const groups = new Map();

  source.forEach((player) => {
    if (!groups.has(player.ovr)) groups.set(player.ovr, []);
    groups.get(player.ovr).push(player);
  });

  const ovrs = shuffle([...groups.keys()], random).slice(0, 10);
  if (ovrs.length < 10) {
    throw new Error("出題に必要なOVR重複なしの選手が不足しています");
  }

  return ovrs.map((ovr, index) => {
    const group = groups.get(ovr);
    const player = pickOne(group, random);
    return withScoreId(player, `${ovr}-${String(index + 1).padStart(3, "0")}`);
  });
}

export function placeCurrentPlayer(state, rankIndex) {
  if (!state.playerRanking[rankIndex] && state.phase === "playing") {
    state.playerRanking[rankIndex] = state.selectedPlayers[state.currentIndex];
    state.currentIndex += 1;
    if (state.currentIndex >= state.selectedPlayers.length) {
      state.phase = "additional";
    }
    return true;
  }
  return false;
}

export function useAbility(state, ability) {
  if (!state.abilities[ability] || state.usedAbilities[ability]) return false;
  state.usedAbilities[ability] = true;
  return true;
}

export function substituteCurrentPlayer(state, allPlayers) {
  const current = state.selectedPlayers[state.currentIndex];
  if (!current) return null;
  const candidates = allPlayers.filter((player) => player.ovr === current.ovr && String(player.id) !== String(current.id));
  if (!candidates.length) return null;
  const replacement = withScoreId(pickOne(candidates, state.random), current.scoreId);
  state.retiredPlayers.push(current);
  state.selectedPlayers[state.currentIndex] = replacement;
  state.answerRanking = state.answerRanking.map((player) => player.scoreId === current.scoreId ? replacement : player);
  return replacement;
}

export function highLowResult(current, target) {
  return current.ovr > target.ovr ? "強いです" : "弱いです";
}

export function swapRanks(state, firstIndex, secondIndex) {
  if (state.additionalTimeUsed || state.phase !== "additional") return false;
  [state.playerRanking[firstIndex], state.playerRanking[secondIndex]] = [state.playerRanking[secondIndex], state.playerRanking[firstIndex]];
  state.additionalTimeUsed = true;
  return true;
}

export function finishGame(state, allPlayers) {
  state.phase = "result";
  const score = calculateScore(state.playerRanking, state.answerRanking);
  const rating = selectRatingPlayer(score.total, allPlayers, state.random);
  return { score, rating };
}

export function selectRatingPlayer(score, players, random) {
  const rank = rankForScore(score);
  if (rank.pele) {
    return {
      label: rank.label,
      playerName: "ペレ",
      image: "./assets/pele.svg"
    };
  }

  const candidates = players.filter((player) => player.ovr >= rank.min && player.ovr <= rank.max);
  const selected = candidates.length ? pickOne(candidates, random) : pickOne(players, random);
  return {
    label: rank.label,
    playerName: selected.name,
    image: selected.image
  };
}

function withScoreId(player, scoreId) {
  return { ...player, scoreId };
}
