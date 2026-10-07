# 작업 기록

## 2026-10-04: 로컬 숏폼 자동 제작 조사·기획

목표: 기존 조사 자료와 최신 공식 근거를 종합해 영어 기본, 요청 시 다국어, 하루 1~3편, 로컬 야간 제작, 비용·토큰 최소화에 맞는 계획 작성.

관측: 기존 자료 12개, 실제 렌더러 없음. Git 저장소 아님. 기존 스키마는 한국어 고정이며 provider는 `local`을 이미 허용. 장비는 M3 Pro·36GiB, 관측 시 여유 디스크 약 32GiB.

결정: 기존 조사·계약 파일은 참고로 보존. README에 최신 기획 진입점·기존 제약 표시. 새 기획은 조건부 Remotion/HyperFrames 비교, 영어 Kokoro/관리형 음성 비교, 데이터 기반 템플릿, 무인 후보 렌더와 사람 게시 검수 분리. 구현·예약·결제·게시를 시작하지 않음.

산출물:

- `planning/2026-10-04-research-plan.md`: 요구·도구 비교·다국어·제작 구조·기존 계약 차이·로드맵.
- `planning/operations-budget.md`: 야간 큐·재시도·토큰·월 30/60/90편 비용·저장 공간·운영 시험.
- `planning/sources.md`: 출처, 최신 본문과 검색 사본의 차이, 접근·검증 한계.
- `README.md`: 최신 기획 안내 추가. 기존 본문 보존.

검증 결과:

- 시작·종료 시 Git 상태 확인 모두 저장소 아님. Git diff 대신 사전 SHA-256으로 원본 보존 확인.
- README 외 기존 11개 파일 해시 동일. README도 새 안내를 제외한 기존 본문이 사전 해시와 일치.
- 전달 문서 5개의 링크 74개를 추출해 로컬 대상의 존재 확인; 깨진 로컬 링크 0. 외부 URL 전체의 영구 가용성을 보장하는 검사는 아님.
- 월 30/60/90편의 문자·토큰·LLM·TTS·합산 비용 및 비압축 프레임 용량을 별도 계산으로 대조 완료.
- 기존 구조 예시 통과, `en-US` 변경 시 `$.language: const` 거부, `provider=local` 허용을 기존 검사기로 확인. 코드 수정 없음.
- 의사결정 검토: 개인 무료/조직 유료, 영어/요청 다국어, 무인 후보 생성/사람 게시 승인, 수면 지연/운영창 종료, timeout/미확정 청구, 엔진 시험 실패의 경로를 문서에 명시.
- 엔진 설치·렌더·TTS 청취·관련 없는 빌드는 수행하지 않음. 예약 설정·유료 호출·외부 게시 없음.

다음 단계: 구현 요청 시 콘텐츠 주제·개인/조직 사용 관계·유료 예산·야간 전원 조건을 확정하고 동일 영어 샘플의 엔진·음성 비교부터 시작. 미검증: 영상 품질·렌더 속도·음성 품질·밤의 실제 실행·플랫폼 업로드·기존 정기 모니터 등록 여부.

## 2026-10-04 후속: Muse VM·구독 CLI 운영으로 개정

요청: 로컬 전용 조건 해제, Claude/GPT 중심과 기존 Muse VM 원격 운영을 가장 적합한 설계에 반영. 추가 답변으로 구독 로그인을 확인.

관측: 로컬은 여전히 Git 저장소 아님. 지정 GitHub는 공개 저장소이며 API contents가 빈 저장소라고 응답. VM OS·사양·CLI 제품·버전·quota는 아직 미확인. 공식 Codex/Claude 비대화형 실행·인증·비용 문서를 확인했으며 `gpt-cli`/`claude-cli`를 공식 제품으로 단정하지 않음.

결정: Muse VM 단일 워커·기존 구독 CLI·관리형 TTS·VM 렌더 기본. VM 렌더 시험 미달에만 Mac 전달 경로 추가. Claude 작성 기본 후보, GPT 선택 검토·개발 지원. quota/auth 실패는 보류, API·추가 크레딧 자동 전환 없음. 기존 API 단가 민감도와 구독/VM 총비용 분리.

