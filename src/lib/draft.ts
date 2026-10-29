export const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"] as const;
export type Role = (typeof ROLES)[number];
export type Team = "blue" | "red";
export type Action = "ban" | "pick";
export interface Champion {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  roles: Role[];
  blurb: string;
  spells: { name: string; description: string }[];
  passive: { name: string; description: string };
}
export interface Turn {
  team: Team;
  action: Action;
  phase: number;
}
export interface Selection {
  championId: string;
  role?: Role;
}
export interface Draft {
  selections: Selection[];
}
const turns = (team: Team, action: Action, phase: number): Turn => ({
  team,
  action,
  phase,
});
export const TURNS: Turn[] = [
  ...(["blue", "red", "blue", "red", "blue", "red"] as Team[]).map((t) =>
    turns(t, "ban", 0),
  ),
  ...(["blue", "red", "red", "blue", "blue", "red"] as Team[]).map((t) =>
    turns(t, "pick", 1),
  ),
  ...(["red", "blue", "red", "blue"] as Team[]).map((t) => turns(t, "ban", 2)),
  ...(["red", "blue", "blue", "red"] as Team[]).map((t) => turns(t, "pick", 3)),
];
export const ROLE_NAMES: Record<Role, string> = {
  TOP: "탑",
  JUNGLE: "정글",
  MID: "미드",
  ADC: "원딜",
  SUPPORT: "서포터",
};
export const TEAM_NAMES: Record<Team, string> = {
  blue: "블루팀",
  red: "레드팀",
};
export const PHASE_NAMES = ["1차 밴", "1차 픽", "2차 밴", "2차 픽"];
export const otherTeam = (team: Team): Team =>
  team === "blue" ? "red" : "blue";
export function teamSelections(draft: Draft, team: Team, action: Action) {
  return draft.selections.flatMap((s, index) =>
    TURNS[index]?.team === team && TURNS[index]?.action === action
      ? [{ ...s, index }]
      : [],
  );
}
export function nextRole(
  draft: Draft,
  champions: Champion[],
  requested?: Role,
): Role {
  const turn = TURNS[draft.selections.length];
  if (!turn) return requested ?? "TOP";
  const allies = teamSelections(draft, turn.team, "pick");
  const filled = new Set(allies.map((s) => s.role));
  if (requested) return requested;
  const pairs: [Role, Role][] = [
    ["ADC", "SUPPORT"],
    ["SUPPORT", "ADC"],
    ["MID", "JUNGLE"],
    ["JUNGLE", "MID"],
  ];
  for (const selection of [...allies].reverse()) {
    const pair = pairs.find(([a]) => a === selection.role);
    if (pair && !filled.has(pair[1])) return pair[1];
  }
  // Prioritize a lane opponent when responding to the opening pick.
  const enemies = teamSelections(draft, otherTeam(turn.team), "pick");
  const lastEnemy = enemies.at(-1);
  if (
    lastEnemy?.role &&
    !filled.has(lastEnemy.role) &&
    champions.some((c) => c.roles.includes(lastEnemy.role!))
  )
    return lastEnemy.role;
  return ROLES.find((r) => !filled.has(r)) ?? "TOP";
}
export function lockChampion(
  draft: Draft,
  champion: Champion,
  preferredRole?: Role,
): Draft {
  const turn = TURNS[draft.selections.length];
  if (!turn || draft.selections.some((s) => s.championId === champion.id))
    return draft;
  if (turn.action === "ban")
    return { selections: [...draft.selections, { championId: champion.id }] };
  const occupied = new Set(
    teamSelections(draft, turn.team, "pick").map((s) => s.role),
  );
  const role =
    preferredRole && !occupied.has(preferredRole)
      ? preferredRole
      : (champion.roles.find((r) => !occupied.has(r)) ??
        ROLES.find((r) => !occupied.has(r))!);
  return {
    selections: [...draft.selections, { championId: champion.id, role }],
  };
}
export function changeRole(draft: Draft, index: number, role: Role): Draft {
  const turn = TURNS[index];
  if (!turn || turn.action !== "pick" || !draft.selections[index]) return draft;
  const previous = draft.selections[index].role;
  const swapped = teamSelections(draft, turn.team, "pick").find(
    (s) => s.role === role,
  );
  return {
    selections: draft.selections.map((s, i) =>
      i === index
        ? { ...s, role }
        : i === swapped?.index
          ? { ...s, role: previous }
          : s,
    ),
  };
}
export function restoreDraft(raw: string | null, champions: Champion[]): Draft {
  if (!raw) return { selections: [] };
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !("selections" in value) ||
      !Array.isArray(value.selections) ||
      value.selections.length > TURNS.length
    )
      return { selections: [] };
    let draft: Draft = { selections: [] };
    for (const selection of value.selections) {
      if (!selection || typeof selection !== "object")
        return { selections: [] };
      const champion = champions.find((c) => c.id === selection.championId);
      const turn = TURNS[draft.selections.length];
      if (
        !champion ||
        draft.selections.some((s) => s.championId === champion.id)
      )
        return { selections: [] };
      if (
        turn.action === "pick" &&
        (!ROLES.includes(selection.role) ||
          teamSelections(draft, turn.team, "pick").some(
            (s) => s.role === selection.role,
          ))
      )
        return { selections: [] };
      draft = lockChampion(draft, champion, selection.role);
    }
    return draft;
  } catch {
    return { selections: [] };
  }
}
export function matchesSearch(champion: Champion, query: string) {
  const normalize = (v: string) => v.toLowerCase().replace(/[\s'.’]/g, "");
  const q = normalize(query);
  const initials = [...champion.name]
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      return code >= 0 && code <= 11171
        ? "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"[Math.floor(code / 588)]
        : char;
    })
    .join("");
  return (
    normalize(champion.name).includes(q) ||
    normalize(champion.id).includes(q) ||
    normalize(initials).includes(q)
  );
}
