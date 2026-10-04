# ShortsMaker 기획 v2: Claude 중심 코드 렌더 숏폼

기준일 2026-10-04 (Asia/Seoul). 같은 날 작성한 [종합 기획](2026-10-04-research-plan.md), [Muse VM 실행 설계](remote-execution.md), [운영 예산](operations-budget.md)을 대체하는 최신 기획이다. 기존 문서는 근거 기록으로 보존한다.

전제(사용자 확인): 학원과 무관한 개인 수익화 채널. 정보 전달·설명·광고·홍보·가상 AI 캐릭터 등 포맷은 다양하되 전부 지원할 필요는 없다. 한국어·영어·일본어·중국어 지원. 운영비 최소화. 개발 단계에는 Claude Pro, GPT Plus, Gemini Pro CLI를 함께 쓰고 운영은 Claude 중심. Muse AI VM은 선택 사항.

## 1. 권고안

Mac(M3 Pro)에서 Claude Code가 대본과 장면 데이터를 만들고, HyperFrames가 HTML 템플릿을 MP4로 렌더한다. 음성은 Gemini 3.8 Flash TTS 하나로 네 언어를 처리하고, 자막 타이밍은 로컬 whisper.cpp로 뽑아 원래 대본에 다시 맞춘다. 영상 생성 AI는 쓰지 않는다. 추가 현금 지출은 기존 구독을 빼면 월 $0~10 범위로 잡는다.

| 영역 | 선택 | 이유 |
|---|---|---|
| 렌더러 | HyperFrames (대안: Remotion) | Apache-2.0, 렌더 과금 없음. `capture`·`tts`·`transcribe`·`check`·`snapshot`이 CLI에 내장. GSAP·Three.js를 seek 가능한 어댑터로 지원 |
| 운영 AI | Claude Code (Pro 구독) | 대본·장면 JSON·스냅샷 검토까지 한 세션에서 처리. 매 편 다른 모델을 거치지 않음 |
| 음성 | Gemini 3.8 Flash TTS | ko/en/ja/zh 모두 지원, 무료 티어 있음, 유료여도 45초당 약 $0.01 |
| 음성 옵션 | ElevenLabs v4 | 광고·캐릭터처럼 연기가 필요한 편만. 상업 이용은 유료 플랜 필요 |
| 자막 정렬 | whisper.cpp large-v3 → 원 대본 재정렬 | 무료·로컬. 인식 오타가 자막에 들어가지 않음 |
| 실행 위치 | Mac 로컬 | 사양을 아는 장비. Muse VM은 CLI·cron은 공식 확인됐으나 렌더 성능·영속 경로·외부 호출 승인이 미확인이라 후순위 |
| 이미지·캐릭터 | ChatGPT Plus / Gemini 앱에서 수동 생성 | 구독 안에서 해결. 자동화할 때만 API(장당 약 $0.045~0.067) |
| 게시 | 수동 | 수익화 정책 리스크를 사람이 마지막에 확인 |

기존 ADR은 Remotion을 1순위로 두었다. 개인 채널이면 Remotion도 무료라 비용 차이는 없다. HyperFrames를 기본으로 바꾼 근거는 두 가지다. 사례 1의 '페이지 캡처 → 음성 → 컷 → 자막' 흐름이 CLI 명령으로 이미 존재하고, 2026년 9월 이후 X에서 공유되는 Claude 코드 렌더 사례가 HyperFrames 스킬 쪽으로 몰려 있어 참고 자료를 구하기 쉽다. 첫 1편에서 한국어 자막 처리나 렌더 안정성이 기준에 못 미치면 Remotion으로 돌아간다.

## 2. 최신 동향 조사

### 접근 한계

x.com은 robots 정책으로, Reddit은 차단 정책으로 원문을 열지 못했다. 아래 X 내용은 검색 결과에 노출된 게시글 제목·요약과 그 게시글을 다룬 2차 자료에 근거한다. Reddit 게시물은 확보하지 못했다. 사례 두 건도 사용자가 붙여 준 설명을 기준으로 삼았다. 꼭 확인할 게시물이 있으면 본문을 붙여 주면 반영한다.

### 흐름