변경: README·종합 기획·운영 예산·출처 갱신, `planning/remote-execution.md` 추가. 기존 V1 계약·예시·검증 코드 보존. GitHub 커밋·푸시·VM 설정·유료 호출 없음.

검증 완료: 변경은 기존 문서 5개와 새 실행 설계 1개로 한정. 나머지 기존 파일 11개 SHA-256 동일. 사전 스냅샷 대비 diff 검토, 문서의 링크 93개 중 로컬 대상 존재 확인, API 민감도 3배/10배 산식 재계산 통과. 구독 한도·인증 만료·API 전환 금지·VM 성능 미달·Mac 임대 만료·공개 저장소 분기 점검. 종료 시에도 Git 저장소가 아니어서 Git diff 대신 스냅샷 비교 사용. 실제 CLI·VM 무인 실행과 렌더 성능은 후속 P0 시험 대상.

다음 단계: VM capability 점검 → 준비된 자료로 한 편 생성 → VM 렌더 시험 → 7일 파일럿. VM 세부 정보는 미확정 값으로 두어 문서 수정 완료를 막지 않는다.

## 2026-10-04 기획 v2

요청: X·Reddit 최신 기법 조사, Claude 중심·운영비 최소, 개인 수익화 채널(포맷 다양, 한·영·일·중), Muse VM 선택.

결정: HyperFrames 기본(Remotion 대안), Gemini 3.8 Flash TTS 단일화, whisper.cpp 정렬 후 원 대본 재정렬, Mac 로컬 우선, 대화형 `/short` 스킬 운영, 무인 실행은 Anthropic 헤드리스 과금 정책 확정 후.

산출물: `planning/2026-10-04-claude-code-render-plan-v2.md`, README 진입점 갱신. 기존 문서 수정 없음.

한계: x.com(robots)·Reddit(차단) 원문 미열람, 검색 결과와 2차 자료로 대체. 설치·렌더·TTS 청취 미실행.

## 2026-10-04 GPT 문서 정리·Claude 설계 리뷰

요청: 프로젝트의 기존 GPT 자료를 최신 Claude 계획과 맞게 정리하고, `planning/` 설계의 보강·개선점을 리뷰.

관측: 이번 시작 시 로컬 Git 저장소와 HEAD `647746e`가 존재했다. 추적 파일은 Claude v2 한 개, 나머지 기존 자료는 미추적 상태였고 staged/unstaged diff는 없었다. 이전 “Git 저장소 없음” 기록은 당시 이력으로 유지했다. 실제 렌더러·TTS adapter·모션 도구는 없고 v1 예시 스키마·Python 검사기만 존재했다.

결정: v2를 제품 방향의 기준으로 두고 과거 Remotion/Azure/한국어 전용 및 VM/영어/야간 운영 문서는 이력으로 표시. 원래 경로와 본문을 보존했다. Claude 원문은 리뷰 대상이므로 직접 개정하지 않고 제안을 별도 문서에 남겼다. 코드·스키마 변경, 예약 생성, 외부 메시지, 키 발급, 유료 호출, 커밋·푸시는 범위에 넣지 않았다.

변경: README의 상충하는 최신 기획 안내와 저장소 상태 정정, 기존 GPT 문서 9개의 적용 상태 표시, `04-agent-handoff.md`의 현재 역할·인계 갱신과 과거 원문 보존, `06-monitoring.md`의 미확인 등록 주장 구분. 새 `planning/2026-10-04-plan-review.md`에 R1~R7, 비용 재계산, 최소 구현 순서 제안, 공식 재확인·미검증 범위를 기록했다. 작업 기록 포함 기존 13개 문서 변경·새 리뷰 1개 추가.

주요 리뷰: 모션 Block/Component 조립 차이와 license 필드, v2 전체 데이터 계약 부재, 발화 변경 시 음성 캐시 무효화, 전사/정렬 실패 경로, 유료 대체·F0 재시도 제한, 출력 run ID·검수 해시, 검증 상태·버전 고정. 월 총출력 90개와 4언어 확장 360개를 분리하고 TTS 입력비·재생성 여유를 보완했다.

검증:

- 변경 전 임시 스냅샷과 SHA-256 대조로 Claude 원문 2개·스키마/예시/검증 코드 4개가 그대로임을 확인. 기존 이력 문서 본문과 과거 인계·모니터링 내용도 보존 확인.
- 미추적 문서도 포함한 스냅샷 diff 검토. Git diff만으로 문서 변경이 보이지 않는 저장소 상태를 별도로 고려.
- 로컬 Markdown 링크·절 링크 48개 검사, 깨진 링크 0개. 외부 전체 링크의 가용성 검사는 아님.
- 기존 단위 테스트 3개(잘못된 입력 10개 하위 사례 포함) 및 v1 예시 검사 통과. 영어 언어·새 keyword 장면·객체형 motion을 v1에서 거부하는 현상을 별도로 재현.
- TTS 비용표 30/60/90/360개·20% 재생성·2027 단가 계산 대조 통과.
- 결정 시나리오 검토: 현재 HyperFrames/Mac 경로, 과거 VM 지시의 비적용, 화면 변경/발화 변경 캐시 분기, 언어별 미검증 효과 차단, 무료 quota/불명 timeout 보류, 검수 파일/실제 게시 분리, 리뷰 제안/원문 확정사항 구분.

다음 단계: 후속 설계 개정에서 R1~R4를 우선 반영하고 새 계약 경계·캐시·정렬 실패 기준을 확정한 뒤 첫 한국어 샘플 구현. 3~5개 모션부터 시작하는 축소안은 제안 상태다. 실제 렌더·TTS 청취·Mac 성능·계정 quota·VM·모니터링 등록 여부는 확인하지 않았다.

## 2026-10-04 리뷰 반영 (Claude r2)

`planning/2026-10-04-plan-review.md`의 R1~R7, 비용 단위, 범위 축소안을 기획 v2와 모션 문서에 반영했다. 채택·보류 내역은 리뷰 문서 §7. 코드·스키마·커밋 변경 없음.

## 2026-10-04 에이전트 지침·폴더 구조 정리 (Claude)

공통 규칙을 `AGENTS.md`(영어, 61줄)에 두고 `CLAUDE.md`·`GEMINI.md`가 import한다. Claude Code는 같은 폴더에 CLAUDE.md가 있으면 AGENTS.md를 직접 읽지 않으므로 import 방식을 택했다(공식 memory 문서 확인). `.claude/settings.json`에 `git push`·`rm -rf`·`.env` 읽기 deny, `.gitignore` 추가.

이동: 루트 01·02·03·06·sources.md와 과거 인계 원문 → `planning/archive/v1/`, v2 이전 문서 4개 → `planning/archive/pre-v2/`, v1 스키마·검사 코드 → `schemas/v1/`(05 문서는 `schemas/v1/README.md`), `aidd_docs/worklog.md` → `planning/worklog.md`, 04 인계 현행 부분 → `planning/handoff.md`. 현재 기준 문서 3개는 claude.ai 프로젝트 경로 유지를 위해 파일명을 바꾸지 않았다. v2 §6과 모션 문서의 새 스키마 경로를 `schemas/v2/scenes.schema.json`으로 명시했다.

검증: 내부 Markdown 링크 50개 깨짐 0, v1 예시 검사와 단위 테스트 3개 통과. 이 기록의 이전 항목에 남은 옛 경로는 당시 기록이라 고치지 않았다.

## 2026-10-04 S0~S3 구현 설계 (Claude) · GPT 리뷰

요청: 프로젝트 설계 진행, 필요하면 Sonnet에 위임, 설계 후 GPT 리뷰. 범위는 사용자 선택으로 S0~S3 구현 설계 문서(코드·스키마 파일 제외), 리뷰는 Codex CLI 읽기 전용.

조사: HyperFrames CLI·composition·변수·오디오·카탈로그 manifest, Gemini TTS·whisper.cpp·BudouX 최신 공식 문서를 Sonnet 서브에이전트 2개로 병렬 조사하고, Gemini 가격과 음성 생성 예시는 직접 다시 열어 확인했다. 확인한 것: HyperFrames 0.8.123(2026-10-04), 시간 속성은 초 단위, 변수는 스칼라만, Gemini 3.8 Flash TTS는 Interactions API 예시만 있고 24kHz WAV·seed 없음·타임스탬프 없음, 가격은 v2 §7과 같음, whisper.cpp Homebrew 1.8.6/upstream 1.9.4.

