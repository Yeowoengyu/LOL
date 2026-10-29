import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Crosshair,
  ExternalLink,
  Flag,
  GitBranch,
  HeartHandshake,
  Info,
  Layers3,
  RotateCcw,
  Search,
  Shield,
  ShieldBan,
  Sparkles,
  Swords,
  Target,
  TreePine,
  Undo2,
  X,
} from "lucide-react";
import rawData from "./data/champions.json";
import { SYNERGIES } from "./data/strategy";
import {
  changeRole,
  lockChampion,
  matchesSearch,
  nextRole,
  otherTeam,
  PHASE_NAMES,
  ROLE_NAMES,
  ROLES,
  restoreDraft,
  TEAM_NAMES,
  teamSelections,
  TURNS,
} from "./lib/draft";
import type { Champion, Draft, Role, Team } from "./lib/draft";
import { matchup, recommend } from "./lib/recommend";

const champions = rawData.champions as Champion[];
const championMap = new Map(champions.map((c) => [c.id, c]));
const STORAGE_KEY = "draft-lab:v1";
const embeddedPortraits = (
  window as Window & {
    __DRAFT_LAB_PORTRAITS__?: Record<string, string>;
  }
).__DRAFT_LAB_PORTRAITS__;
function RoleIcon({ role, size = 17 }: { role: Role; size?: number }) {
  const Icon = {
    TOP: Swords,
    JUNGLE: TreePine,
    MID: GitBranch,
    ADC: Crosshair,
    SUPPORT: HeartHandshake,
  }[role];
  return <Icon size={size} strokeWidth={1.65} aria-hidden="true" />;
}
function Portrait({
  champion,
  className = "",
}: {
  champion: Champion;
  className?: string;
}) {
  return (
    <img
      className={className}
      src={
        embeddedPortraits?.[champion.id] ??
        `${import.meta.env.BASE_URL}champions/${champion.id}.png`
      }
      alt={champion.name}
      loading="lazy"
      draggable={false}
    />
  );
}
function Modal({
  title,
  children,
  onClose,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], select, input, [tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handler);
      before?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-top">
          <span className="eyebrow">DRAFT LAB / {title}</span>
          <button className="icon-button" onClick={onClose} aria-label="닫기">
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function TeamPanel({
  team,
  draft,
  onInspect,
  onRole,
}: {
  team: Team;
  draft: Draft;
  onInspect: (id: string, team: Team) => void;
  onRole: (index: number, role: Role) => void;
}) {
  const picks = teamSelections(draft, team, "pick");
  const bans = teamSelections(draft, team, "ban");
  const turn = TURNS[draft.selections.length];
  const active = turn?.team === team;
  const remaining = ROLES.filter((r) => !picks.some((s) => s.role === r));
  return (
    <aside
      className={`team-panel ${team} ${active ? "team-active" : ""}`}
      aria-label={TEAM_NAMES[team]}
    >
      <div className="team-heading">
        <span className="team-dot" />
        <div>
          <span className="team-en">{team.toUpperCase()} SIDE</span>
          <h2>{TEAM_NAMES[team]}</h2>
        </div>
        <span className="pick-count">
          {picks.length}
          <i>/ 5</i>
        </span>
      </div>
      <div className={`team-status ${active ? "is-active" : ""}`}>
        <span className="status-dot" />
        {!turn
          ? "드래프트 완료"
          : active
            ? `${turn.action === "ban" ? "밴" : "픽"} 선택 중`
            : "상대 선택 대기"}
      </div>
      <div className="team-picks">
        {Array.from({ length: 5 }, (_, i) => {
          const pick = picks[i];
          const champion = pick && championMap.get(pick.championId);
          const role = pick?.role ?? remaining[i - picks.length] ?? ROLES[i];
          const isNext =
            active && turn?.action === "pick" && i === picks.length;
          return (
            <div
              className={`pick-slot ${champion ? "filled" : ""} ${isNext ? "next-slot" : ""}`}
              key={i}
            >
              {champion ? (
                <>
                  <button
                    className="picked-champion"
                    onClick={() => onInspect(champion.id, team)}
                    aria-label={`${TEAM_NAMES[team]} ${champion.name} 상대법 보기`}
                  >
                    <Portrait champion={champion} />
                    <span>
                      <strong>{champion.name}</strong>
                      <small>
                        상대법 보기 <ArrowUpRight size={11} />
                      </small>
                    </span>
                  </button>
                  <label className="slot-role">
                    <RoleIcon role={role} />
                    <select
                      aria-label={`${champion.name} 포지션`}
                      value={role}
                      onChange={(e) =>
                        onRole(pick.index, e.target.value as Role)
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_NAMES[r]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={11} />
                  </label>
                </>
              ) : (
                <>
                  <div className="empty-role">
                    <RoleIcon role={role} size={25} />
                  </div>
                  <div className="empty-copy">
                    <strong>
                      {isNext ? "챔피언을 선택하세요" : "선택 대기"}
                    </strong>
                    <small>{ROLE_NAMES[role]}</small>
                  </div>
                  <span className="slot-number">0{i + 1}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="ban-title">
        <ShieldBan size={13} />
        <span>챔피언 밴</span>
        <span>{bans.length} / 5</span>
      </div>
      <div className="ban-slots">
        {Array.from({ length: 5 }, (_, i) => {
          const champion = bans[i] && championMap.get(bans[i].championId);
          const isNext = active && turn?.action === "ban" && i === bans.length;
          return (
            <div
              className={`ban-slot ${champion ? "filled" : ""} ${isNext ? "next-ban" : ""}`}
              key={i}
            >
              {champion ? (
                <>
                  <Portrait champion={champion} />
                  <span className="ban-slash" />
                  <span className="ban-tooltip">{champion.name}</span>
                </>
              ) : (
                <span>{isNext ? <span className="status-dot" /> : "—"}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="team-footer">
        <Flag size={12} />
        <span>
          {team === "blue"
            ? "선픽으로 주도권을 잡으세요"
            : "상대의 픽에 유연하게 대응하세요"}
        </span>
      </div>
    </aside>
  );
}
function MatchupModal({
  id,
  team,
  draft,
  onClose,
}: {
  id: string;
  team: Team;
  draft: Draft;
  onClose: () => void;
}) {
  const own = championMap.get(id)!;
  const enemies = teamSelections(draft, otherTeam(team), "pick").map(
    (s) => championMap.get(s.championId)!,
  );
  const [enemyId, setEnemyId] = useState(
    enemies.find((c) => c.roles.some((r) => own.roles.includes(r)))?.id ??
      enemies[0]?.id ??
      "",
  );
  const [tab, setTab] = useState<"matchup" | "skills">("matchup");
  const enemy = championMap.get(enemyId);
  const guide = enemy && matchup(own, enemy);
  return (
    <Modal title="챔피언 리포트" onClose={onClose} className="matchup-modal">
      <div className="report-hero">
        <Portrait champion={own} />
        <div>
          <span className={`report-side ${team}`}>
            {TEAM_NAMES[team]} ·{" "}
            {own.roles.map((r) => ROLE_NAMES[r]).join(" / ")}
          </span>
          <h2>
            {own.name}
            <small>{own.title}</small>
          </h2>
        </div>
        <Shield className="report-watermark" size={90} />
      </div>
      <div className="report-tabs">
        <button
          className={tab === "matchup" ? "active" : ""}
          onClick={() => setTab("matchup")}
        >
          <Swords size={16} />
          상대법
        </button>
        <button
          className={tab === "skills" ? "active" : ""}
          onClick={() => setTab("skills")}
        >
          <BookOpen size={16} />내 챔피언 스킬
        </button>
      </div>
      {tab === "skills" ? (
        <div className="skill-list">
          <SkillRow symbol="P" skill={own.passive} />
          {own.spells.map((s, i) => (
            <SkillRow key={s.name} symbol={"QWER"[i]} skill={s} />
          ))}
          <p className="source-note">
            스킬 설명: Riot Data Dragon {rawData.version}. 수치와 세부 판정은
            게임 내 정보를 확인하세요.
          </p>
        </div>
      ) : (
        <>
          <div className="opponent-label">
            상대 챔피언 선택 <span>{enemies.length}명</span>
          </div>
          {enemies.length ? (
            <div className="opponent-list">
              {enemies.map((c) => (
                <button
                  key={c.id}
                  className={c.id === enemyId ? "selected" : ""}
                  onClick={() => setEnemyId(c.id)}
                >
                  <Portrait champion={c} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="no-opponent">
              <Target size={28} />
              <strong>상대 픽이 나오면 분석을 시작해요</strong>
              <p>상대 팀이 챔피언을 선택한 뒤 다시 눌러보세요.</p>
            </div>
          )}
          {enemy && guide && (
            <>
              <div className="matchup-heading">
                <span>{own.name}</span>
                <small>VS</small>
                <span>{enemy.name}</span>
                <span className="guide-type">
                  {guide.specific
                    ? "스킬 상호작용 가이드"
                    : "상대 챔피언 기본 가이드"}
                </span>
              </div>
              <div className="matchup-insight">
                <Sparkles size={18} />
                <p>{guide.headline}</p>
              </div>
              {guide.tips.length ? (
                <div className="tip-list">
                  {guide.tips.map((tip, i) => (
                    <div className="tip" key={tip}>
                      <span>0{i + 1}</span>
                      <div>
                        <h4>
                          {i === 0 ? "라인전 · 스킬 교환" : "교전 · 포지셔닝"}
                        </h4>
                        <p>{tip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="general-notice">
                  <Info size={17} />
                  <p>
                    이 챔피언의 개별 상대법은 아직 준비 중이에요. 아래 공식 스킬
                    설명을 확인하고, 외부 분석에서 라인별 상성을 함께
                    확인하세요.
                  </p>
                </div>
              )}
              <details className="enemy-skills">
                <summary>
                  <BookOpen size={15} />
                  {enemy.name}의 스킬 확인하기
                  <ChevronDown size={16} />
                </summary>
                <SkillRow symbol="P" skill={enemy.passive} />
                {enemy.spells.map((s, i) => (
                  <SkillRow key={s.name} symbol={"QWER"[i]} skill={s} />
                ))}
              </details>
              <div className="external-links">
                <a
                  href={`https://op.gg/lol/champions/${enemy.id === "MonkeyKing" ? "wukong" : enemy.id.toLowerCase()}/build`}
                  target="_blank"
                  rel="noreferrer"
                >
                  OP.GG에서 {enemy.name} 분석 <ExternalLink size={13} />
                </a>
                <a href="https://lol.ps/" target="_blank" rel="noreferrer">
                  LOL.PS에서 확인 <ExternalLink size={13} />
                </a>
              </div>
              <p className="source-note">
                상대법은 스킬 특성을 바탕으로 작성한 참고 가이드예요. 외부
                사이트의 실시간 통계나 게시글을 수집한 결과가 아니며,
                패치·숙련도·라인 상황에 따라 달라질 수 있어요.
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
function SkillRow({
  symbol,
  skill,
}: {
  symbol: string;
  skill: { name: string; description: string };
}) {
  return (
    <div className="skill-row">
      <span>{symbol}</span>
      <div>
        <h4>{skill.name}</h4>
        <p>{skill.description}</p>
      </div>
    </div>
  );
}
function Completion({
  draft,
  onInspect,
}: {
  draft: Draft;
  onInspect: (id: string, team: Team) => void;
}) {
  return (
    <section className="completion">
      <div className="completion-badge">
        <Check size={25} />
      </div>
      <span className="eyebrow">READY FOR THE RIFT</span>
      <h2>두 팀의 드래프트가 완성됐어요.</h2>
      <p>
        선택한 챔피언을 눌러 상대법을 확인하고, 마지막 게임 플랜을 세워보세요.
      </p>
      <div className="composition-reports">
        {(["blue", "red"] as Team[]).map((team) => {
          const picks = teamSelections(draft, team, "pick");
          const ids = picks.map((s) => s.championId);
          const synergies = SYNERGIES.filter((s) =>
            s.pair.every((id) => ids.includes(id)),
          );
          return (
            <div key={team} className={team}>
              <h3>
                <span className="team-dot" />
                {TEAM_NAMES[team]} 연계 포인트
              </h3>
              <div className="completion-portraits">
                {picks.map((p) => (
                  <button
                    key={p.championId}
                    onClick={() => onInspect(p.championId, team)}
                    title={`${championMap.get(p.championId)!.name} 상대법`}
                  >
                    <Portrait champion={championMap.get(p.championId)!} />
                  </button>
                ))}
              </div>
              {synergies.length ? (
                synergies.slice(0, 2).map((s) => (
                  <p key={s.pair.join()}>
                    <strong>
                      {s.pair
                        .map((id) => championMap.get(id)?.name)
                        .join(" + ")}
                    </strong>
                    {s.reason}
                  </p>
                ))
              ) : (
                <p>
                  등록된 전용 연계가 없어요. 핵심 군중 제어의 사용 순서와 딜러의
                  진입 타이밍을 팀원과 맞춰보세요.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
export default function App() {
  const [draft, setDraft] = useState<Draft>(() => {
    try {
      return restoreDraft(localStorage.getItem(STORAGE_KEY), champions);
    } catch {
      return { selections: [] };
    }
  });
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>("TOP");
  const [infoModal, setInfoModal] = useState<
    "guide" | "sources" | "reset" | null
  >(null);
  const [report, setReport] = useState<{ id: string; team: Team } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const turn = TURNS[draft.selections.length];
  const complete = !turn;
  const used = new Set(draft.selections.map((s) => s.championId));
  const selected = selectedId ? championMap.get(selectedId) : undefined;
  const targetRole = nextRole(
    draft,
    champions,
    roleFilter === "ALL" ? undefined : roleFilter,
  );
  const recommendations = recommend(
    draft,
    champions,
    roleFilter === "ALL" ? undefined : roleFilter,
  );
  const visible = champions.filter(
    (c) =>
      (roleFilter === "ALL" || c.roles.includes(roleFilter)) &&
      matchesSearch(c, query),
  );
  const occupiedRoles = turn
    ? teamSelections(draft, turn.team, "pick").map((p) => p.role)
    : [];
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [draft]);
  useEffect(() => {
    gridRef.current?.scrollTo({ top: 0 });
  }, [query, roleFilter]);
  const selectChampion = (c: Champion, role?: Role) => {
    if (used.has(c.id) || complete) return;
    setSelectedId(c.id);
    setSelectedRole(
      role && !occupiedRoles.includes(role)
        ? role
        : (c.roles.find((r) => !occupiedRoles.includes(r)) ??
            ROLES.find((r) => !occupiedRoles.includes(r)) ??
            "TOP"),
    );
  };
  const confirm = () => {
    if (!selected || !turn) return;
    setDraft((d) => lockChampion(d, selected, selectedRole));
    setSelectedId(null);
  };
  const undo = () => {
    setDraft((d) => ({ selections: d.selections.slice(0, -1) }));
    setSelectedId(null);
  };
  const inspect = (id: string, team: Team) => setReport({ id, team });
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#" aria-label="Draft Lab 홈">
            <span className="brand-mark">
              <Layers3 size={23} strokeWidth={2.3} />
            </span>
            <span>
              DRAFT<span className="brand-light">LAB</span>
              <i />
            </span>
          </a>
          <nav aria-label="주 메뉴">
            <a className="nav-active" href="#simulator">
              밴픽 시뮬레이터
            </a>
            <button onClick={() => setInfoModal("guide")}>
              사용 가이드 <ArrowUpRight size={13} />
            </button>
          </nav>
          <div className="header-right">
            <span className="version-tag">
              <span />
              DATA {rawData.version}
            </span>
            <button
              className="icon-button"
              aria-label="데이터와 출처"
              onClick={() => setInfoModal("sources")}
            >
              <CircleHelp size={19} />
            </button>
          </div>
        </div>
      </header>
      <main className="page-container">
        <section className="hero">
          <div className="hero-art" />
          <div className="hero-lines" />
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="lime-line" />
              THE GAME STARTS IN THE DRAFT
            </div>
            <h1>
              승리를 설계하는
              <br />
              가장 확실한 <span>첫 수.</span>
            </h1>
            <p>
              상대의 픽을 읽고, 우리 팀의 시너지를 완성하세요.
              <br className="mobile-break" /> 당신의 다음 선택을 함께
              고민합니다.
            </p>
            <div className="hero-features">
              <span>
                <Swords size={13} />
                실전 밴픽
              </span>
              <span>
                <GitBranch size={13} />
                조합 시너지
              </span>
              <span>
                <Target size={13} />
                상대법 가이드
              </span>
            </div>
          </div>
          <div className="hero-label">
            <span>DRAFT SMART.</span>
            <span>PLAY TO WIN.</span>
            <small>SUMMONER'S RIFT / 5 V 5</small>
          </div>
        </section>
        <div className="workspace-heading" id="simulator">
          <div>
            <span className="workspace-square" />
            <h2>밴픽 시뮬레이터</h2>
            <span className="mode-tag">토너먼트 드래프트</span>
          </div>
          <div className="workspace-actions">
            <span className={`save-status ${saveFailed ? "failed" : ""}`}>
              <span />
              {saveFailed ? "자동 저장 불가" : "자동 저장됨"}
            </span>
            <button onClick={undo} disabled={!draft.selections.length}>
              <Undo2 size={14} />
              되돌리기
            </button>
            <button
              onClick={() => setInfoModal("reset")}
              disabled={!draft.selections.length}
            >
              <RotateCcw size={14} />
              <span>초기화</span>
            </button>
          </div>
        </div>
        <section className="phase-bar" aria-label="드래프트 진행 상황">
          <div className="phase-steps">
            {PHASE_NAMES.map((name, i) => (
              <div
                className={`phase-step ${complete || (turn && turn.phase > i) ? "done" : ""} ${turn?.phase === i ? "current" : ""}`}
                key={name}
              >
                <span>
                  {complete || (turn && turn.phase > i) ? (
                    <Check size={12} />
                  ) : (
                    `0${i + 1}`
                  )}
                </span>
                <strong>{name}</strong>
                {i < 3 && <ChevronRight size={15} />}
              </div>
            ))}
          </div>
          <span className="phase-count">
            <b>{String(draft.selections.length).padStart(2, "0")}</b> / 20{" "}
            <span>선택 완료</span>
          </span>
        </section>
        <div className="draft-layout">
          <TeamPanel
            team="blue"
            draft={draft}
            onInspect={inspect}
            onRole={(i, r) => setDraft((d) => changeRole(d, i, r))}
          />
          <div className="draft-center">
            {complete ? (
              <Completion draft={draft} onInspect={inspect} />
            ) : (
              <section className="champion-panel" aria-label="챔피언 선택">
                <div className={`turn-banner ${turn.team}`} aria-live="polite">
                  <div className="turn-icon">
                    {turn.action === "ban" ? (
                      <ShieldBan size={18} />
                    ) : (
                      <Swords size={18} />
                    )}
                  </div>
                  <div>
                    <strong>
                      {TEAM_NAMES[turn.team]}의{" "}
                      {turn.action === "ban" ? "밴" : "픽"} 차례입니다
                    </strong>
                    <span>
                      {turn.action === "ban"
                        ? "상대에게 내어주고 싶지 않은 챔피언을 선택하세요."
                        : "우리 팀의 다음 한 수를 선택하세요."}
                    </span>
                  </div>
                  <span className="turn-label">
                    {turn.team.toUpperCase()} TO {turn.action.toUpperCase()}
                  </span>
                </div>
                <div className="champion-toolbar">
                  <div className="role-filters" aria-label="포지션 필터">
                    <button
                      className={roleFilter === "ALL" ? "active" : ""}
                      onClick={() => setRoleFilter("ALL")}
                      aria-pressed={roleFilter === "ALL"}
                      aria-label="전체 포지션"
                      title="전체 포지션"
                    >
                      <Layers3 size={16} />
                      <span>전체</span>
                    </button>
                    {ROLES.map((role) => (
                      <button
                        key={role}
                        className={roleFilter === role ? "active" : ""}
                        onClick={() => setRoleFilter(role)}
                        aria-pressed={roleFilter === role}
                        aria-label={ROLE_NAMES[role]}
                        title={ROLE_NAMES[role]}
                      >
                        <RoleIcon role={role} />
                        <span>{ROLE_NAMES[role]}</span>
                      </button>
                    ))}
                  </div>
                  <label className="champion-search">
                    <Search size={15} />
                    <input
                      aria-label="챔피언 검색"
                      placeholder="챔피언 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="검색 지우기"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </label>
                </div>
                <div className="roster-meta">
                  <span>
                    CHAMPION POOL <b>{visible.length}</b>
                  </span>
                  <span>이름 · 영문 · 초성 검색</span>
                </div>
                <div className="champion-grid" ref={gridRef}>
                  {visible.map((c) => {
                    const taken = draft.selections.findIndex(
                      (s) => s.championId === c.id,
                    );
                    const isUsed = taken >= 0;
                    return (
                      <button
                        key={c.id}
                        className={`champion-card ${selectedId === c.id ? "selected" : ""} ${isUsed ? "unavailable" : ""}`}
                        onClick={() =>
                          selectChampion(
                            c,
                            roleFilter === "ALL" ? undefined : roleFilter,
                          )
                        }
                        disabled={isUsed}
                        aria-label={`${c.name}${isUsed ? " 선택됨" : " 선택"}`}
                        aria-pressed={selectedId === c.id}
                      >
                        <div className="champion-image">
                          <Portrait champion={c} />
                          {isUsed && (
                            <span
                              className={`used-overlay ${TURNS[taken].action}`}
                            >
                              {TURNS[taken].action === "ban" ? (
                                <ShieldBan size={21} />
                              ) : (
                                <Check size={22} />
                              )}
                            </span>
                          )}
                          {selectedId === c.id && (
                            <span className="selected-check">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                  {!visible.length && (
                    <div className="empty-search">
                      <Search size={27} />
                      <strong>검색 결과가 없어요</strong>
                      <p>다른 이름이나 포지션으로 찾아보세요.</p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setRoleFilter("ALL");
                        }}
                      >
                        필터 초기화
                      </button>
                    </div>
                  )}
                </div>
                <div className="selection-bar">
                  <div className="selection-preview">
                    {selected ? (
                      <>
                        <Portrait champion={selected} />
                        <div>
                          <strong>{selected.name}</strong>
                          {turn.action === "pick" ? (
                            <label>
                              <select
                                aria-label="선택 챔피언 포지션"
                                value={selectedRole}
                                onChange={(e) =>
                                  setSelectedRole(e.target.value as Role)
                                }
                              >
                                {ROLES.filter(
                                  (r) => !occupiedRoles.includes(r),
                                ).map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_NAMES[r]}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown size={12} />
                            </label>
                          ) : (
                            <span>상대의 선택지에서 제외</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="preview-placeholder">
                          {turn.action === "ban" ? (
                            <ShieldBan size={18} />
                          ) : (
                            <Swords size={18} />
                          )}
                        </div>
                        <div>
                          <strong>어떤 챔피언을 선택할까요?</strong>
                          <span>챔피언을 고른 뒤 확정해 주세요</span>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    className={`confirm-button ${turn.action}`}
                    onClick={confirm}
                    disabled={!selected}
                  >
                    {turn.action === "ban" ? "밴 확정" : "픽 확정"}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </section>
            )}
            {!complete && (
              <section className="recommendation-section">
                <div className="recommendation-heading">
                  <div>
                    <Sparkles size={17} />
                    <h3>
                      {turn.action === "ban"
                        ? "밴, 이런 선택은 어때요?"
                        : "다음 픽, 이런 선택은 어때요?"}
                    </h3>
                  </div>
                  <span>
                    {turn.action === "pick"
                      ? `${ROLE_NAMES[targetRole]} 추천`
                      : "조합 기반 후보"}
                  </span>
                </div>
                <div className="recommendation-cards">
                  {recommendations.map((r, i) => (
                    <button
                      key={r.champion.id}
                      className={`recommendation-card ${selectedId === r.champion.id ? "is-selected" : ""}`}
                      onClick={() =>
                        selectChampion(
                          r.champion,
                          turn.action === "pick" ? targetRole : undefined,
                        )
                      }
                      aria-label={`${r.champion.name} 추천 선택`}
                    >
                      <div className="recommendation-card-top">
                        <Portrait champion={r.champion} />
                        <div>
                          <span className="recommendation-category">
                            {r.reasons[0].label}
                          </span>
                          <strong>{r.champion.name}</strong>
                        </div>
                        <span className="recommendation-rank">0{i + 1}</span>
                      </div>
                      <p>{r.reasons[0].text}</p>
                      {r.reasons[1] && (
                        <p className="second-reason">{r.reasons[1].text}</p>
                      )}
                      <span className="recommendation-bottom">
                        {r.champion.roles
                          .map((role) => ROLE_NAMES[role])
                          .join(" · ")}
                        <ArrowUpRight size={13} />
                      </span>
                    </button>
                  ))}
                </div>
                <p className="recommendation-note">
                  <Info size={11} />
                  스킬 상호작용·포지션을 기준으로 한 참고 추천입니다. 실시간
                  승률 순위가 아니에요.
                </p>
              </section>
            )}
          </div>
          <TeamPanel
            team="red"
            draft={draft}
            onInspect={inspect}
            onRole={(i, r) => setDraft((d) => changeRole(d, i, r))}
          />
        </div>
        <div className="bottom-guide">
          <span>
            <BookOpen size={15} />
            선택한 챔피언을 클릭하면 <strong>상대법과 스킬 정보</strong>를
            확인할 수 있어요.
          </span>
          <button onClick={() => setInfoModal("guide")}>
            처음이신가요? 사용 가이드 <ArrowUpRight size={13} />
          </button>
        </div>
      </main>
      <footer className="site-footer">
        <div>
          <span className="footer-brand">
            DRAFT LAB<span>.</span>
          </span>
          <span>좋은 게임은, 좋은 선택에서.</span>
        </div>
        <p>
          Riot Games의 공식 서비스가 아닙니다. 챔피언 및 이미지 © Riot Games.
        </p>
        <button onClick={() => setInfoModal("sources")}>
          데이터 및 출처 <ArrowUpRight size={12} />
        </button>
      </footer>
      {report && (
        <MatchupModal
          key={report.id}
          id={report.id}
          team={report.team}
          draft={draft}
          onClose={() => setReport(null)}
        />
      )}
      {infoModal === "reset" && (
        <Modal
          title="드래프트 초기화"
          onClose={() => setInfoModal(null)}
          className="small-modal"
        >
          <div className="dialog-symbol">
            <RotateCcw size={25} />
          </div>
          <h2>새로운 드래프트를 시작할까요?</h2>
          <p>현재 밴픽과 저장된 진행 상태가 초기화돼요.</p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setInfoModal(null)}
            >
              이어서 진행
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setDraft({ selections: [] });
                setSelectedId(null);
                setQuery("");
                setRoleFilter("ALL");
                setInfoModal(null);
              }}
            >
              초기화하기
              <ArrowRight size={15} />
            </button>
          </div>
        </Modal>
      )}
      {infoModal === "guide" && (
        <Modal title="사용 가이드" onClose={() => setInfoModal(null)}>
          <h2>승리할 조합을 만드는 방법</h2>
          <p className="modal-lead">
            한 화면에서 양 팀을 번갈아 조작하는 밴픽 연습 도구예요.
          </p>
          <div className="guide-steps">
            {[
              {
                title: "실제 대회처럼 밴하고 픽하세요",
                text: "1차 밴 6개 → 1차 픽 6개 → 2차 밴 4개 → 2차 픽 4개. 완료하면 양 팀이 각각 5밴·5픽을 가져요. 같은 챔피언은 다시 고를 수 없어요.",
              },
              {
                title: "세 가지 추천에서 다음 수를 찾아보세요",
                text: "상대 픽 대응, 원딜–서포터와 미드–정글 시너지, 빈 포지션을 함께 고려해요. 포지션 필터로 원하는 추천 역할을 지정할 수도 있어요.",
              },
              {
                title: "포지션을 조정하고 상대법을 확인하세요",
                text: "선택 전 하단에서 포지션을 지정하고, 선택 후에는 팀 카드의 포지션을 바꿀 수 있어요. 이미 채운 포지션을 고르면 두 챔피언의 역할이 교환돼요. 팀 카드의 챔피언을 클릭하면 상대법과 공식 스킬 설명이 열려요.",
              },
              {
                title: "부담 없이 여러 조합을 실험하세요",
                text: "되돌리기로 직전 선택을 취소할 수 있어요. 진행 상태는 현재 브라우저에 자동 저장돼요. 다른 기기와 실시간으로 공유하는 멀티플레이 기능은 제공하지 않아요.",
              },
            ].map((step, i) => (
              <div key={step.title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {infoModal === "sources" && (
        <Modal title="데이터 및 출처" onClose={() => setInfoModal(null)}>
          <h2>무엇을 바탕으로 추천하나요?</h2>
          <p className="modal-lead">
            출처와 추천의 기준을 투명하게 안내합니다.
          </p>
          <div className="source-block">
            <h3>
              <Layers3 size={17} />
              챔피언 · 이미지 · 스킬 설명
            </h3>
            <p>
              Riot Games Data Dragon {rawData.version}의 한국어 데이터와 기본
              초상화를 사용해요. 공개 Git 미러의 고정 커밋을 통해 가져와
              사이트에 함께 저장했어요. 최신 패치 자동 동기화는 하지 않아요.
            </p>
            <a
              href="https://developer.riotgames.com/docs/lol#data-dragon"
              target="_blank"
              rel="noreferrer"
            >
              Riot Data Dragon 문서
              <ExternalLink size={13} />
            </a>
            <a
              href={`${rawData.mirror}/tree/${rawData.ref}`}
              target="_blank"
              rel="noreferrer"
            >
              데이터 미러 · 고정 버전
              <ExternalLink size={13} />
            </a>
          </div>
          <div className="source-block">
            <h3>
              <Sparkles size={17} />
              추천과 상대법
            </h3>
            <p>
              사전에 작성한 스킬 연계 규칙과 포지션 정보로 추천해요. 전용
              상호작용이 있으면 우선하고, 없으면 포지션과 조합 보완을 기준으로
              후보를 보여줘요. 등록되지 않은 개별 상대법은 준비 중으로 표시하고
              공식 스킬 정보를 제공해요.
            </p>
            <p>
              실시간 승률 데이터, 생성형 AI 분석, OP.GG·LOL.PS 게시글을 수집한
              결과는 아니에요. 최신 통계는 챔피언 리포트의 외부 링크에서 확인해
              주세요.
            </p>
          </div>
          <p className="source-note">
            DRAFT LAB은 Riot Games에서 보증하거나 승인한 서비스가 아닙니다.
            League of Legends 및 관련 자산은 Riot Games의 상표 또는
            등록상표입니다.
          </p>
        </Modal>
      )}
    </div>
  );
}