2026년 1월 Remotion이 Agent Skills를 공개하면서 "Claude Code로 프롬프트만으로 영상" 사례가 퍼졌다(@Remotion, @rileybrown). 4월 HeyGen이 HyperFrames를 오픈소스로 내놓았고, 데모 영상 자체를 Claude Code + HyperFrames로 만든 게시글이 이어졌다(@jerrod_lew, @liu8in). 4월 말부터는 Claude Design에서 브랜드 디자인 시스템을 잡은 뒤 HyperFrames로 MP4를 뽑는 조합이 등장했다(@ai_artworkgen, @HyperFrames_). 9월에는 Opus 5.5 출시 이후 "코드로 그리고 움직이는" 사례 모음과 강좌형 글이 집중적으로 올라왔다(@EricBuess, @0xMovez, @liu8in "step-function upgrade"). HyperFrames 저장소는 조회 시점에 별 5.6만 개, 커밋 5천 건 이상이었다.

### 실무 기법

| 기법 | 내용 | 출처 | 채택 |
|---|---|---|---|
| 나레이션 먼저 확정 | 음성 길이를 정한 뒤 컷을 그 길이에 맞춘다 | Promptwhat(사용자 제공), jangGiraffe | 필수 |
| 화면 문구와 발음 문구 분리 | `pronounce.txt` 사전으로 "M/M" 표시 → "맨 먼스" 발음 | jangGiraffe/claude-video-pipeline | 필수 |
| 전사 결과를 원 대본에 재정렬 | whisper 단어 시각만 쓰고 글자는 원 대본에서 가져옴 | jangGiraffe | 필수 |
| 장면 유형 라이브러리 + scenes.json | hook·keyword·steps·terminal·bullets·title 6종을 AI가 단어 타이밍에 배치 | jangGiraffe | 필수 |
| 무료 TTS 우선, 실패 시 유료 | Gemini Flash TTS 무료로 시도, 검증 실패 문단만 유료 모델 | jangGiraffe | 채택 |
| 음높이 일관성 검사 | 문단별 합성 후 F0 중앙값에서 12% 이상 벗어나면 재합성 | jangGiraffe | 채택 |
| 프레임 스냅샷 자기 검토 | 렌더한 대표 프레임을 Claude가 보고 레이아웃을 고친다 | apiyi 가이드, HyperFrames `snapshot`·`check` | 채택 |
| 저해상도 초안 → 최종 | 초안으로 타이밍 확인 후 1080×1920 최종 렌더 | apiyi 가이드 | 채택 |
| 모션 규칙 시스템 프롬프트 | 전경 요소가 전환 주체, 속도 변화, 30초당 정지 1초 이하, 대비 4.5:1 | @everestchris6 (YouMind) | 템플릿 개발 시 참고 |
| 디자인은 상위 모델, 반복은 하위 모델 | 템플릿 설계는 Opus, 매일 채우기는 저가 모델 | apiyi 가이드 | 채택 |
| 웹사이트 → 영상 | 페이지를 캡처해 에이전트가 편집 가능한 폴더로 | HyperFrames `capture`, website-to-hyperframes 스킬 | 광고·홍보 포맷 |

## 3. 두 사례의 재현 방법

**사례 1 (브랜드 페이지 캡처 → 11컷 → 나레이션 → 자막).** `hyperframes capture`로 페이지를 가져오고, 계산기처럼 값을 넣어야 하는 화면은 Playwright 스크립트로 입력·클릭·캡처 순서를 고정한다. 대본과 음성을 먼저 확정하고 컷을 음성 구간에 배치한다. 원 게시자는 ElevenLabs v4를 썼다. v4는 현재 Text to Dialogue API로만 제공되고, 무료 플랜은 상업 이용이 포함되지 않는다. 수익화 채널은 상업 이용에 해당하므로 v4를 쓰려면 Starter 이상 유료 플랜이 필요하다. 기본은 Gemini TTS로 두고 광고 편만 v4를 시험한다.