산출물: `planning/2026-10-04-implementation-design.md`(r2), `planning/2026-10-04-implementation-design-review.md`(Codex 리뷰 원문). README 문서 표와 AGENTS.md source-of-truth 목록에 설계 문서를 추가했다.

주요 결정(승인 대기 D1~D9): Node 단일 런타임과 의존성 최소화, scenes.json은 구절 ID(문구 해시 포함)로 시각 지정하고 프레임은 파생 timeline.json, 장면 데이터는 템플릿 내 JSON 블록, 자막은 별도 composition, pronounce.json, whisper.cpp Homebrew, F0 검사 보류, S2는 무료 티어만, run 불변.

리뷰: Codex가 G1~G10(P1 5, P2 5)과 축소안 4개를 냈고 모두 채택했다. G1은 구절 ID에 문구 해시를 넣는 방식으로, G2는 내부 누락·삽입·반복 위험 검출 규칙으로 리뷰 수정안과 다르게 고쳤다. Mac에 설치된 Codex CLI 0.144.5는 설정 모델(gpt-6-astra)을 지원하지 않아 실패했고 ChatGPT 앱 번들 0.160.0으로 실행했다.

관측: Mac은 FFmpeg 8.0.1, Node 23.9.0이라 HyperFrames 요구(FFmpeg 7.x, Node 22.x 권장)와 다르다. S0 첫 작업에서 doctor로 확인한다.

검증: 변경 문서 포함 9개 Markdown의 로컬 링크 34개 깨짐 0, v1 예시 검사와 단위 테스트 3개 통과, 설계 예시의 코드 포인트 범위 재계산, git diff로 변경 범위(AGENTS·README·handoff·worklog 수정, 설계·리뷰 2개 추가) 확인. 검증 중 Cowork VM에서 실행한 git status가 `.git/index.lock`을 남겨 사용자 승인 후 삭제했다. 설치·렌더·TTS 호출·커밋은 하지 않았다.

다음 단계: 사용자가 D1~D9를 승인하면 S0 시작(의존성 설치, whisper.cpp, Gemini 키는 사용자 발급).

## 2026-10-05 구현 설계 r3: TTS를 ElevenLabs v4로 교체 (Claude)

요청: TTS를 ElevenLabs v4로 적용, 업데이트한 Codex CLI(gpt-6-astra)로 구현 설계 리뷰.

조사: ElevenLabs 공식 문서를 Sonnet 서브에이전트로 확인했다. `eleven_v4`는 요청당 10,000자, ko·en·ja·zh 지원, SSML·style 없이 audio tag 사용, seed는 결정론 보장 없음. 일반 TTS 엔드포인트 지원 여부는 문서끼리 엇갈려 미확인. 무료 플랜 음성은 업그레이드 후에도 상업 이용 불가. 크레딧 소진 시 자동 초과 과금 없음(PAYG 잔액이 있으면 차감). v4 글자당 크레딧 비율은 문서에 없음. Forced Alignment API는 텍스트와 음성으로 글자·단어 시각과 단어별 loss를 주며 시간당 $0.22.

결정(승인 대기): D6을 whisper.cpp+LCS에서 ElevenLabs Forced Alignment 단일 경로로, D8을 무료 티어 전제에서 유료 플랜 크레딧 한도·원장 글자 상한으로 바꿨다. 문장별 연기 지시는 `script.json`의 `tag` 필드로만 받아 화면 문구·정렬 텍스트와 분리했다. 비용 추정은 ko 하루 1편 Starter, ko·en 하루 1편씩 Creator(1자 1크레딧 가정).

변경: 설계 문서 r3(§1·§2·§3·§4.1·§4.2·§4.4·§4.7·§6·§7.2~7.4·§11·§12·§13·출처), r2 본문을 `planning/archive/implementation-design-r2.md`로 보존(whisper 경로로 되돌아갈 때의 근거), 기획 v2 상단에 r3 개정 표시, README 방향 문장과 AGENTS.md의 자주 바뀌는 API 목록 수정.

발견: 어제 설계 문서를 Mac에 쓰는 과정에서 마지막 편집(§11 시험 표, §13)이 빠진 사본이 Mac과 claude.ai 프로젝트에 올라가 있었다. 같은 경로로 다시 쓸 때 이전 업로드가 재사용된 것으로 보이며, r3는 새 파일명으로 올리고 SHA-256으로 일치를 확인했다. 1차 리뷰(앱 번들 CLI 0.160.0)도 모델은 이미 gpt-6-astra(추론 medium)였다.

