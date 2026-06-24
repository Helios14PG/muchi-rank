export function buildShareText(score, rating, ranking) {
  const lines = [
    `${score.total}点`,
    `${rating.playerName}級`,
    "",
    "【スコア内訳】",
    `素点 ${score.baseScore}`,
    `連続ボーナス ${score.streakBonus}`,
    `1位ボーナス ${score.firstBonus}`,
    `最下位ボーナス ${score.lastBonus}`,
    "",
    "【作成したランキング】",
    ...ranking.map((player, index) => `${index + 1}位 ${player.name}`),
    "",
    "#MuchiRank"
  ];
  return lines.join("\n");
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function twitterIntent(text) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