**사례 2 (일러스트 → 미니어처 세계 애니메이션).** 일러스트는 Gemini 앱이나 ChatGPT에서 만든다. 한 장을 배경·중경·전경 2~4개 레이어로 나누고(HyperFrames `remove-background` 활용) 카메라 이동과 시차를 주면 2.5D가 된다. 실제 깊이와 조명이 필요하면 Three.js 장면을 쓴다. HyperFrames는 `window.__hfThreeTime`과 `hf-seek` 이벤트로 Three.js를 프레임 단위로 seek하며, 벽시계 시간·렌더 중 네트워크 호출·시드 없는 난수를 금지한다. 원 게시자가 쓴 미니어처 공개 사이트와 프롬프트는 원문을 열지 못해 확인하지 못했다.

## 4. 포맷 범위

모든 포맷을 처음부터 만들지 않는다. 템플릿 하나를 완성할 때마다 다음 포맷을 연다.

| 단계 | 포맷 | 재료 | 비고 |
|---|---|---|---|
| P0 | 정보·설명 | 대본, 도표, 아이콘(SVG 코드 생성), 키워드 카드 | 첫 파이프라인 검증용 |
| P1 | 광고·홍보 | 제품 페이지 캡처, UI 확대·강조, CTA | 사례 1 방식 |
| P2 | 일러스트 무드·미니어처 | 생성 일러스트 레이어, 2.5D 카메라 | 사례 2 방식 |
| P2 | 가상 캐릭터 진행자 | 캐릭터 시트, 눈 깜빡임·입 모양 스프라이트 | 아래 설명 |
| 제외 | 실사 립싱크 아바타 | 생성형 영상 또는 GPU 립싱크 모델 | 비용·품질·공개 표시 부담 |

가상 캐릭터는 코드 렌더 범위 안에서 만든다. 캐릭터 시트(정면, 표정 3~4종, 입 모양 3~5종)를 한 번 생성해 고정하고, 음성의 단어 타이밍과 음량으로 입 스프라이트를 바꾸고 눈 깜빡임·호흡·흔들림을 GSAP로 준다. 같은 시트를 계속 쓰므로 편마다 얼굴이 달라지는 문제가 없다. YouTube는 사실적으로 보이는 합성 인물·장면에 AI 공개 표시를 요구하고, 애니메이션·만화 스타일은 요구하지 않는다. 실사풍 미녀 캐릭터를 택하면 공개 표시를 켜고 게시한다.

## 5. 다국어

언어마다 별도 작업이다. 영어 대본을 번역해 같은 타임라인에 끼우지 않고, 언어별로 대본 현지화 → 음성 → 정렬 → 장면 재배치를 다시 한다. 하루 편수는 언어별 최종 파일을 합산한다. 운영 부담을 고려해 한국어·영어로 시작하고 템플릿이 안정되면 일본어·중국어를 더한다.

| 항목 | 한국어 | 영어 | 일본어 | 중국어(간체) |
|---|---|---|---|---|
| TTS | Gemini 3.8 | Gemini 3.8 (초안은 Kokoro 가능) | Gemini 3.8 (Kokoro 가능) | Gemini 3.8 (Kokoro 가능) |
| 전사 | whisper large-v3 `--language ko` | Parakeet 또는 whisper | whisper large-v3 | whisper large-v3 |
| 줄바꿈 | CSS `word-break: keep-all` | 기본 | BudouX | BudouX |
| 자막 묶음 | 어절 단위 | 단어 단위 | BudouX 구절 단위 | BudouX 구절 단위 |
| 폰트 | Noto Sans KR | Inter 등 | Noto Sans JP | Noto Sans SC |

HyperFrames 내장 `tts`는 Kokoro-82M이라 한국어 음성이 없다. Parakeet 전사도 지원 언어 25개에 한·중·일이 없으므로 CJK는 whisper.cpp large-v3를 명시하고 `--preserve-cues`로 글자 단위 자막이 쪼개지지 않게 한다. 번체·광둥어는 요청이 생기면 별도 범위로 정한다.

## 6. 제작 흐름과 AI 역할

`주제·근거 → 대본(화면 문구/발음 문구) → TTS → 전사·재정렬(timings.json) → scenes.json → HTML 조립 → lint/check/snapshot → Claude 스냅샷 검토 → 초안 렌더 → 사람 확인 → 최종 렌더 → 수동 게시`