리뷰: Codex CLI 0.160.0, gpt-6-astra, 추론 high로 실행했으나 ChatGPT 사용 한도 초과로 실패했다(03:31 이후 재시도 가능 안내).

## 2026-10-05 2차 GPT 리뷰와 설계 r4 (Claude)

예약 작업으로 03:36에 Codex 리뷰를 다시 실행해 성공했다(gpt-6-astra, 추론 high, 약 3분). 결과는 리뷰 문서의 '2차 리뷰 (r3)' 절에 원문 그대로 붙였다. H1~H7(P1 3, P2 3, P3 1)과 축소안 3개를 모두 채택해 설계를 r4로 고쳤다. 1차 G1~G10 중 G4~G8·G10은 해결, G1·G2·G3·G9는 부분으로 판정됐고 각각 H3·H2·H1·H5~H6으로 마무리했다.

주요 변경: 수동 음성·수동 timings 경로를 정의하고 S1을 API 키 없이 진행(H1), 정렬 검출력을 다섯 경우 실제 시험과 청취 확인 목록으로 검증(H2), 구절 ID 해시를 4자에서 8자로 늘리고 충돌은 오류(H3, `항목 15입니다.`/`항목 167입니다.` 4자 충돌을 직접 계산으로 재현), 두 엔드포인트의 완전한 요청 본문과 운영 중 자동 전환 삭제(H4), 상한을 크레딧 단위로 통일하고 정렬 비율 분리(H5), 전송 전 원장 기록으로 처리 불명 시도 차단을 TTS·정렬 공통으로(H6), 소수 직렬화 규칙과 kind별 원장 시험(H7).

검증: 설계 문서는 새 파일명으로 커밋한 뒤 Mac 사본 SHA-256을 대조했다. Mac 사본 해시 c27557d3…가 작성본과 일치. 로컬 링크 48개 깨짐 0, v1 예시 단위 테스트 통과. 남은 Gemini·whisper 언급은 개정 이력·대안·출처 안내뿐이다. 설치·API 호출·커밋은 하지 않았다.

## 2026-10-05 D1~D9 승인

사용자가 구현 설계 r4의 D1~D9를 모두 승인했다. 설계 문서 상태 줄과 §2 제목, AGENTS.md의 다음 작업 문장을 고쳤다. 같은 날 사용자가 낸 중간 결과물 후보 관리·예약 확장 의견은 사용자 요청으로 설계에 반영하지 않았다.

## 2026-10-05 설계 r5: ElevenLabs Free 플랜 시험

사용자 지시로 ElevenLabs를 Free 플랜으로 시험 수준에서 진행하도록 설계를 고쳤다. D8을 개발·시험은 Free(월 1만 크레딧), 게시용 음성은 유료 전환 후 새로 합성으로 바꿨다. Free 음성은 업그레이드 후에도 상업 이용이 안 되므로 `voice.json`과 TTS 캐시 키에 `planTier`를 넣어 유료 전환 뒤 재사용을 막고, Free 음성 run은 manifest `publishable: false`와 `final.NOT-FOR-PUBLISH.mp4`로 남긴다. Free 1만 크레딧 안의 시험량(S0 약 2,500, S2 약 6,000, 1자 1크레딧 가정)을 적었다. Free 플랜 API에서 v4·Forced Alignment를 쓸 수 있는지는 미확인으로 S0 첫 호출에서 확인한다. 같은 날 검토한 GPT 조사(Qwen3-TTS 등)는 대화 의견으로만 다뤘고 설계에 넣지 않았다.

## 2026-10-05 S0 준비 확인

`.env`에 `ELEVENLABS_API_KEY`·`GEMINI_API_KEY` 변수가 있음을 값 없이 이름만 확인했다(`.gitignore` 적용). 크레딧을 쓰지 않는 조회(`/v1/user/subscription`, `/v2/voices`)를 시험했으나 두 요청 모두 400 `api_key_id_used_as_api_key`였다. 저장된 값이 `sk_`로 시작하는 실제 키가 아니라 키 ID다. 사용자가 키를 다시 넣어야 한다.

