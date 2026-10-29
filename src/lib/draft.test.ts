import { describe, expect, it } from "vitest";
import data from "../data/champions.json";
import {
  changeRole,
  lockChampion,
  matchesSearch,
  nextRole,
  restoreDraft,
  ROLES,
  teamSelections,
  TURNS,
} from "./draft";
import type { Champion, Draft, Role, Team } from "./draft";
import { matchup, recommend } from "./recommend";
import { COUNTERS, SYNERGIES } from "../data/strategy";
const champions = data.champions as Champion[];
const champion = (id: string) => champions.find((c) => c.id === id)!;
const openingBans = [
  "Teemo",
  "Shaco",
  "Singed",
  "MasterYi",
  "Yuumi",
  "DrMundo",
];
function draftWithBans() {
  return openingBans.reduce((d, id) => lockChampion(d, champion(id)), {
    selections: [],
  } as Draft);
}
function pick(d: Draft, id: string, role?: Role) {
  return lockChampion(d, champion(id), role);
}

describe("tournament draft integrity", () => {
  it("follows tournament side order, including red opening the second ban and pick phases", () => {
    expect(TURNS.map((t) => `${t.team[0]}${t.action[0]}`).join(" ")).toBe(
      "bb rb bb rb bb rb bp rp rp bp bp rp rb bb rb bb rp bp bp rp",
    );
  });
  it("finishes with exactly five unique bans and five unique picks on each side", () => {
    let d: Draft = { selections: [] };
    for (let i = 0; i < 20; i++) d = lockChampion(d, champions[i]);
    for (const team of ["blue", "red"] as Team[]) {
      expect(teamSelections(d, team, "ban")).toHaveLength(5);
      expect(teamSelections(d, team, "pick")).toHaveLength(5);
      expect(
        new Set(teamSelections(d, team, "pick").map((p) => p.role)).size,
      ).toBe(5);
    }
    expect(lockChampion(d, champions[30])).toBe(d);
  });
  it("rejects a banned or picked champion without advancing the turn", () => {
    const d = pick(draftWithBans(), "Ahri", "MID");
    expect(pick(d, "Ahri")).toBe(d);
    expect(pick(d, "Teemo")).toBe(d);
  });
  it("swaps roles on the same team without changing the other team", () => {
    let d = draftWithBans();
    for (const [id, role] of [
      ["Ahri", "MID"],
      ["Jinx", "ADC"],
      ["Nautilus", "SUPPORT"],
      ["Vi", "JUNGLE"],
    ] as const)
      d = pick(d, id, role);
    const updated = changeRole(d, 6, "JUNGLE");
    expect(updated.selections[6].role).toBe("JUNGLE");
    expect(updated.selections[9].role).toBe("MID");
    expect(updated.selections[7]).toEqual(d.selections[7]);
    expect(restoreDraft(JSON.stringify(updated), champions)).toEqual(updated);
  });
  it("restores valid drafts and rejects corrupt storage, invalid roles, duplicates and oversized drafts", () => {
    const d = pick(draftWithBans(), "Ahri", "MID");
    expect(restoreDraft(JSON.stringify(d), champions)).toEqual(d);
    for (const raw of [
      "{broken",
      '{"selections":[null]}',
      JSON.stringify({ selections: [{ championId: "Missing" }] }),
      JSON.stringify({ selections: [...d.selections, d.selections[0]] }),
      JSON.stringify({
        selections: [
          ...d.selections.slice(0, 6),
          { championId: "Ahri", role: "INVALID" },
        ],
      }),
      JSON.stringify({ selections: Array(21).fill({ championId: "Ahri" }) }),
    ])
      expect(restoreDraft(raw, champions)).toEqual({ selections: [] });
  });
  it("supports Korean names, English IDs and Korean initials", () => {
    for (const search of ["아리", "ahri", "ㅇㄹ", "AHRI"])
      expect(matchesSearch(champion("Ahri"), search)).toBe(true);
    expect(matchesSearch(champion("LeeSin"), "리 신")).toBe(true);
    expect(matchesSearch(champion("Ahri"), "징크스")).toBe(false);
  });
});

describe("recommendations and matchup knowledge", () => {
  it("offers three skill-based responses to an opening Ahri", () => {
    const d = pick(draftWithBans(), "Ahri", "MID");
    const recs = recommend(d, champions);
    expect(recs).toHaveLength(3);
    expect(
      recs.every((r) =>
        r.reasons.some((reason) => reason.label === "아리 대응"),
      ),
    ).toBe(true);
  });
  it("responds to an opening Yasuo pick with a Vex counter option", () => {
    const d = pick(draftWithBans(), "Yasuo", "MID");
    const recs = recommend(d, champions);
    expect(recs).toHaveLength(3);
    expect(
      recs.some(
        (r) =>
          r.champion.id === "Vex" &&
          r.reasons.some((reason) => reason.label === "야스오 대응"),
      ),
    ).toBe(true);
  });
  it.each([
    ["Jinx", "ADC", "Lulu", "SUPPORT"],
    ["Nami", "SUPPORT", "Lucian", "ADC"],
    ["Ahri", "MID", "Vi", "JUNGLE"],
    ["Diana", "JUNGLE", "Yasuo", "MID"],
  ] as const)(
    "recommends a partner for %s in either direction",
    (ally, role, partner, expectedRole) => {
      let d = pick(draftWithBans(), ally, role);
      d = pick(d, "Ornn", "TOP");
      d = pick(d, "Ezreal", "ADC");
      expect(nextRole(d, champions)).toBe(expectedRole);
      const recs = recommend(d, champions);
      expect(recs.some((r) => r.champion.id === partner)).toBe(true);
      expect(
        recs.every(
          (r) => !d.selections.some((s) => s.championId === r.champion.id),
        ),
      ).toBe(true);
    },
  );
  it("never recommends unavailable champions and respects the requested role", () => {
    const d = pick(draftWithBans(), "Ahri", "MID");
    for (const role of ROLES) {
      const recommendations = recommend(d, champions, role);
      expect(recommendations).toHaveLength(3);
      expect(
        recommendations.every(
          (r) =>
            r.champion.roles.includes(role) &&
            !d.selections.some((s) => s.championId === r.champion.id),
        ),
      ).toBe(true);
    }
  });
  it("distinguishes exact matchup guides, general guides and missing advice", () => {
    expect(matchup(champion("Morgana"), champion("Blitzcrank")).specific).toBe(
      true,
    );
    expect(matchup(champion("Ahri"), champion("Yasuo")).specific).toBe(false);
    expect(
      matchup(champion("Ahri"), champion("Yasuo")).tips.length,
    ).toBeGreaterThan(0);
    expect(matchup(champion("Ahri"), champion("Yunara")).tips).toHaveLength(0);
  });
  it("contains only existing champions and complete Korean skill data", () => {
    const ids = new Set(champions.map((c) => c.id));
    for (const pair of SYNERGIES)
      for (const id of pair.pair) expect(ids.has(id), id).toBe(true);
    for (const counter of COUNTERS) {
      expect(ids.has(counter.pick)).toBe(true);
      expect(ids.has(counter.enemy)).toBe(true);
    }
    expect(champions).toHaveLength(173);
    for (const c of champions) {
      expect(c.roles.length).toBeGreaterThan(0);
      expect(c.spells).toHaveLength(4);
    }
  });
});