매일 실행하는 단계에서 AI는 데이터만 만든다. 템플릿 HTML·CSS·애니메이션 코드는 개발 단계에서 검증한 것을 고정해 두고, Claude는 장면 유형과 속성값을 담은 `scenes.json`만 출력한다. 그래야 토큰 사용이 일정하고 렌더 실패가 줄어든다.

| 단계 | 개발 단계 | 운영 단계 |
|---|---|---|
| 템플릿 설계·구현 | Claude Code + HyperFrames 스킬 (Opus) | 하지 않음 |
| 코드 리뷰·대체 구현 | Codex CLI (GPT Plus) | 하지 않음 |
| 자료 조사·사실 확인 | Gemini CLI (AI Pro, 하루 1,500 요청) | 필요한 편만 Claude 웹 검색 |
| 번역 검수 | Gemini 또는 GPT로 교차 확인 | Claude 단독, 필요 시 사람 |
| 대본·scenes.json | Claude | Claude (저가 모델 우선) |
| 렌더·자막·검사 | 일반 코드 | 일반 코드 |

운영은 Claude Code 안의 `/short` 스킬 하나로 묶는다. 예: `/short "주제" --lang ko,en --format explainer`. 스킬이 단계별 스크립트를 호출하고, 실패한 단계에서 멈춘 뒤 사람에게 묻는다.

헤드리스 실행(`claude -p`, Agent SDK)은 현재 구독 한도에서 차감된다. Anthropic은 2026-06-15부터 이를 별도 월 크레딧(Pro $20)으로 분리하려다 보류했고, 계획을 갱신 중이라고 밝혔다. 보류가 풀리면 헤드리스 비용 구조가 바뀌므로, 기본 운영은 사람이 Claude Code를 열고 스킬을 실행하는 대화형으로 둔다. 야간 무인 실행은 정책이 확정된 뒤 선택 기능으로 추가한다.

폴더 구조 초안:

```
templates/        # 검증된 장면 유형 HTML (hook, keyword, steps, compare, cta, character)
scripts/          # tts.py, align.py, scenes 검증, render 래퍼
jobs/<id>/<lang>/ # script.md, pronounce.txt, narration.wav, timings.json, scenes.json
out/<id>/<lang>/  # draft.mp4, final.mp4, captions.srt, snapshots/, manifest.json
```

기존 `video-spec.schema.json`의 프레임·ms 변환 규칙, 해시 기록, `additionalProperties=false` 원칙은 `scenes.json` 검증에 그대로 가져온다. 언어 필드는 `ko-KR` 고정에서 네 언어 목록으로 바꾼다.

## 7. 비용

| 항목 | 월 비용 | 계산 |
|---|---|---|
| Claude Pro / GPT Plus / Gemini Pro | 기존 구독 | 이 프로젝트용 추가 결제 없음 |
| 렌더러 | $0 | HyperFrames Apache-2.0, Remotion도 개인 무료 |
| Gemini 3.8 Flash TTS | $0~3.6 (2027년부터 $0~7.3) | 오디오 25토큰/초, 45초=1,125토큰, 출력 $9/100만 토큰 → 편당 약 $0.010. 월 90편×4언어=360개 기준. 무료 티어로 처리되면 $0 |
| 이미지 | $0 (자동화 시 장당 $0.045~0.067) | 구독 앱 수동 생성 기본. Nano Banana 2 API는 무료 티어 없음 |
| ElevenLabs | $0 또는 Starter | 광고·캐릭터 편에 쓸 때만 |
| 음악 | $0 | YouTube 오디오 라이브러리 등 권리 확인된 음원 |
| 렌더 전기 | 소액 | Mac 로컬 |

Gemini 무료 티어의 정확한 일일 한도는 문서에 숫자로 나와 있지 않아 AI Studio 대시보드에서 확인해야 한다. 무료 티어 입력은 제품 개선에 쓰일 수 있으나 공개할 대본이라 문제가 적다. 2026-12-31까지는 도입 가격이고 2027-01-01부터 두 배다.

## 8. 수익화 정책 리스크