조사: ElevenLabs Default voices는 2026년 3월 이전에 만든 계정에서만 쓸 수 있고 2026-12-31에 만료된다(공식 도움말). Free 플랜 API에서 Voice Library 음성은 402 "Free users cannot use library voices via the API"로 거부된다는 사용자 보고가 있다(공식 문서로는 미확인). 계정 생성 시점에 따라 Free 플랜 API로 쓸 수 있는 음성이 없을 수 있어, 키를 고친 뒤 음성 목록 조회로 확인한다.

결정: HyperFrames 스킬은 전역 플러그인으로 설치하고 `config/tools.lock.json`으로 버전을 관리한다(설계 §11 S0). 커밋은 main에 직접 하고 push한다(저장소 공개).

## 2026-10-07 S0 구현 (Claude Opus 통합, Sonnet fixture, Codex 리뷰)

S0의 키 없이 할 수 있는 부분과 ElevenLabs 첫 호출을 끝냈다. 남은 S0 기준은 ko·en 청취 판정 하나다.

환경: HyperFrames CLI 0.8.139(2026-10-07 기준 최신)와 ajv 8.20.0을 정확한 버전으로 설치했다. `doctor --json`은 `.ok: false`인데 원인은 선택 항목(whisper-cpp, Kokoro, MusicGen, Docker 미실행)뿐이고 Node 23.9.0, FFmpeg 8.0.1, Chrome은 모두 통과했다. S0 기준을 "필수 항목 통과"로 판정했다. 1080×1920 빈 composition을 `-q draft -f 30`으로 렌더해 h264·yuv420p·30/1·60 frame을 확인했다. 기본 프로젝트는 GSAP 3.14.2를 jsDelivr CDN에서 불러오므로 S1에서 같은 버전을 `templates/_base/vendor/`에 고정한다. 렌더 품질 값은 이제 `draft`·`looks`(기본)·`delivery`(=`high`)다.

HyperFrames 스킬: 전역 플러그인 `hyperframes@hyperframes` 0.8.139, 마켓플레이스 커밋 `80c2547e`를 `config/tools.lock.json`에 적고 `scripts/env-check.mjs`로 대조한다. 마켓플레이스 체크아웃은 `~/.claude/plugins/marketplaces/hyperframes`, 설치본은 `~/.claude/plugins/cache/hyperframes/hyperframes/0.8.139`다. 체크아웃의 LFS 파일 84개는 포인터로만 받아졌다(스킬 문서와는 무관한 에셋으로 보이나 미확인).

계약·검증기: `schemas/v2/`에 languages·script·pronounce·timings·scenes 스키마를 두고 scenes는 `scenes.base.schema.json`과 `templates/<type>/props.schema.json`에서 `scripts/gen.mjs`가 만든다. 글자 수 제한은 Ajv 사용자 키워드 `maxGraphemes`로 grapheme 기준이다. `scripts/validate.mjs`는 스키마 오류를 `schema.<keyword>`, 의미 오류를 고유 코드(`phrase-id-hash`, `motion-unverified`, `transition-too-long` 등)로 낸다. 모션 자리별 허용 kind는 in이 text-in·element·number·emphasis, out이 text-out·element다. `manifest.schema.json`은 S2에서 manifest를 만들 때 쓴다. 구절 분할, 발화 범위, 숫자 경고는 S1·S2 분할기 범위다.

ElevenLabs(Free, 키 교체 후): v4는 일반 TTS 엔드포인트(`/v1/text-to-speech/{voice}`)에서 `language_code`와 함께 200으로 동작해 `tts.endpoint`를 `tts`로 정했다. `wav_24000`은 PCM 24kHz·mono·16bit다. `character-cost` 헤더가 요청 글자 수와 같았다(v4 1자 1크레딧). Forced Alignment도 Free에서 쓸 수 있고 구독 크레딧에서 빠진다. 헤더 값이 음성 1초당 약 1.1~1.16이라 `alignCreditsPerSecond`를 1.2로 두었다. Voice Library 음성은 402 `paid_plan_required`("Free users cannot use library voices via the API")로 거부되어, Free 시험은 premade 음성만 쓴다. 결제 주기 재설정은 매월 4일 12:19(KST)다.

