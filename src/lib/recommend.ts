import { COUNTERS, SYNERGIES, THREATS } from "../data/strategy";
import {
  nextRole,
  otherTeam,
  ROLE_NAMES,
  teamSelections,
  TURNS,
} from "./draft";
import type { Champion, Draft, Role, Team } from "./draft";

export interface Recommendation {
  champion: Champion;
  reasons: { label: string; text: string }[];
  score: number;
}
const PRIORITY = [
  "Ahri",
  "Jinx",
  "LeeSin",
  "Nautilus",
  "Aatrox",
  "Orianna",
  "Vi",
  "Caitlyn",
  "Lulu",
  "Ornn",
  "Ezreal",
  "Rakan",
  "JarvanIV",
  "Syndra",
  "Renekton",
  "Ashe",
  "Braum",
  "Viego",
  "Gnar",
  "Karma",
];
export function recommend(
  draft: Draft,
  champions: Champion[],
  requestedRole?: Role,
  completedTeam: Team = "blue",
): Recommendation[] {
  const turn = TURNS[draft.selections.length] ?? {
    team: completedTeam,
    action: "pick",
  };
  const allies = teamSelections(draft, turn.team, "pick");
  const enemies = teamSelections(draft, otherTeam(turn.team), "pick");
  const selected = new Set(draft.selections.map((s) => s.championId));
  const role = requestedRole ?? nextRole(draft, champions);
  const pool = champions.filter(
    (c) =>
      !selected.has(c.id) &&
      ((turn.action === "ban" && !requestedRole) || c.roles.includes(role)),
  );
  const byId = new Map(champions.map((c) => [c.id, c]));
  const hasTank = allies.some((s) =>
    byId.get(s.championId)?.tags.includes("Tank"),
  );
  const suggestions = pool.map((champion) => {
    let score = Math.max(0, 25 - PRIORITY.indexOf(champion.id));
    if (!PRIORITY.includes(champion.id)) score = 0;
    const reasons: Recommendation["reasons"] = [];
    if (turn.action === "ban") {
      for (const ally of allies) {
        const counter = COUNTERS.find(
          (c) => c.pick === champion.id && c.enemy === ally.championId,
        );
        if (counter) {
          score += 100;
          reasons.push({
            label: "아군 보호",
            text: `${byId.get(ally.championId)?.name}의 플레이를 방해할 수 있는 선택지를 미리 차단해요. ${counter.reason}`,
          });
        }
      }
      for (const enemy of enemies) {
        const pair = SYNERGIES.find(
          (s) =>
            s.pair.includes(champion.id) && s.pair.includes(enemy.championId),
        );
        if (pair) {
          score += 80;
          reasons.push({
            label: "시너지 차단",
            text: `상대 ${byId.get(enemy.championId)?.name}와의 연계를 막을 수 있어요. ${pair.reason}`,
          });
        }
      }
      if (!reasons.length)
        reasons.push({
          label: "밴 고려 대상",
          text: THREATS[champion.id]
            ? `${THREATS[champion.id].key}에 대응하기 부담스럽다면 밴을 고려해 보세요.`
            : `${ROLE_NAMES[champion.roles[0]]}에서 상대하기 까다롭다고 느끼는지, 아군 조합을 보며 밴을 결정하세요.`,
        });
    } else {
      for (const ally of allies) {
        const pair = SYNERGIES.find(
          (s) =>
            s.pair.includes(champion.id) && s.pair.includes(ally.championId),
        );
        if (pair) {
          score += 120;
          reasons.push({
            label: `${byId.get(ally.championId)?.name} 시너지`,
            text: pair.reason,
          });
        }
      }
      for (const enemy of enemies) {
        const counter = COUNTERS.find(
          (c) => c.pick === champion.id && c.enemy === enemy.championId,
        );
        if (counter) {
          score += 90;
          reasons.push({
            label: `${byId.get(enemy.championId)?.name} 대응`,
            text: counter.reason,
          });
        }
      }
      if (!hasTank && champion.tags.includes("Tank")) {
        score += 12;
        reasons.push({
          label: "조합 보완",
          text: "현재 아군에 탱커가 없어 전방에서 버티고 교전을 시작하는 역할을 보완할 수 있어요.",
        });
      }
      if (!reasons.length)
        reasons.push({
          label: `${ROLE_NAMES[role]} 후보`,
          text: `${ROLE_NAMES[role]} 자리를 채울 수 있는 선택이에요. 상대의 확정 픽과 본인의 숙련도를 함께 고려하세요.`,
        });
    }
    return { champion, reasons: reasons.slice(0, 2), score };
  });
  return suggestions
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.champion.name.localeCompare(b.champion.name, "ko"),
    )
    .slice(0, 3);
}

export function matchup(own: Champion, enemy: Champion) {
  const counter = COUNTERS.find(
    (c) => c.pick === own.id && c.enemy === enemy.id,
  );
  const reverse = COUNTERS.find(
    (c) => c.pick === enemy.id && c.enemy === own.id,
  );
  const threat = THREATS[enemy.id];
  return {
    specific: !!counter,
    headline:
      counter?.reason ??
      (reverse
        ? `주의할 상호작용: ${reverse.reason}`
        : `${enemy.name}의 핵심 스킬을 확인하고 교환 타이밍을 잡아보세요.`),
    tips: counter?.tips ?? (threat ? [threat.advice, threat.fight] : []),
    key: threat?.key,
  };
}