YouTube는 "반복적이거나 대량 생산된" 콘텐츠를 수익화하지 않는다. 금지 예시로 "최소한의 서사만 있는 이미지 슬라이드쇼·템플릿 스토리라인·스크롤 텍스트", "대량 생산 인상을 주는 일반적 템플릿의 AI 생성 콘텐츠", "여러 영상에 걸쳐 거의 같은 스토리라인 템플릿"을 든다. 같은 인트로·아웃트로를 쓰더라도 본문이 매번 다르면 허용된다.

코드 템플릿 방식은 이 정책과 가장 쉽게 충돌한다. 그래서 장면 유형은 재사용하되 편마다 구성 순서·시각 자료·해설 관점이 달라야 하고, 자동 생성 편수를 늘리기 전에 채널 단위로 포맷을 섞는다. 초기 목표는 언어당 하루 1편 이하로 둔다. 실사풍 합성 인물·장면은 공개 표시를 켠다.

## 9. 기존 기획과 달라진 점

| 항목 | 기존 (planning/ 3개 문서) | v2 |
|---|---|---|
| 채널 성격 | 정보형 중심 | 개인 수익화, 포맷 단계적 확장 |
| 언어 | 영어 기본, 요청 시 다국어 | ko/en 시작, ja/zh 추가 |
| 렌더러 | Remotion 조건부 1순위 | HyperFrames 기본, Remotion 대안 |
| TTS | Google Neural2 / Kokoro 비교 | Gemini 3.8 Flash TTS 단일화, ElevenLabs 옵션 |
| 실행 위치 | Muse VM 우선 | Mac 우선, VM 선택 |
| 실행 방식 | 야간 무인 큐 | 대화형 스킬 실행 우선, 무인은 후속 |
| 모델 역할 | Claude 작성 + GPT 검토 | 개발은 3개 CLI 분담, 운영은 Claude 단독 |

## 10. 실행 단계

| 단계 | 기간 추정 | 할 일 | 완료 기준 |
|---|---|---|---|
| S0 준비 | 반나절 | Mac에 Node 22+·FFmpeg 확인, `npx hyperframes doctor`, 텔레메트리 끄기, Claude Code에 HyperFrames 스킬 설치, Gemini API 키 발급 | doctor 통과, 4개 언어 TTS 각 10문장 청취 |
| S1 첫 1편 | 1~2일 | 한국어 45초 설명형, 장면 유형 3종, TTS → 정렬 → scenes.json → 렌더 | 자막 동기 150ms 이내, 글자 잘림 0, 대본 수정 후 재렌더에 TTS 재호출 0 |
| S2 템플릿·스킬 | 2~3일 | 장면 유형 5~6종, 영어 버전, `/short` 스킬 | 주제만 바꿔 3편 완성, 편당 사람 작업 20분 이하 |
| S3 확장 | 1~2주 운영 | ja/zh, 캡처 기반 광고 템플릿, 캐릭터 진행자 템플릿 | 언어별 2편 이상 게시, 포맷별 검수 시간 기록 |
| S4 선택 | 필요 시 | 야간 무인 실행, Muse VM, 업로드 API | 헤드리스 과금 정책 확인 후 결정. Muse는 §11의 5개 항목을 측정해 Mac launchd 야간 실행과 비교한 뒤 결정 |

S1에서 HyperFrames가 한국어 줄바꿈·폰트·자막 그룹핑을 처리하지 못하면 같은 입력으로 Remotion을 하루 시험하고 결정한다.

## 11. 미확인 사항

- X·Reddit 원문, 두 사례의 실제 프롬프트·제작 시간
- HyperFrames의 한국어 자막·폰트 처리 품질, Mac 렌더 시간
- Gemini 3.8 TTS의 무료 티어 일일 한도, 언어별 음질
- Muse AI VM: 코드 컴파일·스킬·cron 실행은 Meta 공식 문서로 확인. 영속 경로(`/home/hatch` 100GB)와 루트 파일시스템 교체는 비공식 분석 기준이며 원문 미확인. 확인할 것: 실제 CPU·메모리(커뮤니티 보고 2 vCPU/8GB), Chrome 의존 라이브러리 유무, 45초 1편 렌더·전사 시간, Gemini API 호출 시 Sentinel 승인 요청 여부, VM 교체 후 복구 절차. VM에서 `claude -p`를 돌려도 구독 한도에서 차감되므로 비용 이점은 없고, 얻는 것은 Mac을 켜 두지 않아도 된다는 점이다
- Anthropic 헤드리스 과금 변경의 재개 여부와 시점
- ElevenLabs Starter의 프로모션 이후 정상 가격 (가격 페이지 표기가 10월 18일까지 프로모션 상태)