정렬 응답: multipart로 보낸 텍스트의 `\n`이 `\r\n`으로 바뀌어 돌아온다(FormData 줄바꿈 정규화). 공백·줄바꿈도 `characters`와 `words`에 들어 있다. §7.2 3번의 대응 규칙을 "양쪽 모두 공백 문자를 건너뛰고 나머지 글자를 순서대로 맞춘다"로 확정한다. 정상 대본의 단어 loss가 0.6~1.1이라 설계 예시의 0.04는 척도가 틀렸다. 숫자를 그대로 둔 발화 문구는 전체 loss가 ko 1.40, en 0.84로 풀어 쓴 문구(ko 0.74, en 0.60)보다 높았다. 기준값은 S2 시험으로 정한다.

청취 파일(`out/s0/listen/`, git 제외): ko는 Alice(`Xb7hH8MSUJpSbSDYk0k2`)·Jessica(`cgSgspJ2msm6clMCkdW9`), en은 Alice·Liam(`TX3LPaxmHKxFdv7VOQHJ`)로 10문장씩, 태그 문장 3개 포함. 숫자 비교용 `*-digits-*`는 Alice로 만들었다. S0에서 쓴 크레딧은 1,735(TTS 1,580 + 정렬 155)이고 이번 주기 사용량은 2,152/10,000이다.

리뷰: Codex CLI 0.160.0, gpt-6-astra(추론 high), 읽기 전용으로 S0 diff를 리뷰했다. J1(경로의 편·언어와 내용 불일치 미검사), J2(`displayRange` 끝 초과 허용), J3(200ms 미만 구절 허용), J4(code point 기준 길이 제한) 네 건 모두 채택해 고쳤고 시험을 추가했다.

검증: `npm test` 113개 통과(Mac Node 23.9.0, 컨테이너 Node 22.22.0), `gen.mjs --check`, `env-check.mjs` 통과. invalid fixture 36개가 기대 오류 코드를 낸다. 시간 변환은 frame 0~2700 전 구간에서 마이크로초 내림 값이 `f/30`을 포함함을 확인했다. 단, 엔진이 `start + duration`을 double로 더하면 끝 frame이 포함되는 경우(예: 12→36, 0.4+0.8=1.2000000000000002)가 있어 S1 경계 스냅샷에서 실제 동작을 본다.

## 2026-10-07 S1 첫 한국어 1편 (Claude Opus 통합, Sonnet 단위 시험)

API 키 없이 수동 음성 경로로 한국어 1편을 끝까지 만들었다. 음성은 S0 청취용 Alice 합성(30.88초, 10문장)을 고정 입력으로 쓰고, 시각은 S0 Forced Alignment 응답을 글자 대응으로 구절 시각에 옮겨 `voice --audio-file --timings`로 들여왔다. 사람이 들으며 만든 시각이 아니므로 S2 정확도 기준 파일로 쓰지 않는다. 편 데이터는 `jobs/mm-calc/ko/`, 음성은 git 밖 `cache/manual/<sha256>.wav`다.

구현: `scripts/lib/phrasing.mjs`(발음 사전 치환, 구두점·공백 기준 구절 분할, 닫는 따옴표·괄호는 앞 구절에 붙임), `scripts/resolve.mjs`, `scripts/assemble.mjs`, `scripts/render.mjs`, `scripts/run.mjs`(voice 수동 경로, build, draft), `scripts/engine-check.mjs`, 템플릿 `_base`(root, captions)·`hook`·`keyword`·`steps`, Noto Sans KR·Inter 가변 woff2(무변형 변환, OFL), GSAP 3.14.2 vendor. Sonnet 서브에이전트가 phrasing·resolve·assemble·글자 대응 단위 시험을 썼고 지적한 두 결함(닫는 따옴표가 다음 구절로 가는 문제, 대응 오류 메시지 위치 -1)을 고쳤다.

엔진에서 확인한 것과 그에 따른 변경:

