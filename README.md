# DRAFT LAB

리그 오브 레전드 토너먼트 밴픽을 연습하고 조합 시너지·스킬 상호작용을 확인하는 한국어 웹사이트입니다. React, TypeScript, Vite로 만들었으며 별도 API 키나 데이터베이스가 필요하지 않습니다.

## 시작하기

Node.js 22.12 이상(이 환경에서는 24.19로 검증)을 사용합니다.

```bash
cd /workspace/LOL
npm ci
npm run dev
```

배포 파일은 `npm run build`로 생성되는 `dist/`입니다. 정적 호스팅 서비스에서 제공할 수 있습니다. `npm run preview`로 빌드 결과를 확인할 수 있습니다.

이 클라우드 환경에서 npm 기본 캐시 경로를 쓸 수 없다면 `npm --cache /workspace/.npm-cache ci`를 사용하세요.

## 설치 없이 열 수 있는 홈페이지 파일

```bash
npm run export:html
npm run test:html
```

`artifacts/draft-lab.html`은 챔피언 173명의 이미지, 한국어 글꼴, 스크립트와 추천 데이터를 모두 포함한 단일 HTML 파일입니다. 파일을 내려받아 Chrome 또는 Edge에서 열면 서버나 인터넷 연결 없이 밴픽을 진행할 수 있습니다. 외부 분석 링크를 누를 때는 인터넷이 필요합니다. 브라우저 설정에 따라 파일의 진행 상태 저장이 제한될 수 있습니다.

`test:html`은 내보낸 HTML 하나만 로컬 HTTP로 제공하고, 다른 네트워크 요청을 차단한 상태에서 20턴 밴픽·대응 추천·상대법·저장 복원·모바일 화면을 검증합니다. 검증 브라우저의 관리 정책이 `file://` 접근을 차단하므로 파일 직접 열기와 해당 환경의 파일별 저장 동작은 별도로 검증하지 못했습니다. 결과 화면은 `artifacts/homepage.png`와 `artifacts/homepage-mobile.png`에 저장됩니다. 이 HTML 내보내기는 공개 호스팅 배포와는 별개입니다.

## 제공 기능

- 실제 토너먼트 순서의 총 20턴 드래프트: 양 팀 각각 5밴·5픽
- 같은 챔피언 중복 밴·픽 방지, 되돌리기, 초기화
- 한국어 이름, 영문 ID, 초성 검색과 포지션 필터
- 한 번에 3명의 챔피언 추천 및 이유: 상대 픽 대응, 원딜–서포터·미드–정글 시너지, 포지션·탱커 보완
- 포지션 선택 및 같은 팀 내 역할 교환
- 선택한 챔피언별 상대 픽 전환, 작성된 상대법, 한국어 공식 스킬 설명
- 완료한 두 팀의 조합 연계 요약
- 브라우저 localStorage 진행 저장 및 잘못된 저장 데이터 검증
- 반응형 화면, 키보드 조작과 대화상자 포커스 관리

추천은 `src/data/strategy.ts`에 작성된 연계·대응 규칙과 `src/lib/recommend.ts`의 점수 규칙으로 계산합니다. 승률 통계, 현재 티어 순위, 생성형 AI 응답이 아닙니다. 포지션 역시 편집한 참고 분류이며 여러 역할을 직접 지정할 수 있습니다. 숙련도·라인 상황·현재 패치에 따른 통계 상성을 보장하지 않습니다.

개별 상대법이 없는 경우 준비 중이라고 표시하고 상대의 공식 스킬 설명을 제공합니다. OP.GG와 LOL.PS는 사용자가 직접 추가 분석을 확인하는 외부 링크입니다. 해당 사이트의 콘텐츠를 수집하거나 사이트의 분석을 인용한 것처럼 표시하지 않습니다.

현재는 한 브라우저에서 양 팀을 조작합니다. 온라인 방 생성, 기기 간 공유, 실시간 멀티플레이는 구현하지 않았습니다.

## 데이터와 이미지

현재 포함된 Riot Data Dragon 버전은 **16.21.1**이며, 한국어 챔피언 173명의 기본 초상화·패시브·QWER 설명을 제공합니다. 이미지와 글꼴을 로컬로 제공하므로 실행 중 외부 CDN 요청이 필요하지 않습니다. 실제 게임의 스킬 수치와 세부 판정은 게임 내 정보를 우선하세요.

Riot CDN이 이 환경의 초기 네트워크 정책에서 차단되어, 공개 Git 미러 [InFinity54/LoL_DDragon](https://github.com/InFinity54/LoL_DDragon)의 고정 커밋 `d09a61205149f7e3488928e6b286676fb41065c4`에 있는 Riot 자료를 사용했습니다. 원본 자산은 Riot Games 소유입니다. 데이터 출처와 고정 버전은 사이트의 ‘데이터 및 출처’에서도 확인할 수 있습니다.

```bash
python3 scripts/sync_champions.py
```

위 명령은 고정 버전의 데이터를 다시 생성하며, 이미 있는 초상화는 재사용합니다. 새로운 패치로 올리려면 스크립트의 `REF`, 챔피언별 포지션, 상대법 규칙을 함께 검토한 뒤 테스트하세요. 새 패치가 자동 적용되지는 않습니다. 다운로드 시 TLS 검증을 유지합니다.

글꼴은 `@fontsource-variable/noto-sans-kr` 패키지의 Noto Sans KR(SIL Open Font License)을 사용합니다. 아이콘은 lucide-react(ISC)입니다. League of Legends 및 관련 자산은 Riot Games의 상표 또는 등록상표이며 이 프로젝트는 Riot Games의 공식 서비스가 아닙니다.

## 검증

```bash
npm test
npm run build
```

단위 테스트는 순서·중복·종료 조건·포지션 교환·저장 복원·검색·4방향 시너지·대응 추천·전략 데이터 무결성을 검증합니다.

```bash
# 이 클라우드에는 시스템 Chromium이 설치되어 있습니다.
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

다른 환경에서는 `npx playwright install chromium`으로 브라우저를 준비한 뒤 `npm run test:e2e`를 실행하세요. E2E 테스트는 실제 20턴 진행, 상대법 대화상자, 새로고침 복원, 되돌리기·초기화, 검색·필터, 이미지, 키보드 접근성, 모바일 조작을 확인합니다. 테스트 실행 시 개발 서버가 자동 시작됩니다.

## 주요 파일

- `src/App.tsx`: 드래프트 화면, 팀 패널, 챔피언 리포트
- `src/lib/draft.ts`: 20턴 상태 전이와 저장 검증
- `src/lib/recommend.ts`: 추천 및 상대법 선택
- `src/data/strategy.ts`: 편집 가능한 시너지·대응·기본 상대법
- `src/data/champions.json`: 고정 버전의 한국어 챔피언 정보
- `scripts/sync_champions.py`: 데이터와 이미지 재생성