## 출처

렌더러·기법
- [HyperFrames 저장소](https://github.com/heygen-com/hyperframes), [CLI 레퍼런스](https://hyperframes.mintlify.app/packages/cli), [3D 런타임](https://hyperframes.heygen.com/prompting/runtimes-and-3d.md), [음성·오디오 가이드](https://hyperframes.heygen.com/guides/voice-and-audio.md)
- [Remotion Agent Skills](https://www.remotion.dev/docs/ai/skills), [Remotion 라이선스](https://www.remotion.pro/license), [Remotion 자막 스킬](https://github.com/remotion-dev/skills/blob/main/skills/remotion-best-practices/remotion-captions/transcribe-captions.md)
- [jangGiraffe/claude-video-pipeline](https://github.com/jangGiraffe/claude-video-pipeline)
- [apiyi: Opus 5.5 코드 영상 4단계 (2026-09-26)](https://help.apiyi.com/ko/claude-opus-5-5-code-to-video-guide-ko.html)
- [YouMind 모션 시스템 프롬프트 (@everestchris6, 2026-09-29)](https://youmind.com/ko-KR/video-prompts/gsap-threejs-motion-video-prompt-11703)
- [BudouX](https://github.com/google/budoux)

X 게시글 (검색 결과 제목·요약만 확인)
- [@Remotion Agent Skills 발표](https://x.com/Remotion/status/2013626968386765291), [@rileybrown](https://x.com/rileybrown/status/2013868186807242855)
- [@jerrod_lew HyperFrames 공개](https://x.com/jerrod_lew/status/2044834195713794245), [@liu8in Motion Design](https://x.com/liu8in/status/2045391185519448574), [@liu8in Opus 5.5 + HyperFrames](https://x.com/liu8in/status/2104360119849083093)
- [@ai_artworkgen Claude Design × HyperFrames](https://x.com/ai_artworkgen/status/2048471354773549393), [@HyperFrames_ 소스 공개](https://x.com/HyperFrames_/status/2085837731578687970)
- [@EricBuess Opus 5.5 코드 영상 사례 모음](https://x.com/EricBuess/status/2103226548413182366), [@0xMovez 강좌](https://x.com/0xMovez/article/2104216919033192746)
- 사용자 제공 사례: [@Promptwhat](https://x.com/Promptwhat/status/2106364893679018098), [@akakuma0219](https://x.com/akakuma0219/status/2105990418886480092)

음성·자막
- [Gemini API 가격](https://ai.google.dev/gemini-api/docs/pricing), [Gemini 음성 생성](https://ai.google.dev/gemini-api/docs/speech-generation), [오디오 25토큰/초](https://meetcody.ai/models/gemini-3-8-flash-tts/)
- [ElevenLabs 모델](https://elevenlabs.io/docs/overview/models), [ElevenLabs 가격](https://elevenlabs.io/pricing), [Forced Alignment](https://elevenlabs.io/docs/api-reference/forced-alignment/create)
- [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)

구독·실행
- [Claude Agent SDK와 구독 플랜](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- [Codex 가격·한도](https://chatgpt.com/codex/pricing/), [Gemini CLI 한도](https://geminicli.com/docs/resources/quota-and-pricing/)
- [Muse AI 개요 (2차 자료)](https://myclaw.ai/blog/muse-ai), [How We Built Safety Into Muse (Meta, 2026-09-08)](https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse)
- Muse VM 파일시스템 분석(Rohan Adwankar, Peter James)은 ChatGPT 조사 요약으로만 확인

플랫폼 정책
- [YouTube 수익화 정책(inauthentic content)](https://support.google.com/youtube/answer/1311392), [YouTube AI 공개 표시](https://support.google.com/youtube/answer/14328491)