- sub-composition 안의 `<script type="application/json">`이 JS로 실행돼 런타임 오류가 났다. props는 `JSON.parse("<리터럴>")`로 넘긴다(설계 D3·§5.1 r7).
- 엔진은 clip을 `start ≤ t < start + duration`으로 보이는데 두 값을 double로 더한다. 끝을 1µs 당겼다(§5.4). 합성 프로젝트를 png-sequence로 렌더해 frame%3이 0·1·2인 경계, 1 frame clip, sub-composition 안 중첩 clip(자막 방식), 크로스페이드 단조 증가를 픽셀로 확인했고 모두 통과했다.
- `back.out` 이징 tween은 끝난 뒤 뒤로 seek하면 값이 달라졌다(같은 GSAP를 브라우저에서 직접 돌리면 정상이라 HyperFrames 런타임 쪽 동작으로 본다). 템플릿에서 넘쳤다 돌아오는 이징을 쓰지 않는다.
- 결정론: 장면·전환·자막 경계 90 frame을 순방향·역방향·무작위 순서로 스냅샷해 비교했다. 해시는 43 frame에서 다르지만 채널 차이 최대 1(자막 경계 근처 합성 차이)이라 채널 차이 2 이하를 같은 frame으로 판정한다.
- `snapshot`은 `GEMINI_API_KEY`가 있으면 Gemini 비전 분석을 기본 실행한다. 래퍼가 API 키 환경변수를 지우고 `--describe false`를 넘긴다. `check`·`snapshot`·`render`는 `--no-browser-gpu`로 돌린다.
- 3.9MB 한글 폰트가 로컬 렌더·스냅샷에 정상으로 쓰였다. `check`의 `content_overlap` 경고는 크로스페이드 구간의 이중 노출에서만 나와 기록만 한다.

S1 기준: 폰트 로드(lint 폰트 규칙 통과, 스냅샷 확인), 글자 잘림·넘침 0(check layout 오류 0), 순차·역순·무작위 seek 동일(위 기준), ffprobe 규격(1080×1920, 30/1, 942 frame, yuv420p, h264, 오디오 1개, max_volume > −50dB), 장면·자막 경계(합성 프로젝트 시험), 직렬화(`</script>`, 따옴표, `&`, U+2028이 든 props·자막으로 lint·check·draft 통과), 수동 음성 경로(키 없이 완성, 발화 문구·발음 사전·음성 파일을 바꾸면 build 거부)를 모두 확인했다. draft 렌더는 31.4초 영상에 약 28초 걸렸다.

리뷰: Codex(gpt-6-astra, high) S1 리뷰가 사용 한도로 20:55까지 중단됐다. 중단 전 진행 기록에 남은 지적 하나(구절을 손으로 지운 timings가 build를 통과)는 build에서 구절 목록 자체를 현재 분할과 해시로 대조하도록 고쳤다. 같은 기록의 "공백이 든 사전 치환에서 발화 글자 누락"은 재현 사례를 만들어 봤으나 재현하지 못했다. 한도가 풀리면 다시 리뷰한다.

미해결: 구절 분할이 앞에서부터 채워 "릴스 모두 같은 / 방식이에요."처럼 끝 구절이 짧아질 수 있다. S1 기준 밖이라 그대로 두었다.

## 2026-10-07 의상 교체 시험 영상 (Aoi)

사용자가 준 참고 영상(14초, 실사 인물 주변의 의상 스티커를 커서로 누르면 스티커가 흰 테두리 컷아웃으로 커지며 그 의상으로 바뀜, 약 2초 간격)을 분석해 Aoi 의상 이미지 9장으로 따라 만들었다. 기본 의상 1장과 스티커 8개(2열×4행), 16.2초, 클릭 효과음만 넣었다(사용자 선택, 원본 음악은 저작권 때문에 쓰지 않음). 인물 동작은 정지 이미지라 화면 전체의 느린 흔들림으로 대신했다.

배경 제거는 HyperFrames 0.8.139의 `remove-background`(CoreML, 장당 약 1.2초)로 했고 결과가 스티커로 쓸 만했다. 흰 테두리는 PIL로 알파를 넓혀 만들고, 커진 컷아웃이 다음 사진의 인물 위치와 정확히 겹치도록 cover 맞춤 좌표를 계산했다. 파이프라인 밖 일회성 시험이라 작업물은 git 밖 `out/outfit-test/`(build.mjs, stickers.py, project/, aoi-outfit-test.mp4)에 두었다. 출력은 1080×1920, 30/1, 486 frame, h264·aac. 이 형식을 채널 포맷으로 쓸지는 사용자 판단 뒤 장면 유형으로 옮긴다.
