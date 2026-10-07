# ShortsMaker S0~S3 구현 설계

기준일 2026-10-04 (Asia/Seoul). [기획 v2](2026-10-04-claude-code-render-plan-v2.md)(r2) §6·§10과 [모션 문서](2026-10-04-motion-catalog-and-preset-tool.md) §3을 코드로 옮기기 위한 설계다. 방향과 범위는 두 문서를 따르고, 이 문서는 파일 구조, 데이터 계약의 필드, 스크립트 입출력, 캐시·재개·승인 규칙, 검사 방법, 단계별 완료 기준을 정한다. 코드와 스키마 파일은 아직 없다.

상태: r4 (2026-10-05). r2는 [GPT 리뷰](2026-10-04-implementation-design-review.md) 1차의 G1~G10과 축소 제안을 반영했다. r3는 사용자 결정에 따라 TTS를 Gemini 3.8 Flash TTS에서 ElevenLabs Eleven v4로 바꾸고, 그에 맞춰 자막 정렬을 ElevenLabs Forced Alignment로 바꿨다(§6, §7, D6, D8). r4는 [2차 GPT 리뷰](2026-10-04-implementation-design-review.md#2차-리뷰-r3)의 H1~H7과 축소 제안을 반영했다. r5는 사용자 지시에 따라 ElevenLabs를 Free 플랜으로 시험하는 단계를 넣었다(D8, §4.7, §6.2, §6.4, §8). 항목별 판단은 §13에 있다. r6(2026-10-07)은 S0 첫 호출 결과로 엔드포인트(§6.1), 정렬 글자 대응 규칙(§7.2 3번), 미확인 사항(§12)을 확정했다. 근거는 worklog 2026-10-07 항목이다. r7(같은 날)은 S1 구현에서 확인한 엔진 동작으로 D3의 전달 방식(§5.1), 끝 시각 보정(§5.4), 폰트·GSAP(§5.2), 결정론 검사 방법과 이징 제한(§9)을 고쳤다. §2의 D1~D9는 2026-10-05 사용자가 모두 승인했고, D8은 같은 날 사용자 지시로 고쳤다.

## 1. 다시 확인한 외부 조건

설계에 영향을 주는 도구 사양을 2026-10-04 공식 문서로 다시 확인했다. 출처는 문서 끝에 있다.

| 항목 | 확인 내용 | 설계 영향 |
|---|---|---|
| HyperFrames 버전 | npm `hyperframes` 0.8.123 (2026-10-04 배포). Node 22 이상, FFmpeg 7.x, Chrome 자동 설치. 거의 매일 배포된다 | 정확한 버전을 `package.json`에 고정하고 run마다 기록 |
| 시간 단위 | `data-start`·`data-duration`은 초. 엔진은 `floor(frame)/fps`로 seek하고 GSAP를 재생하지 않는다 | frame→초 변환은 조립기 한 곳에서만 (§5.4) |
| 하위 composition | `data-composition-src`로 마운트. 자식 파일은 `<template>` 안의 마크업·스타일·스크립트만 쓰고 `<head>`는 버린다. 호스트 id, 내부 id, 타임라인 키가 같아야 한다 | 장면 인스턴스마다 고유 id의 파일을 만든다 |
| 변수 | 선언은 `data-composition-variables`(배열), 인스턴스 값은 `data-variable-values`(JSON 객체). 타입은 string·number·color·boolean·enum·font·image | 목록 항목과 구절 시각을 담을 수 없다. 장면 데이터는 자체 JSON 블록으로 넘긴다 (D3) |
| 오디오 | `<audio id src data-start data-volume>`. id가 없으면 믹서가 무시해 무음으로 렌더된다 | 조립기가 id를 항상 붙이고 출력 검사에 무음 검사를 넣는다 |
| CLI | `doctor --json`(종료 코드는 항상 0, `.ok` 필드로 판정), `lint --json`, `check --json --snapshots --at-transitions`, `snapshot --at/--frames`, `render -q draft\|standard\|high -f 30 -o`. 품질 기본값은 문서마다 다르게 적혀 있다. codec·프레임 범위 플래그는 찾지 못했다 | 품질은 항상 명시한다. codec은 ffprobe로 사후 검사 |
| `add` | 블록은 `compositions/`, 컴포넌트는 `compositions/components/`에 쓴다. 버전 고정 플래그는 없다 | 모션 문서 방침대로 vendor 커밋과 해시로 고정 |
| 텔레메트리 | `HYPERFRAMES_NO_TELEMETRY=1`, `HYPERFRAMES_NO_UPDATE_CHECK=1` | 래퍼가 모든 호출에 지정 |
| 에이전트 스킬 | `npx skills add heygen-com/hyperframes` 또는 Claude Code 플러그인 `hyperframes@hyperframes` | 전역 플러그인으로 설치하고 버전은 저장소의 `config/tools.lock.json`으로 관리한다(§11 S0, 2026-10-05 사용자 결정) |
| ElevenLabs v4 | 모델 ID `eleven_v4`(고품질), `eleven_v4_turbo`(실시간용). 요청당 최대 10,000자. ko·en·ja·zh 포함 90개 이상 언어. 모델 목록 문서는 Text to Dialogue API 전용이라 하고, 도움말·모범 사례 문서는 일반 TTS(`POST /v1/text-to-speech/{voice_id}`)에서도 쓸 수 있다고 해 서로 엇갈린다. SSML·style·speed 설정은 없고 stability·similarity만 쓴다. 연기 지시는 대괄호 audio tag | 엔드포인트는 S0 첫 호출로 정한다(§6) |
| 재현성 | `seed`(0~4294967295)는 "best effort, 결정론 보장 없음" | 같은 입력도 다시 부르면 다른 음성이 나올 수 있다. 캐시가 유일한 재현 수단이다 |
| 출력 형식 | `wav_24000`·`pcm_24000`·`mp3_44100_128` 등. 44.1kHz PCM·WAV는 Pro 이상, 192kbps MP3는 Creator 이상 | `wav_24000` 사용 |
| 요금·권리 | Free 10k 크레딧(상업 이용 불가, 무료 플랜으로 만든 음성은 업그레이드 후에도 상업 이용 불가), Starter $6·30k, Creator $22·121k, Pro $99·600k. 크레딧이 끝나면 자동 초과 과금 없이 멈추고, 미리 충전한 Pay As You Go 잔액이 있으면 그 잔액에서 빠진다. v4의 글자당 크레딧 비율은 문서에서 찾지 못했다 | 개발·시험은 Free 플랜으로 하고, Free 음성으로 만든 출력은 게시용으로 표시하지 않는다(§6.4) |
| 타임스탬프·정렬 | `/with-timestamps` 엔드포인트가 입력 글자별 시작·끝 시각을 준다(v4 지원 여부 미확인). Forced Alignment API(`POST /v1/forced-alignment`)는 음성과 텍스트를 받아 글자·단어별 시각과 단어별 `loss`를 준다. ko·ja·zh 지원, 요금은 STT와 같은 시간당 $0.22 | 정렬은 Forced Alignment 하나로 한다(D6, §7) |
| 오류 | 크레딧 부족 402 `insufficient_credits`, 429 `rate_limit_exceeded`·`concurrent_limit_exceeded`·`system_busy`, 검증 오류 422. Starter 동시 요청 3개(v2 모델 기준표) | §6.3 |
| 줄바꿈 | BudouX 0.9.3은 ja·zh만 지원. Chrome `word-break: auto-phrase`는 일본어만 | ko는 `keep-all`. ja/zh 처리는 S4 |

Mac에서 관측한 환경은 macOS 26.6.2, Node 23.9.0, FFmpeg 8.0.1, Python 3.14.6, Codex CLI 0.160.0(2026-10-05 사용자 업데이트), 여유 디스크 33GiB다. HyperFrames 문서가 FFmpeg 7.x를 요구하므로 8.0.1에서 `doctor`와 렌더가 통과하는지 S0 첫 작업으로 본다. Node 23은 `engines >=22` 조건은 맞지만 권장 버전 22.x와 달라 같은 시점에 확인한다.

## 2. 설계 결정 (2026-10-05 승인)

| ID | 결정 | 이유 | 대안 |
|---|---|---|---|
| D1 | 파이프라인 코드는 Node.js 하나로 쓴다. 빌드 단계 없는 ESM JavaScript, 테스트는 `node:test`. 추가 의존성은 `ajv`, `hyperframes`(정확한 버전), `gsap`(§5.2 확인 후)만 둔다. ElevenLabs는 SDK 없이 `fetch`로 REST를 부른다 | 렌더 도구가 Node이고 조립기가 HTML·JS를 다룬다. 런타임을 둘로 나누면 설치·버전 기록이 두 벌이 된다. v1 README도 제품 구현의 검증기로 Ajv2020을 지목했다 | Python. v1 Python 검증기는 어느 경우든 그대로 둔다 |
| D2 | `scenes.json`에서 시각은 구절 ID로만 지정한다(`startPhrase`, `atPhrase`). 구절 ID에는 그 구절 화면 문구의 해시 8자가 들어 있어 문구가 바뀌면 ID도 바뀐다(§4.4). 프레임 값은 resolver가 `timings.json`에서 계산해 파생 파일 `timeline.json`에 쓴다 | Claude가 숫자를 계산하지 않으므로 타이밍 실수가 계약 단계에서 사라진다. 음성을 다시 만들어도 문구가 같으면 장면 데이터를 그대로 쓰고, 문구가 바뀐 구절을 참조한 장면은 검증에서 걸린다 | v2 §6 문구대로 scenes.json에 프레임을 직접 적기. 편집 계약이 scenes.json 하나라는 원칙은 D2에서도 유지된다 |
| D3 | 장면 데이터는 템플릿 스크립트 안의 `JSON.parse("<JSON 문자열 리터럴>")`로 넘긴다(r7: HyperFrames가 sub-composition의 `<script>`를 type과 무관하게 JS로 다시 실행해 `application/json` 블록이 런타임 오류를 냈다). 조립기가 하는 일은 id 토큰 치환과 이 리터럴 삽입뿐이다 | HyperFrames 변수는 스칼라만 받아 목록과 구절 시각을 넘길 수 없다 | 항목 수만큼 변수를 펼치기(`item1`~`item5`) |
| D4 | 자막은 조립기가 `timings.json`에서 만드는 별도 composition 하나로 둔다. 카탈로그 자막 컴포넌트는 S1에서 쓰지 않는다 | 카탈로그 자막은 가로 화면·고정 단어 목록 데모라 9:16과 우리 구절 데이터에 맞추려면 어차피 다시 써야 한다 | 카탈로그 자막을 vendor로 가져와 개조 |
| D5 | 발음 사전은 v2의 `pronounce.txt` 대신 `pronounce.json`으로 둔다. 언어별 공용 사전과 편별 사전을 합쳐 쓰고 편별 항목이 이긴다 | 치환 구간을 화면 문구와 발화 문구 사이에서 기계로 추적해야 자막 시각을 되돌려 줄 수 있다 | 탭 구분 텍스트 |
| D6 | 자동 정렬은 ElevenLabs Forced Alignment API 하나로 한다. TTS 음성과 직접 넣은 음성에 같은 경로를 쓰고, 자동 정렬을 쓸 수 없을 때는 사람이 만든 `timings.json`을 들여와 끝낸다(§6.5). whisper.cpp·LCS 재정렬은 S0~S3에서 만들지 않는다 | 발화 문구를 그대로 받아 그 글자에 시각을 붙이므로 전사문을 대본에 다시 맞추는 단계가 사라진다. 단어별 `loss`가 불일치 신호가 된다. 다만 loss는 주어진 텍스트를 맞춘 점수일 뿐 독립 전사 검증이 아니어서 잡지 못하는 유형이 있다(§7.3). 45초 한 편 약 $0.003이고 로컬 모델 2.9GiB가 필요 없다 | `/with-timestamps`(v4 지원 미확인, 누락 신호 없음). r2의 whisper.cpp 로컬 정렬(무료, LCS 필요, [r2 §7](archive/implementation-design-r2.md)). Forced Alignment가 S2 기준에 못 미치면 자동 정렬 대안을 그때 다시 정한다 |
| D7 | F0 음높이 검사는 S2에서 뺀다. 청취 검수로 대신한다 | 음높이 추출에 새 의존성이 필요하다. v2 §10도 F0 자동 판정을 필요가 확인될 때로 미뤘다 | Python 분석 도구 추가 |
| D8 | 개발·시험 단계는 ElevenLabs Free 플랜(월 1만 크레딧)으로 진행하고, 게시용 음성은 유료 플랜으로 바꾼 뒤 만든다. Free 플랜으로 만든 음성은 상업 이용이 안 되므로 그 음성이 들어간 출력은 게시 불가로 표시한다(§6.4). 어느 플랜이든 그 플랜의 월 크레딧 안에서만 만든다. Pay As You Go 잔액은 충전하지 않는 것을 운영 전제로 두고, 크레딧이 끝나면 멈춘다. 호출 전 원장의 이번 결제 주기 크레딧 합계로 월 상한을 검사한다(§6.4). 다른 TTS로 자동 전환하는 기능은 만들지 않는다 | 플랜 크레딧이 곧 월 지출 상한이라 별도 결제 로직이 필요 없다. 원장 검사는 재시도·재생성이 계획한 편수의 크레딧을 먹어 버리는 일을 막는다 | PAYG 잔액을 두고 금액 상한 집행, 또는 크레딧 소진 시 다른 TTS로 전환 |
| D9 | run 디렉터리는 입력 사본과 조립 결과를 가진 불변 단위다. run 도중 입력이 바뀌면 그 run을 이어 쓰지 않고 새 run을 만든다. `resume`은 중단된 단계를 이어 갈 때만 쓰고, 완성된 출력은 다시 만들지 않는다 | 출력 덮어쓰기 금지와 승인 무효화를 한 규칙으로 처리한다. 음성·정렬은 캐시에서 가져오므로 새 run의 비용이 거의 없다 | run 안에서 단계별 무효화·재실행 |

## 3. 저장소 구조

v2 §6 초안에 실제 파일을 채운 형태다. 디렉터리는 해당 단계가 시작될 때 만든다.

```
package.json                  # "type":"module", engines node>=22, 의존성 정확한 버전
package-lock.json
.env                          # ELEVENLABS_API_KEY (git 제외, Claude 읽기 금지 설정 유지)
config/
  pipeline.json               # 테마 기본값, 기본 voice, TTS 엔드포인트, 월 크레딧 상한·결제 주기·크레딧 비율
  tools.lock.json             # 전역 HyperFrames 플러그인의 버전·커밋과 고정한 CLI 버전 (아래 S0)
  pronounce/<lang>.json       # 언어별 공용 발음 사전
schemas/v1/                   # 보존
schemas/v2/
  languages.json              # 언어 별칭·저장값·폰트·줄바꿈·TTS 언어 코드·활성 여부 (유일한 매핑)
  script.schema.json
  pronounce.schema.json
  timings.schema.json
  scenes.schema.json          # 장면 유형별 props 부분은 templates/에서 생성
  manifest.schema.json
  fixtures/{valid,invalid}/
templates/
  _base/                      # root.html, captions.html, 공통 CSS, @font-face, vendor/gsap
  fonts/                      # Noto Sans KR·Inter woff2 + 라이선스 파일
  hook/ keyword/ steps/       # 유형마다 scene.html, props.schema.json, preview.json
  SCENES.md                   # props.schema.json에서 생성. /short가 읽는 장면 문서
motion/                       # S3(M0)부터. 모션 문서 §3
scripts/
  lib/                        # 두 스크립트 이상이 실제로 쓰는 함수만 (예: canon·hash, frames)
  validate.mjs                # 스키마 + 의미 검사
  tts.mjs                     # ElevenLabs adapter, 캐시, 원장
  align.mjs                   # 구절 분할, Forced Alignment 호출, 구절 시각·검사
  resolve.mjs                 # scenes.json + timings.json → timeline.json
  assemble.mjs                # timeline.json + templates → HyperFrames 프로젝트
  render.mjs                  # lint·check·snapshot·render·ffprobe 래퍼
  run.mjs                     # 명령 진입점, state.json, 재개, 승인
  env-check.mjs               # 도구 버전과 tools.lock.json 대조
  gen.mjs                     # SCENES.md와 scenes.schema.json 생성 부분
test/                         # node:test 단위 테스트, fixture
jobs/<id>/<lang>/             # script.json, pronounce.json, timings.json, scenes.json, voice.json
cache/tts/  cache/align/      # 내용 주소 캐시 (git 제외)
out/<id>/<lang>/<run-id>/     # run 결과 (git 제외)
.claude/skills/short/         # S3
```

`jobs/`는 사람과 Claude가 쓰는 입력이라 커밋 대상이다. `timings.json`은 정렬기가 만들지만 사람이 시각을 고칠 수 있는 입력이라 `jobs/`에 둔다(§7.4). `cache/`·`out/`은 `.gitignore`에 이미 들어 있다.

## 4. 데이터 계약

모든 계약 파일에 적용하는 규칙이다. JSON Schema 2020-12와 `additionalProperties: false`를 쓰고, `schemaVersion`은 `"2.0.0"`과 정확히 같을 때만 받는다. v1 파일을 v2로 해석하지 않는다. 텍스트는 읽는 즉시 NFC로 정규화하고, 문자 위치는 코드 포인트 기준 반열린 구간 `[start, end)`로 적는다. 글자 수 제한은 `Intl.Segmenter`의 grapheme 수로 센다. 해시는 소문자 hex SHA-256이고, JSON을 해시할 때는 키를 재귀 정렬하고 공백 없이 직렬화한 UTF-8 바이트를 쓴다. 숫자는 유한값만 받고 JavaScript `JSON.stringify`의 표기(같은 double이면 항상 같은 최단 표기)를 그대로 쓴다. 소수는 TTS 설정값(`stability` 등)과 정렬 loss에만 나오고, 이 값들도 파일에서 읽은 그대로 해시하므로 표기가 바뀌지 않는다. 0으로 채운 해시는 최종 단계에서 거부한다. 편 ID는 `^[a-z0-9][a-z0-9-]{2,47}$`, 문장·장면 ID는 `^[a-z0-9][a-z0-9-]{0,31}$`이다.

### 4.1 languages.json

언어 별칭과 저장값을 잇는 유일한 파일이다. 다른 코드는 이 파일만 읽는다.

```json
{
  "schemaVersion": "2.0.0",
  "languages": {
    "ko": { "tag": "ko-KR", "enabled": true,  "font": "noto-sans-kr", "lineBreak": "keep-all",
            "captionUnit": "space", "maxCaptionGraphemes": 14, "ttsLanguageCode": "ko" },
    "en": { "tag": "en-US", "enabled": true,  "font": "inter", "lineBreak": "normal",
            "captionUnit": "space", "maxCaptionGraphemes": 32, "ttsLanguageCode": "en" },
    "ja": { "tag": "ja-JP", "enabled": false, "font": "noto-sans-jp", "lineBreak": "budoux",
            "captionUnit": "budoux", "maxCaptionGraphemes": 16, "ttsLanguageCode": "ja" },
    "zh": { "tag": "zh-CN", "enabled": false, "font": "noto-sans-sc", "lineBreak": "budoux",
            "captionUnit": "budoux", "maxCaptionGraphemes": 16, "ttsLanguageCode": "zh" }
  }
}
```

`enabled: false` 언어는 검증기가 거부한다. ja·zh는 S4에서 갤러리·정렬 검수를 통과한 뒤 켠다. `maxCaptionGraphemes`는 S1 화면에서 조정할 시작값이다.

### 4.2 script.json — Claude 작성

```json
{
  "schemaVersion": "2.0.0",
  "jobId": "mm-calc",
  "lang": "ko-KR",
  "title": "M/M 계산법",
  "voice": { "provider": "elevenlabs", "model": "eleven_v4", "voiceId": "<voice_id>",
             "settings": { "stability": 0.5, "similarity": 0.75 }, "seed": 7 },
  "sentences": [
    { "id": "s01", "display": "M/M 계산법, 아직도 헷갈리나요?", "tag": "curious, friendly" },
    { "id": "s02", "display": "단가는 1,200원입니다.", "spoken": "단가는 천이백 원입니다." }
  ],
  "sources": [ { "title": "근거 자료 제목", "url": "https://example.com" } ]
}
```

`display`는 화면과 자막에 쓰는 문구다. `spoken`을 생략하면 발음 사전을 적용한 결과가 발화 문구가 된다. `spoken`을 직접 쓴 문장은 화면 문구와 발화 문구의 글자 대응을 알 수 없으므로 문장 전체를 자막 구절 하나로 다루고, 그 길이가 `maxCaptionGraphemes`를 넘으면 검증에서 거부한다. 부분 치환은 사전으로 처리하라는 뜻이다. 같은 이유로 `display`가 `maxCaptionGraphemes`를 넘는 사전 항목, 공백 없이 그 길이를 넘는 어절도 거부한다(§7.1). Claude가 문구를 고쳐 쓰면 된다. 한국어 발화 문구에 숫자가 남아 있으면 경고한다. TTS가 숫자를 읽는 방식과 정렬 텍스트가 어긋나기 쉬운 곳이다. `voice.provider`는 v1 enum에 이미 있는 `elevenlabs`를 쓴다. `voice` 전체(모델, voice ID, 설정값, seed)가 캐시 키에 들어간다. 위 설정값은 형식 설명용이고 S0 청취로 정한다.

`tag`는 그 문장의 연기 지시이고 v4 audio tag로 TTS 요청에서만 문장 앞에 `[curious, friendly]` 형태로 붙는다. 화면 문구, 자막, 정렬 텍스트에는 들어가지 않는다. 대괄호를 `display`나 `spoken`에 직접 쓰면 검증에서 거부한다.

### 4.3 pronounce.json

```json
{ "schemaVersion": "2.0.0", "lang": "ko-KR",
  "entries": [ { "display": "M/M", "spoken": "맨 먼스" } ] }
```

공용 사전 `config/pronounce/<lang>.json`과 편별 사전 `jobs/<id>/<lang>/pronounce.json`을 합치고, 같은 `display` 키는 편별 항목이 이긴다. 적용은 왼쪽부터, 같은 위치에서는 가장 긴 키 먼저, 겹치지 않게, 대소문자를 구분한 정확 일치로 한다. 결과는 발화 문구와 치환 구간 목록 `[{display:[a,b), spoken:[c,d)}]`이다. TTS 캐시 키에는 사전이 아니라 치환 후 문구가 들어가므로, 이 편과 무관한 사전 항목을 고쳐도 음성 캐시가 깨지지 않는다.

### 4.4 timings.json — 정렬기 출력, 사람이 시각 수정

```json
{
  "schemaVersion": "2.0.0",
  "lang": "ko-KR",
  "audio": { "sha256": "…", "durationMs": 44120, "sampleRate": 24000, "channels": 1 },
  "source": {
    "spokenSha256": "…",
    "phrasingSha256": "…",
    "aligner": { "engine": "elevenlabs-forced-alignment", "endpoint": "/v1/forced-alignment",
                 "algorithmVersion": 1, "overallLoss": 0.04 }
  },
  "status": "needs_alignment_review",
  "phrases": [
    { "id": "s01-a3f19c02", "sentenceId": "s01", "display": "M/M 계산법,", "spoken": "맨 먼스 계산법,",
      "displayRange": [0, 8], "spokenRange": [0, 9],
      "startMs": 120, "endMs": 1310, "maxWordLoss": 0.03, "timingSource": "aligner", "review": "auto", "issues": [] },
    { "id": "s02-0b7d4e11", "sentenceId": "s02", "display": "단가는 1,200원입니다.", "spoken": "단가는 천이백 원입니다.",
      "displayRange": [0, 14], "spokenRange": [0, 13],
      "startMs": 3010, "endMs": 4870, "maxWordLoss": 0.41, "timingSource": "aligner", "review": "flagged",
      "issues": ["high-loss"] }
  ]
}
```

구절 ID는 `<문장 ID>-<구절 화면 문구 SHA-256 앞 8자>`다. 같은 문장 안에 같은 문구가 두 번 나오면 두 번째부터 `-2`, `-3`을 붙인다. 4자로는 실제 충돌이 난다(`항목 15입니다.`와 `항목 167입니다.`가 모두 `9ff9`). 8자에서도 같은 편 안에서 서로 다른 문구가 같은 ID를 받으면 분할 단계에서 오류로 멈춘다. 확률은 낮지만 생기면 문구를 바꾸면 된다. 위 예시의 해시 값과 loss 값은 형식 설명용이다. 이 규칙이면 음성만 다시 만든 경우와 다른 구절만 고친 경우에는 ID가 그대로이고, 문구가 바뀐 구절은 ID가 바뀌므로 그 구절을 참조하던 `scenes.json`이 존재하지 않는 ID로 검증에서 걸린다. 앞에 구절을 끼워 넣어도 기존 구절의 ID가 다른 문구로 옮겨 가지 않는다.

`status`는 `flagged` 구절이 하나도 없을 때만 `ok`다. 사람이 시각을 고치면 그 구절의 `timingSource`를 `manual`, `review`를 `reviewed`로 바꾼다. 구절 경계를 균등 분배나 보간으로 채우지 않는다. `ok`는 자동 검사에서 걸린 구절이 없다는 뜻이고 사람이 전 구간을 검수했다는 뜻이 아니다. 그래서 `review: auto`와 `reviewed`의 개수를 manifest와 초안 승인 화면에 따로 보여 준다. 시각은 정수 ms다.

### 4.5 scenes.json — Claude 작성, 유일한 편집 계약

```json
{
  "schemaVersion": "2.0.0",
  "jobId": "mm-calc",
  "lang": "ko-KR",
  "theme": { "id": "base", "accent": "blue" },
  "captions": { "enabled": true, "style": "phrase-bottom" },
  "tailFrames": 15,
  "scenes": [
    { "id": "hook", "type": "hook", "startPhrase": "s01-a3f19c02",
      "props": { "headline": "M/M 계산법", "sub": "아직도 헷갈리나요?" },
      "transition": { "id": "crossfade", "durationFrames": 12 } },
    { "id": "price", "type": "keyword", "startPhrase": "s02-0b7d4e11",
      "props": { "text": "1,200원", "note": "1인 1개월 기준", "emphasis": "accent" },
      "transition": { "id": "cut" } },
    { "id": "how", "type": "steps", "startPhrase": "s03-5e90b7a3",
      "props": { "title": "계산 순서",
                 "items": [ { "text": "투입 인원 확인", "atPhrase": "s03-c41a0d58" },
                            { "text": "기간을 월로 환산", "atPhrase": "s04-2d6b81f0" } ] } }
  ]
}
```

S1의 장면 유형과 props는 아래와 같다. 글자 수는 시작값이고 S1의 `check` 잘림 결과로 조정한다.

| 유형 | props | 제한 |
|---|---|---|
| `hook` | `headline`, `sub`(선택) | headline 2줄 이내·24자, sub 30자 |
| `keyword` | `text`, `note`(선택), `emphasis`(`accent`·`plain`) | text 12자, note 30자 |
| `steps` | `title`(선택), `items[{text, atPhrase}]` | 항목 2~4개, 항목 22자 |

`transition`은 그 장면과 다음 장면 사이의 경계에 붙는다. S1은 `cut`과 `crossfade`만 받고, 마지막 장면에는 `transition`을 쓰지 않는다.

요소 모션은 모션 문서 §3의 구조(`motion.in`·`motion.out`마다 `id`, `params`, `durationFrames`)를 S0 계약에 포함한다. v2 §6의 S0 완료 기준이 미등록 효과, 다른 효과의 params, 장면보다 긴 모션의 거부를 요구하기 때문이다. 검증기는 `motion/registry.json`을 읽어 효과 ID enum, 효과별 params, 길이 범위, `kind`와 자리의 호환, `verified`의 언어 조합을 검사한다. 실제 효과 설치는 S3(M0)이므로 S0~S2의 운영 registry는 비어 있고, 모션을 쓴 `scenes.json`은 모두 거부된다. 검증기 시험에는 가짜 효과 2개를 담은 `test/fixtures/motion-registry.json`을 쓴다.

스키마가 보는 것 외에 의미 검사로 확인하는 항목은 다음과 같다. 경로·`script.json`·`timings.json`과 `jobId`·`lang`이 맞는지, 언어가 활성인지, `timings.status`가 `ok`인지, 장면 ID가 중복되지 않는지, 첫 장면이 첫 구절에서 시작하는지, `startPhrase`가 구절 순서대로 엄격히 증가하는지, 모든 구절 ID가 존재하는지, `atPhrase`가 그 장면의 구절 범위 안에 있는지 본다. resolve 뒤에는 장면이 `minSceneFrames`(시작값 24) 이상인지, 전환 길이가 앞뒤 장면 길이의 절반보다 짧은지, 모션 in·out 길이 합이 장면 길이보다 짧은지, 전체 길이가 2,700 frame(90초) 이하인지 본다. 90초는 v1 상한을 이어받은 내부 기준이고 플랫폼 제한과는 따로 표시한다.

props 스키마는 `templates/<type>/props.schema.json`에 두고, `gen.mjs`가 이를 `scenes.schema.json`의 유형별 `if/then` 부분으로 합친다. 장면 유형 enum은 `templates/`의 디렉터리와 1:1이다.

### 4.6 timeline.json — resolve 출력

frame으로 바꾼 파생 파일이다. 사람이 고치지 않는다. ms→frame 변환은 항목마다 이 단계에서 한 번만 하고, 정수 연산으로 계산한다.

- 전체 길이: `totalFrames = ceil(durationMs × 30 / 1000) + tailFrames`. 나레이션은 frame 0에서 시작한다.
- 장면 명목 구간 `[nominalStart, nominalEnd)`: `nominalStart = round(startMs × 30 / 1000)`(v1 규칙), 첫 장면은 0. `nominalEnd`는 다음 장면의 `nominalStart`, 마지막 장면은 `totalFrames`.
- 장면 clip 구간 `[clipStart, clipEnd)`: `clipStart = nominalStart − leadIn`, `clipEnd = nominalEnd + leadOut`. 경계 `b`의 전환 길이가 `d`이면 뒤 장면의 `leadIn = floor(d/2)`, 앞 장면의 `leadOut = ceil(d/2)`. cut이면 둘 다 0.
- 크로스페이드: 뒤 장면이 위에 놓여 `[b − floor(d/2), b + ceil(d/2))` 동안 불투명도 0→1로 올라오고 앞 장면은 1을 유지한다. 두 장면이 동시에 반투명해져 배경이 비치는 일을 막는다.
- 요소 시각: `atFrame`은 `nominalStart` 기준 상대 frame이다. 템플릿 타임라인은 clip 시작을 0으로 두므로 요소는 타임라인의 `leadIn + atFrame`에 놓인다. `leadIn` 동안은 첫 요소가 등장하기 전 상태(배경과 장면 골격)를 보여 주고, `leadOut` 동안은 마지막 상태를 유지한다. `motion.out`은 `nominalEnd`에서 끝난다.
- 자막: v1처럼 frame `f`의 시각 `f × 1000 / 30`이 `[startMs, endMs)` 안일 때 보인다. 이를 frame으로 옮기면 `startFrame = ceil(startMs × 30 / 1000)`, `endFrame = ceil(endMs × 30 / 1000)`이다. 다음 구절까지 간격이 `captionGapHoldMs`(시작값 250ms) 미만이면 변환 전에 ms 단계에서 앞 구절 `endMs`를 다음 `startMs`로 늘린다. 마지막 자막은 자기 `endMs`에서 끝난다.

템플릿에 넘기는 `$timing`은 `{fps, clipFrames, leadInFrames, nominalFrames}`이고, 템플릿 타임라인 길이는 `clipFrames / fps`초다.

### 4.7 voice.json, state.json, manifest.json

`jobs/<id>/<lang>/voice.json`은 이 편이 현재 쓰는 음성을 가리킨다. 필드는 `{provider, planTier, ttsKey, audioSha256, spokenSha256, durationMs}`다. `planTier`는 ElevenLabs 음성을 만든 시점의 플랜 등급(`free`·`paid`)이고, 직접 넣은 음성은 `null`이다. `provider: "manual"`이면 `ttsKey`는 `null`이고, 같은 음성을 쓰는지는 `audioSha256`과 `spokenSha256`으로만 판단한다.

`state.json`은 run 단계 기록이다. 단계마다 `status`(`pending`·`running`·`done`·`failed`·`blocked`), `inputHash`, `outputs[{path, sha256}]`, 시작·끝 시각, 오류 요약을 둔다. 임시 파일에 쓰고 fsync한 뒤 rename하는 방식으로 원자적으로 기록한다.

`manifest.json`은 run의 증거 기록이다. 입력 해시(script, 적용된 발음 사전, scenes, timings, audio), 템플릿 트리 해시(쓰인 장면 유형·`_base`·폰트), 모션 레지스트리 해시, 도구 버전(Node, HyperFrames, Chrome, FFmpeg), 형식(1080×1920, 30fps), TTS 정보(provider, model, voice ID, 설정값, seed, 엔드포인트, 캐시 키, 원장 항목), 정렬 검수 현황(`auto`·`reviewed` 구절 수), 검사 결과, 승인 기록, 최종 출력 해시를 담는다.

승인 기록은 `{kind: "draft", draftSha256, renderDepsSha256, at}`이다. `renderDepsSha256`은 run의 `inputs/` 전체, 조립된 `project/` 트리(템플릿·폰트·GSAP 사본 포함), 렌더에 쓰는 설정, HyperFrames·Chrome·FFmpeg 버전을 묶은 해시다. 최종 렌더가 승인한 초안과 같은 재료로 만들어졌는지를 이 값 하나로 확인한다.

## 5. 템플릿과 조립

### 5.1 장면 템플릿 계약

장면 유형 하나는 `templates/<type>/scene.html` 한 파일이다. 파일 전체가 `<template>`로 감싸져 있고, 그 안에 `data-composition-id="__ID__"`·`data-width="1080"`·`data-height="1920"`인 루트 요소, `.t-<type>` 접두어를 쓰는 스타일, 스크립트가 있다. 요소 id는 모두 `__ID__-` 접두어를 붙인다. 조립기는 `__ID__`를 인스턴스 id(`s03-steps` 형식, 패턴 검사 후)로 바꾸고 props 블록을 넣는 것 외에 템플릿을 건드리지 않는다.

스크립트는 `JSON.parse(__PROPS__)`로 props를 읽어 DOM을 만든다. props 값은 `textContent`로만 넣고 `innerHTML`은 쓰지 않는다. 그다음 정지된 GSAP 타임라인 하나를 만들어 `window.__timelines["__ID__"]`에 등록한다. 텍스트 크기를 측정해야 하면 `document.fonts.ready` 안에서 타임라인을 만들고 마지막에 등록한다. `Date.now()`, `performance.now()`, 시드 없는 `Math.random()`, `requestAnimationFrame`, 타이머, 네트워크 호출은 쓰지 않는다. 타이밍 정보는 조립기가 props의 예약 키 `$timing: {fps, clipFrames, leadInFrames, nominalFrames}`로 넘긴다(§4.6).

props 직렬화는 `JSON.stringify`를 두 번 해 JSON을 담은 JS 문자열 리터럴을 만들고, 그 결과에서 `<`, `>`, `&`, U+2028, U+2029를 `\uXXXX`로 바꾼다. 그래서 문구에 `</script>`가 들어 있어도 스크립트가 닫히지 않는다. 템플릿 애니메이션에는 목표값을 넘었다 돌아오는 이징(`back`, `elastic`)을 쓰지 않는다. HyperFrames 0.8.139 런타임은 이런 tween이 끝난 뒤 뒤로 seek하면 다른 값을 그렸다(§9).

`preview.json`은 갤러리·회귀 검사용 고정 props다. 유형마다 한국어·영어 각 1개를 둔다.

### 5.2 GSAP와 폰트

GSAP는 외부 URL에서 받지 않고 `templates/_base/vendor/`의 고정 파일을 쓴다. HyperFrames 기본 프로젝트는 GSAP 3.14.2를 CDN에서 불러오므로 npm `gsap@3.14.2`의 `dist/gsap.min.js`를 커밋해 고정했다(r7, 출처와 해시는 vendor README). 폰트는 `templates/fonts/`의 woff2를 `@font-face`(`font-display: block`)로 선언한다. HyperFrames는 2MiB 이하 로컬 폰트만 번들에 넣는데 한글 폰트는 이보다 클 수 있다. S1에서 Noto Sans KR 가변 폰트 woff2(3.9MB)가 로컬 렌더·스냅샷에 정상으로 쓰이는 것을 확인했다. 폰트 라이선스 파일을 같은 폴더에 둔다.

### 5.3 조립 결과

`assemble.mjs`는 run 안에 HyperFrames 프로젝트를 만든다.

```
out/<id>/<lang>/<run-id>/project/
  index.html               # 루트 composition
  compositions/<scene-id>.html
  compositions/captions.html
  assets/narration.wav  assets/fonts/…
```

루트 `index.html`은 `data-composition-id="root"`, 1080×1920, `data-duration`(초)을 갖는다. 장면 호스트를 `data-composition-src`로 순서대로 마운트하고 `z-index`를 장면 순서대로 올린다. 나레이션은 `<audio id="narration" src="assets/narration.wav" data-start="0" data-volume="1">`로 넣는다. 크로스페이드 불투명도 tween은 루트 타임라인에 둔다. `.clip`의 `display`·`visibility`는 tween하지 않는다(lint 금지 규칙).

### 5.4 frame→초 변환

변환은 조립기 한 함수에서만 한다. 시작과 끝을 각각 마이크로초 정수로 내림해 `startUs = floor(startFrame × 10⁶ / 30)`, `endUs = floor(endFrame × 10⁶ / 30) − 1`로 두고, `data-start = startUs / 10⁶`, `data-duration = (endUs − startUs) / 10⁶`를 소수 6자리로 적는다. 엔진이 frame `f`에서 쓰는 시각 `f/30`은 내림한 시작값 이상이 되므로 장면은 정확히 `startFrame`부터 보인다. HyperFrames 스킬 문서는 clip을 `start ≤ t < start + duration` 반열린 구간으로 보인다고 적는데, 엔진이 두 값을 double로 더하면 `0.4 + 0.8 = 1.2000000000000002`처럼 끝 frame이 구간 안에 들어간다. 그래서 끝을 1µs 당긴다(r7). `scripts/engine-check.mjs boundaries`가 frame%3이 0·1·2인 경계, 1 frame clip, sub-composition 안의 중첩 clip, 크로스페이드를 png-sequence 픽셀로 검사해 통과했다.

## 6. 음성 (tts.mjs)

### 6.1 요청

모델은 `eleven_v4`, 출력은 `wav_24000`, 인증은 `xi-api-key` 헤더다. S0 첫 호출(2026-10-07)에서 v4가 일반 TTS 엔드포인트로 동작해 `config/pipeline.json`의 `tts.endpoint`를 `tts`로 정했다. 아래 `dialogue` 본문은 기록으로 남긴다. 운영 중에는 바꾸지 않고, 오류가 나도 다른 엔드포인트로 자동 전환하지 않는다. 엔드포인트 미지원이 아닌 401·402·429·timeout은 엔드포인트 선택과 무관하다.

`tts` 엔드포인트(우선 시험):

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=wav_24000
{ "text": "<요청 문자열>", "model_id": "eleven_v4", "language_code": "<ttsLanguageCode>",
  "voice_settings": { "stability": <settings.stability>, "similarity_boost": <settings.similarity> },
  "seed": <seed>, "apply_text_normalization": "auto" }
```

`dialogue` 엔드포인트(S0에서 위가 모델 미지원으로 거부될 때):

```
POST https://api.elevenlabs.io/v1/text-to-dialogue?output_format=wav_24000
{ "inputs": [ { "text": "<요청 문자열>", "voice_id": "<voiceId>" } ], "model_id": "eleven_v4",
  "language_code": "<ttsLanguageCode>",
  "settings": { "stability": <settings.stability>, "similarity": <settings.similarity> },
  "seed": <seed>, "apply_text_normalization": "auto" }
```

Dialogue API의 기본 모델은 `eleven_v3`, 기본 출력은 `mp3_44100_128`이라 두 값을 생략하지 않는다. `output_format`을 query로 받는지 본문으로 받는지는 S0에서 확인한다. 요청 문자열은 문장마다 줄바꿈으로 이은 발화 문구이고, 문장 `tag`가 있으면 그 문장 앞에 `[tag] `를 붙인다. Dialogue 경로는 입력 합계 2,000자 이하를 권장하는데 45초 대본은 이 안에 든다.

`apply_text_normalization: "auto"`이면 숫자 읽기는 ElevenLabs가 정한다. 그러면 발화 문구의 숫자와 실제 음성이 달라 정렬이 어긋날 수 있다. S0에서 숫자를 풀어 쓴 발화 문구와 숫자를 그대로 둔 발화 문구를 각각 합성·정렬해 비교하고, 그 결과로 §4.2의 숫자 경고를 오류로 올릴지 정한다. v4의 연기 지시는 audio tag뿐이고 문서는 태그가 효과음처럼 읽히는 경우가 있다고 적고 있어, S0 청취에서 태그 있는 문장과 없는 문장을 함께 들어 본다.

### 6.2 캐시

캐시 키는 `{adapter: "elevenlabs@1", planTier, endpoint, body}`의 정규화 JSON 해시다. `planTier`(`config/pipeline.json`의 `tts.planTier`)를 키에 넣는 이유는 유료로 바꾼 뒤 Free 시절 음성이 캐시 hit로 재사용되는 일을 막기 위해서다. `body`는 위 형식대로 만든 실제 전송 본문(query의 `output_format` 포함)이므로 태그, 설정값 이름 변환, 생략하지 않은 기본값이 모두 키에 들어간다. `seed`는 넣지만 문서가 결정론을 보장하지 않으므로 재현은 캐시로만 한다.

결과는 `cache/tts/<key>.wav`와 `<key>.json`(요청 내용과 키, `audioSha256`, `durationMs`, 요청 글자 수, 응답에 `request-id`·`character-cost` 헤더가 있으면 그 값, HTTP 상태, 생성 시각)으로 남긴다. 둘 다 있고 WAV 해시가 기록과 같으며 RIFF 헤더가 24kHz·mono·16bit일 때만 캐시 hit다. 채널 수는 S0 응답으로 확인한다. 손상된 파일은 hit가 되지 않고, 덮어쓰지 않고 `<key>.corrupt-<시각>.wav`로 옮긴 뒤 다시 합성한다.

### 6.3 실패 처리와 원장

TTS와 Forced Alignment는 같은 원장 `cache/ledger.jsonl`을 쓴다. 요청을 보내기 전에 `{attemptId, kind: "tts"|"align", key, phase: "started", 시각}` 줄을 fsync까지 끝내 기록하고, 응답을 받으면 같은 `attemptId`로 `phase: "done"|"failed"`와 상태 코드, `request-id`, `character-cost`(있으면), 사용량 필드(아래 §6.4)를 붙인다. 프로세스가 시작될 때 `started`만 있고 끝 줄이 없는 시도가 있으면, 전송 후 연결이 끊겼거나 프로세스가 죽은 경우라 서버 처리 여부를 알 수 없다. 그 키를 `unknown`으로 보고 부르지 않는다. timeout도 같은 상태가 된다.

| 상황 | 판별 | 처리 (TTS·정렬 공통) |
|---|---|---|
| 크레딧 소진 | HTTP 402 `insufficient_credits`. 문서에 없는 `quota_exceeded` 코드가 와도 같게 처리 | 재시도 없이 멈추고 `blocked:credits`로 기록 |
| 월 상한 도달 | 호출 전 원장 검사(§6.4) | 호출하지 않고 멈춤 |
| 동시 요청·혼잡 | HTTP 429 `concurrent_limit_exceeded`·`rate_limit_exceeded`·`system_busy` | 10초, 40초 대기 후 최대 2회 재시도. 시도마다 상한 검사를 다시 한다 |
| 일시 오류 | HTTP 500·502·503·504 | 같은 재시도 |
| 처리 여부 불명 | 클라이언트 timeout 120초, 끝 줄 없는 `started` | 재시도하지 않는다. 사람이 ElevenLabs 사용 내역을 확인한 뒤 `voice --ack-unknown <attemptId>`를 실행해야 그 키를 다시 부른다 |
| 요청 오류 | HTTP 400·401·422 | 멈추고 응답의 `detail`을 표시 |
| 형식 이상 | TTS: RIFF 아님, 길이 0, 24kHz가 아님. 정렬: 필수 필드 없음 | 멈추고 응답 메타만 저장 |

정렬이 실패해도 TTS 캐시는 그대로 둔다. `voice`를 다시 실행하면 합성은 캐시에서 가져오고 정렬만 다시 부른다.

### 6.4 플랜과 월 상한

개발·시험 단계는 Free 플랜(월 1만 크레딧, 동시 요청 2개)으로 한다. Free 플랜 음성은 상업 이용이 안 되고, 나중에 업그레이드해도 그 음성은 상업 이용이 안 된다. 그래서 Free 음성은 시험용으로만 쓰고 게시용 음성은 유료 플랜으로 바꾼 뒤 새로 만든다. Free 플랜 API로 v4와 Forced Alignment를 쓸 수 있는지는 S0 첫 호출로 확인한다. 정렬을 쓸 수 없으면 S0~S2 시험은 수동 timings(§6.5)로 진행한다.

`voice.json`의 `planTier`가 `free`인 음성으로 만든 run은 manifest에 `publishable: false`를 남기고, `final`은 결과를 `final.NOT-FOR-PUBLISH.mp4`로 저장한다. 초안 승인 화면에도 게시 불가를 표시한다. 유료로 바꿀 때는 `tts.planTier`를 `paid`로, `budget.monthlyCredits`를 새 플랜 값으로 고친다. 캐시 키가 달라지므로 같은 대본도 새로 합성된다.

Free 플랜 1만 크레딧 안에서의 시험량은 1자 1크레딧 가정으로 이렇게 어림한다. S0 청취 비교(ko·en 10문장, 음성 후보 2~3개)가 약 2,500, S2 실제 시험(검출력 다섯 경우 ko·en, 숫자 변경·캐시 시험)이 약 6,000이다. S1은 수동 경로라 쓰지 않는다. 비율이 1보다 크거나 재합성이 늘면 한 달 안에 끝나지 않을 수 있고, 그때는 다음 결제 주기까지 기다리거나 유료로 바꾼다.

상한은 크레딧 단위 하나로 둔다. `config/pipeline.json`에 `budget.monthlyCredits`(시작값은 플랜 월 크레딧, Free는 10,000), `budget.billingCycleStartDay`, `budget.ttsCreditsPerChar`, `budget.alignCreditsPerSecond`를 둔다. 원장의 각 시도는 `credits` 필드를 갖는다. TTS는 요청 글자 수 × `ttsCreditsPerChar`, 정렬은 음성 초 × `alignCreditsPerSecond`이고, 응답에 `character-cost`가 있으면 그 값을 쓴다. 호출 전에 이번 결제 주기의 `credits` 합계(`started`만 있는 시도와 `unknown` 시도 포함)에 이번 시도 추정값을 더해 `monthlyCredits`를 넘으면 부르지 않는다.

두 비율 모두 문서에서 찾지 못했다. v4가 글자당 몇 크레딧인지, 정렬이 구독 크레딧에서 빠지는지 별도 과금(시간당 $0.22)인지 S0에서 첫 호출의 헤더와 대시보드 사용량으로 확인해 적는다. 정렬이 구독 크레딧을 쓰지 않으면 `alignCreditsPerSecond`는 0이고, 원장에 음성 초만 남긴다.

아래 표는 유료로 바꾼 뒤 운영할 때의 기준이다. 45초 나레이션의 글자 수는 말 속도로 어림해 한국어 약 350자, 영어 약 750자로 잡았다. 실측이 아닌 추정이고 S2에서 원장 값으로 바꾼다. 1자 1크레딧, 재생성 20%를 가정하고 태그 글자, 정렬, S0·S2 시험 호출은 넣지 않은 값이다.

| 월 출력 | 필요 크레딧(추정) | 맞는 플랜 |
|---|---:|---|
| ko 하루 1편 (30) | 약 12,600 | Starter (30k, $6) |
| ko·en 하루 1편씩 (60) | 약 39,600 | Creator (121k, $22) |
| ko·en 하루 2편씩 (120) | 약 79,200 | Creator |

v4가 1자에 1크레딧보다 많이 쓰면 맞는 플랜이 한 단계 올라간다. 가격 페이지의 할인(Starter 첫 달 $1 10월 18일까지, Creator 이상 크레딧 3배와 v4 API 72% 할인 10월 12일까지)은 기한이 있어 기준으로 쓰지 않는다. 이 비용은 [기획 v2](2026-10-04-claude-code-render-plan-v2.md) §7의 Gemini 기준 비용표를 대체한다.

### 6.5 직접 넣은 음성과 수동 timings

직접 녹음하거나 다른 도구로 만든 음성은 `voice --audio-file <wav>`로 넣는다. ffmpeg로 24kHz·mono·16bit로 바꾸고, `voice.json`에 `provider: "manual"`, 바꾼 파일의 해시, 현재 발화 문구 해시를 적는다. 정렬은 TTS 음성과 같은 Forced Alignment 경로를 탄다.

자동 정렬을 쓸 수 없을 때는 `voice --audio-file <wav> --timings <json>`으로 사람이 만든 시각을 함께 들여온다. 이 경우 정렬 API를 부르지 않는다. 들여온 파일은 timings 스키마, 지금의 구절 분할(ID·문구·범위), §7.2의 6번 시각 검사를 통과해야 하고, 모든 구절이 `timingSource: "manual"`, `review: "reviewed"`로 저장된다. S1은 API 키 없이 이 경로로 진행한다.

v2 §6의 문단별 합성·캐시는 S2 범위에 넣지 않는다. 한 편을 한 번에 합성하므로 문장 하나를 고쳐도 전체를 다시 부른다.

## 7. 정렬 (align.mjs)

### 7.1 구절 분할

정렬 전에 화면 문구를 자막 구절로 나눈다. 같은 입력이면 항상 같은 결과가 나오는 코드이고 LLM을 부르지 않는다. 문장 안에서 쉼표·마침표·물음표 같은 구두점 뒤를 1차 경계로 삼되, 숫자 사이의 구두점(`1,200`, `3.14`)은 경계로 보지 않는다. 그래도 `maxCaptionGraphemes`를 넘으면 공백 단위(한국어는 어절, 영어는 단어)로 앞에서부터 채워 나눈다. 발음 사전 치환 구간 안에서는 나누지 않는다. 공백 없는 덩어리나 치환 구간 하나가 제한을 넘어 나눌 수 없으면 분할하지 않고 오류로 돌려보낸다(§4.2). 화면 문구 범위는 치환 구간 목록으로 발화 문구 범위에 옮긴다. 치환 밖 구간은 앞선 치환들의 길이 차이만큼 이동한 위치가 된다.

### 7.2 강제 정렬

1. 정렬 텍스트는 TTS 요청과 같은 발화 문구에서 태그만 뺀 것이다(문장마다 줄바꿈). 직접 넣은 음성도 같은 텍스트를 쓴다.
2. `POST /v1/forced-alignment`에 multipart로 `file`(narration.wav)과 `text`를 보낸다. 응답의 `characters[{text, start, end}]`, `words[{text, start, end, loss}]`, 전체 `loss`를 받는다. 시각은 초 단위이므로 반올림한 정수 ms로 바꾼다.
3. 응답 `characters`를 정렬 텍스트의 코드 포인트에 앞에서부터 하나씩 대응시킨다. 응답에는 공백·줄바꿈도 들어 있지만 multipart 전송 중 `\n`이 `\r\n`으로 바뀌어 돌아오므로, 양쪽 모두 공백 문자를 건너뛰고 나머지 글자를 순서대로 맞춘다(S0 확인). 공백이 아닌 글자가 어긋나면 내용 문제가 아니라 adapter 오류이므로 `mapping-error`로 편 전체를 멈춘다.
4. 구절 시작은 구절 첫 글자의 `start`, 끝은 마지막 글자의 `end`다. 구절에 속한 단어의 최대 `loss`를 `maxWordLoss`로 기록한다.
5. 내용 검사. Forced Alignment는 주어진 텍스트를 음성에 맞춰 넣는 방식이라 TTS가 어구를 빠뜨려도 시각을 만들어 낸다. 그래서 시각 자체가 아니라 다음 신호로 걸러 낸다. 단어 `loss`가 기준값을 넘으면 `high-loss`(텍스트와 음성의 불일치 의심), 연속한 두 단어 사이가 1,000ms를 넘으면 그 간격 양옆 구절에 `long-gap`(덧붙은 발화·효과음·긴 쉼 의심)을 붙인다. 이 간격 검사는 구절 안팎을 가리지 않고, 첫 단어 앞과 마지막 단어 뒤의 무음도 1,000ms를 넘으면 포함한다. 정규화한 구절 문구가 앞뒤 2구절 안에 다시 나오면 `repeat-risk`다. loss 기준값은 문서에 근거가 없어 S2의 §7.3 시험 결과로 정한다. 1,000ms도 S2에서 조정할 시작값이다.
6. 구절 시각을 검사한다. 시작 < 끝, 앞 구절 끝 ≤ 다음 구절 시작, 길이 200ms 이상, 끝 ≤ 음성 길이. 어긋나면 `non-monotonic`·`overlap`·`too-short`·`out-of-range`로 표시한다.

5~6에서 표시가 하나라도 붙은 구절은 `review: flagged`가 된다. 자동 검사가 통과해도 초안 전체 시청이 마지막 확인이다.

정렬 호출은 45초에 약 $0.003(STT와 같은 시간당 $0.22)이다. 구독 크레딧에서 빠지는지 별도 과금인지는 확인하지 못했고 원장 기록으로 확인한다. Forced Alignment를 플랜에서 쓸 수 없거나 한국어 결과가 기준(§7.3)에 못 미치면 당장은 수동 timings(§6.5)로 제작을 끝내고, 자동 정렬 대안은 그때 다시 정한다. [r2 §7](archive/implementation-design-r2.md)의 whisper.cpp 설계가 참고 자료다.

### 7.3 정확도와 검출 한계 확인

v2 S2 기준(대표 10구간, 시작·끝 오차 150ms 이내)은 사람이 듣고 만든 기준 파일 `test/fixtures/align/<lang>-reference.json`과 비교해 `align.mjs --report`가 표로 출력한다. 기준 파일은 숫자·통화·약어·영한 혼용·반복어가 든 구간을 포함한다. 기준 시각을 만드는 일은 사람 작업이고 언어당 한 번 필요하다.

검출 규칙은 단위 테스트와 실제 시험으로 나눠 확인한다. 단위 테스트는 S0·S2의 실제 응답을 저장한 fixture로 공백·줄바꿈 처리 차이, 분해형 한글(NFD) 입력, 이모지가 든 화면 문구에서 범위 복원이 맞는지 보고, loss·간격·반복 값을 바꾼 fixture로 분기가 맞게 갈리는지 본다. 이것은 코드 분기 검증이지 검출력 검증이 아니다.

검출력은 S2에서 ko·en 각각 실제 API로 다섯 경우를 만들어 기록한다.

| 경우 | 만드는 법 |
|---|---|
| TTS 누락 | 구절 하나를 뺀 대본으로 합성한 음성 + 전체 대본으로 정렬 |
| 추가 발화 | 전체 대본 음성 + 구절 하나를 뺀 대본으로 정렬 |
| 반복어 삭제 | 반복어 하나를 뺀 대본으로 합성한 음성 + 전체 대본으로 정렬 |
| 경계 삽입 | 구절 경계에 다른 문장을 끼운 대본으로 합성한 음성 + 원래 대본으로 정렬 |
| 태그 효과음 | 효과음처럼 읽힌 태그 문장이 든 음성 + 태그를 뺀 대본으로 정렬 |

판정은 특정 표시가 나오는지가 아니라 문제 구간이 `flagged`로 사람 검수에 넘어가는지다. 결과는 경우별 검출·미검출로 worklog에 남기고, 검출하지 못한 유형은 `/short`가 초안 승인 전에 보여 주는 청취 확인 목록에 넣는다. S2 통과 조건은 다섯 경우의 기록과 이 목록이 존재하는 것이다. 호출 비용은 몇 센트 이하다.

### 7.4 캐시와 파일 갱신

정렬 결과는 `cache/align/<key>.json`에 둔다. 키는 음성 해시, 정렬 텍스트 해시, 구절 분할 결과 해시, 엔드포인트, 정렬 알고리즘 버전(`algorithmVersion`, 대응·검사 규칙을 바꿀 때 올린다)으로 만든다.

`jobs/<id>/<lang>/timings.json`을 갱신할 때 자동 결과와 사람 수정을 따로 다룬다. 기존 파일과 키가 같으면 파일을 그대로 둔다. 키가 다르면 기존 파일을 `timings.prev-<해시 8자>.json`으로 옮기고 새 자동 결과를 쓴 뒤, 음성 해시가 같은 경우에 한해 기존 파일의 `manual` 구절 중 ID·화면 문구·발화 문구·범위가 모두 같은 것의 시각을 옮겨 온다. 옮겨 온 구절도 7.2의 6번 시각 검사를 다시 거친다. 음성이 바뀌었으면 사람 수정은 옮기지 않는다.

## 8. 실행·재개·승인 (run.mjs)

```
node scripts/run.mjs voice  --job <id> --lang ko [--audio-file x.wav]
node scripts/run.mjs build  --job <id> --lang ko
node scripts/run.mjs draft  --run <run-dir>
node scripts/run.mjs approve --run <run-dir>
node scripts/run.mjs final  --run <run-dir>
node scripts/run.mjs resume --run <run-dir>
```

`voice`는 편 단위 명령이다. 발화 문구를 만들고, TTS(캐시)와 정렬(캐시)을 거쳐 `voice.json`과 `timings.json`을 갱신한다. run을 만들지 않으며 같은 입력으로 다시 실행해도 API를 부르지 않는다. Claude는 이 결과의 구절 목록을 보고 `scenes.json`을 쓴다.

`build`는 먼저 지금의 입력과 음성이 한 벌인지 확인한다. 공통으로 음성 파일 해시가 `voice.json`의 `audioSha256`과 같은지, 현재 발화 문구 해시가 `voice.json`의 `spokenSha256`과 같은지, `timings.json`의 `audio.sha256`·`spokenSha256`·`phrasingSha256`이 현재 값과 같은지 본다. `provider: "elevenlabs"`이면 지금의 `script.json`·발음 사전·voice 설정·`tts.endpoint`로 만든 캐시 키가 `ttsKey`와 같은지도 본다. `manual`이면 TTS 키 검사는 하지 않는다. 하나라도 다르면 `voice`를 먼저 실행하라고 안내하고 멈춘다. 대본을 고치고 `voice`를 건너뛴 채 옛 음성으로 run을 만드는 일을 여기서 막는다.

확인이 끝나면 새 run을 만든다. run ID는 `YYYYMMDD-HHMMSS-<4자 hex>`(Asia/Seoul)이고 이미 있으면 새로 뽑는다. `inputs/`에 script·적용된 발음 사전·timings·scenes·음성 파일을 복사하고, validate → resolve → assemble → lint → check → snapshot을 차례로 실행한다. `draft`는 `-q draft` 렌더와 출력 검사를 한다.

`approve`는 사람이 초안을 본 뒤 직접 실행한다. `/short` 스킬은 이 명령을 실행하지 않고 사람에게 명령을 보여 준다. 승인은 `draft.mp4` 해시와 `renderDepsSha256`(§4.7)을 기록한다. `final`은 세 조건이 모두 맞을 때만 실행한다. 승인 기록의 초안 해시가 지금의 `draft.mp4`와 같고, 지금 다시 계산한 `renderDepsSha256`이 승인 기록과 같고, `jobs/`의 현재 입력 해시가 run의 `inputs/`와 같아야 한다. 세 조건을 통과해도 run의 음성이 Free 플랜 음성이면 게시 불가 이름으로 저장한다(§6.4). 대본을 고친 뒤 옛 run을 최종 렌더하려 하면 여기서 거부된다. 고친 입력은 `voice`와 `build`로 새 run을 만들고, 그 run은 승인이 없는 상태에서 시작한다.

`resume`은 `state.json`을 읽어 `done`이고 `inputHash`와 출력 해시가 모두 기록과 같은 단계를 건너뛴다. `draft`·`final`을 이미 끝낸 run에서 다시 호출하면 기존 파일 경로와 해시만 보여 주고 아무것도 다시 만들지 않는다. 렌더 출력은 `.partial` 이름으로 쓰고 끝난 뒤 rename하므로 중단된 렌더 파일이 완성본으로 남지 않는다. run의 음성은 `inputs/`에 있어 재개할 때 TTS를 부르지 않는다. 입력 해시가 기록과 다르면 재개를 거부하고 새 `build`를 안내한다(D9).

## 9. 렌더 래퍼와 출력 검사 (render.mjs)

HyperFrames는 `node_modules/.bin/hyperframes`의 고정 버전을 직접 실행하고, 텔레메트리·업데이트 확인을 끈 환경변수를 붙인다. 품질은 초안 `draft`, 최종 `high`로 항상 명시하고 `-f 30`을 넘긴다.

| 검사 | 방법 | 통과 기준 |
|---|---|---|
| 정적 검사 | `lint --json` | 오류 0 |
| 런타임·레이아웃 | `check --json --at-transitions` | 런타임 오류 0, 글자 잘림·넘침 0. 대비 경고는 기록만 |
| 스냅샷 | `snapshot --at`에 장면마다 시작+1·중간·끝−1 frame 시각 | PNG 생성. Claude가 보고 `scenes.json` 데이터만 고친다 |
| 형식 | `ffprobe -count_frames` | 1080×1920, `r_frame_rate` 30/1, 프레임 수 = `totalFrames`, `pix_fmt` yuv420p, codec = S1에서 고정한 기대값 |
| 음성 | `ffprobe` + `ffmpeg volumedetect` | 오디오 스트림 1개, 길이 ≥ 나레이션 길이 − 50ms, `max_volume` > −50dB |
| 결정론 | S1과 템플릿 변경 시 | 같은 frame을 순차·역순·무작위 순서로 뽑은 PNG 해시 일치 |

결정론 검사는 `snapshot --at`에 frame 목록을 순방향·역방향·시드 고정 무작위 순서로 넣어 세 번 실행하고 같은 frame끼리 비교한다(`scripts/engine-check.mjs determinism`). `snapshot`은 `--at` 순서대로 한 페이지에서 seek하고 그 순서로 파일 번호를 붙인다(CLI 0.8.139 소스 확인). Chrome 합성 단계가 직전 seek에 따라 1 LSB 차이를 내는 경우가 있어(자막 경계 근처) 채널별 차이 2 이하를 같은 frame으로 본다(r7). `snapshot`과 `check`는 `--no-browser-gpu`로 돌리고, `snapshot`은 `GEMINI_API_KEY`가 있으면 Gemini 비전 분석을 기본으로 부르므로 래퍼가 API 키 환경변수를 지우고 `--describe false`를 넘긴다. 검사 frame에는 홀수·짝수 길이 전환의 경계 앞뒤, `frame % 3`이 0·1·2인 경계(30fps에서 ms 내림이 달라지는 경우), 마지막 frame을 넣는다. `snapshot`이 9:16 크기로 저장하는지도 문서에는 1920×1080으로만 적혀 있어 같은 때 확인한다.

## 10. /short 스킬 (S3)

`.claude/skills/short/SKILL.md` 하나다. 인자는 `"주제" --lang ko,en --format explainer`이고, 흐름은 다음 순서로 고정한다.

1. 언어마다 `script.json`을 쓴다. 근거가 필요한 주장은 `sources`에 남긴다.
2. `run.mjs voice`를 실행한다. `needs_alignment_review`면 flagged 구절을 표로 보여 주고 멈춘다.
3. `templates/SCENES.md`, `motion/CATALOG.md`(S3 M0 이후), 구절 목록(`id`와 `display`만)을 읽고 `scenes.json`을 쓴다.
4. `run.mjs build`. 실패하면 오류 메시지에 따라 `scenes.json`만 고친다.
5. 스냅샷 PNG를 보고 레이아웃 문제를 데이터 수정으로 해결한다. 같은 문제가 두 번 반복되면 멈추고 사람에게 알린다.
6. `run.mjs draft` 후 초안 경로, 청취 확인 목록(§7.3), `approve` 명령을 보여 주고 멈춘다.

스킬은 `templates/`, `motion/`, `scripts/`, `out/**/project/`를 고치지 않는다. 템플릿 문제를 발견하면 개발 작업으로 넘긴다. 운영 때 Claude가 읽는 파일은 위 세 개와 오류 출력뿐이라 편당 토큰이 일정하다. 저가 모델 지정은 스킬 frontmatter의 `model` 필드 지원 여부를 S3에서 확인한 뒤 정한다.

## 11. 단계별 작업과 완료 기준

v2 §10의 단계와 완료 기준을 그대로 쓰고, 각 기준을 확인할 테스트를 붙였다.

### S0 준비·계약

사용자 확인이 필요한 일: `package.json` 의존성 설치(D1), ElevenLabs Free 플랜 가입과 API 키 발급(사용자가 직접 만들어 `.env`에 넣는다, §6.4. 유료 전환은 게시용 음성을 만들 때), 청취용 voice 후보.

작업: `npx hyperframes doctor --json`(FFmpeg 8.0.1·Node 23 판정 확인), 텔레메트리 끄기, 도구 버전을 worklog에 기록, `schemas/v2/`의 스키마 5개와 `languages.json`, `validate.mjs`와 fixture(모션 부분은 가짜 registry로 시험, §4.5), 정규화·해시·frame 변환 함수와 단위 테스트, ElevenLabs 첫 호출로 v4 엔드포인트·WAV 채널·`character-cost`·크레딧 비율 확인(§6.1, §6.4), ko·en 각 10문장 청취용 합성(태그 있는 문장 포함), Forced Alignment 응답 한 건으로 글자 대응 규칙 확정(§7.2), 정렬 과금 방식 확인(§6.4), 숫자 정규화 비교(§6.1).

HyperFrames 스킬은 Claude Code 전역 플러그인(`claude plugin marketplace add heygen-com/hyperframes`, `claude plugin install hyperframes@hyperframes`)으로 설치한다. 전역 설치는 저장소에 버전이 남지 않으므로 설치 직후 `claude plugin list --json`에서 플러그인 버전을, 마켓플레이스 체크아웃에서 git 커밋을 읽어 `config/tools.lock.json`에 적고 커밋한다. 같은 파일에 `package.json`에 고정한 HyperFrames CLI 버전도 적는다. `scripts/env-check.mjs`는 `build`와 템플릿 작업 전에 설치된 플러그인 버전·커밋을 이 파일과 대조하고, 다르면 멈추고 차이를 보여 준다. 플러그인 업데이트는 의도한 작업으로만 한다. 업데이트 → 갤러리·결정론 회귀 검사(§9, 모션 문서 §3) → 통과하면 lock 파일 갱신·커밋 순서다. 마켓플레이스 체크아웃 경로와 자동 업데이트를 끄는 방법은 S0 설치 때 확인한다.

| v2 완료 기준 | 확인 방법 |
|---|---|
| doctor 통과 | `doctor --json`의 `.ok == true` |
| ko·en TTS 각 10문장 청취 | 합성 파일 20개와 청취 메모를 worklog에 기록 |
| ko·en fixture 통과 | `node --test`의 valid fixture 테스트 |
| 오류 사례 거부 | invalid fixture마다 기대 오류 코드 일치. v2 §6이 지정한 미등록 효과 ID, 다른 효과의 params, 장면보다 긴 모션, 지원하지 않는 언어에 더해 비활성 언어, 미검증 언어·효과 조합, 미등록 장면 유형, 다른 유형의 props, 없는 구절 ID, 역순 `startPhrase`, 장면 밖 `atPhrase`, 장면보다 긴 전환, `schemaVersion` 불일치, 추가 속성 |
| (추가) 시간 변환 | 단위 테스트: 장면 `round`, 자막 `ceil`, gap 249·250·251ms, 비정수 frame 경계, 홀수·짝수 전환의 lead 분배, 마이크로초 내림 |

### S1 첫 1편

작업: `templates/_base`, `hook`·`keyword`·`steps`, 자막 composition, `resolve.mjs`, `assemble.mjs`, `render.mjs`. 음성과 시각은 `voice --audio-file <wav> --timings <json>`(§6.5)으로 넣는다. API 키 없이 진행하며 정렬기는 S2에서 붙는다.

| v2 완료 기준 | 확인 방법 |
|---|---|
| 폰트 로드 | `lint` 폰트 규칙 통과, 스냅샷에서 대체 글꼴 없음(사람 확인) |
| 글자 잘림 0 | `check` 잘림·넘침 0 |
| 순차·역순 seek 동일 | §9 결정론 검사 |
| `ffprobe` 규격 | §9 형식 검사 |
| (추가) 장면 경계 | 모든 경계 앞뒤 frame에서 보이는 장면이 `timeline.json`과 일치 |
| (추가) 직렬화 | `</script>`, 따옴표, 줄바꿈, U+2028이 든 문구로 조립·렌더 성공 |
| (추가) 수동 음성 경로 | API 키 없이 수동 WAV+timings로 1편 완성. 이후 WAV나 발화 문구를 바꾸면 `build` 거부 |
| (추가) 자막 경계 | 자막 시작·끝 frame과 그 앞뒤 frame 스냅샷이 ms 판정 결과와 일치 |

HyperFrames가 한국어 줄바꿈·폰트·자막 처리를 하지 못할 때만 같은 입력으로 Remotion을 하루 시험한다(v2 §10).

### S2 음성 연결

작업: `tts.mjs`(ElevenLabs), `align.mjs`(Forced Alignment), `run.mjs`의 `voice`·`build`·`draft`·`approve`·`final`·`resume`, `manifest.json`.

| v2 완료 기준 | 확인 방법 |
|---|---|
| 제목 색만 바꾸면 TTS 호출 0 | `theme.accent`만 바꿔 `voice`+`build` 실행, 원장에 새 줄 없음 |
| 발화 숫자 하나를 바꾸면 새 음성·정렬, 이전 승인 거부 | 원장에 `kind: tts` 시도 1회와 `kind: align` 시도 1회가 새로 생기고, 새 `timings.json`, 옛 run에 `final` 시 거부 |
| 손상된 음성은 캐시 통과 못 함 | 캐시 WAV 1바이트 변경 후 `voice` → 재합성, 손상 파일은 `.corrupt-*`로 이동 |
| 렌더 중단 후 음성 호출 없이 재개 | `draft` 중 프로세스 종료 → `resume` → 원장 변화 없음, `.partial` 정리 |
| 대표 10구간 오차 150ms | §7.3 보고서 |
| (추가) 실패 처리 | fetch를 가짜로 바꾼 단위 테스트로 TTS·정렬 각각 402·429·503·timeout·422·형식 이상과 월 상한 도달을 확인. 전송 직후 프로세스 종료·timeout 뒤 `voice` 재실행 시 호출 0, `--ack-unknown` 뒤에만 호출. 503 재시도마다 상한 재검사. 정렬 실패 후 재실행 시 TTS 호출 0 |
| (추가) 크레딧 상한 | 비율 0.5·1·2, TTS+정렬 혼합 원장, unknown 시도, 결제 주기 경계에서 상한 판정이 기대값과 같음 |
| (추가) 요청 계약 | 두 엔드포인트의 요청 fixture에서 모델·출력 형식·seed·언어·태그·정규화·설정값 이름 확인 |
| (추가) 구절 ID | `항목 15입니다.`→`항목 167입니다.` 교체 fixture에서 이전 scenes 거부, 수동 시각 미이관 |
| (추가) 옛 음성 차단 | 숫자·voice·발음 사전 중 하나를 바꾸고 `voice` 없이 `build` → 거부 |
| (추가) 승인 범위 | 승인 후 run의 `project/` 파일 하나를 바꾸면 `final` 거부. `final`을 두 번 실행해도 `final.mp4` 해시 불변 |
| (추가) 정렬 검출 | §7.3 단위 테스트와 다섯 경우 실제 시험 기록, 청취 확인 목록 |

### S3 반복 제작

작업: 영어 활성화, 장면 유형 5~6종(`compare`, `stat`, `cta` 후보), `/short` 스킬, 모션 M0(모션 문서 §3 단계표). 완료 기준은 v2 §10 그대로다. 서로 다른 주제 3편을 HTML 재작성 없이 완성하고, 편당 사람 작업 시간(목표 20분 이하)·재생성률·실패 비용을 기록한다.

### 위임

계약 정의, resolve·조립의 시간 계산, 정렬 대응·검사 규칙, 단계 통합은 Opus가 맡는다. fixture 작성, 단위 테스트 골격, `render.mjs`의 ffprobe 파싱, `gen.mjs`, 패키지 초기 구성은 Sonnet에 넘긴다. 단계가 끝날 때마다 Codex가 diff를 리뷰한다. 정렬기는 대체 구현을 따로 만들지 않고 독립 기준 fixture(§7.3)로 검증한다. 위임 결과는 설명이 아니라 diff와 테스트 결과로 통합한다.

## 12. 미확인 사항

- ElevenLabs v4: 동시 요청 한도, 크레딧 소진 시 402의 실제 코드, audio tag가 효과음처럼 읽히는 빈도. (S0 확인: Free에서 v4·Forced Alignment 사용 가능, 일반 TTS 엔드포인트 지원, 1자 1크레딧, `language_code` 수용, `wav_24000`은 mono, Voice Library 음성은 Free API에서 402 `paid_plan_required`)
- Forced Alignment: 한국어 정확도, `loss` 기준값(정상 대본에서 단어 loss 0.6~1.1), 누락·삽입 검출력. (S0 확인: 구독 크레딧에서 음성 1초당 약 1.1~1.16 차감)
- Dialogue API의 `output_format` 전달 위치, `apply_text_normalization`의 한국어 숫자 처리
- HyperFrames: FFmpeg 8.0.1·Node 23 호환, `data-fps` 속성, clip의 반열린 구간 여부, 기본 출력 codec, `snapshot`의 세로 크기, GSAP 기본 로드 방식, 2MiB를 넘는 한글 폰트 처리
- Claude Code 스킬 frontmatter의 모델 지정
- HyperFrames 전역 플러그인: `claude plugin list --json`의 버전 필드, 마켓플레이스 체크아웃 경로, 자동 업데이트 설정
- 화면 안전 영역(YouTube·Instagram UI가 덮는 위·아래 높이). 테마 상수로 두고 S1에서 실제 앱 화면으로 정한다

## 13. GPT 리뷰 반영

### 1차 리뷰 (r1 → r2)

[리뷰 원문](2026-10-04-implementation-design-review.md)을 읽고 항목마다 설계를 다시 대조했다. 10개 모두 실제 결함이라 채택했고, G1과 G2는 리뷰 수정안과 다른 방법으로 고쳤다.

| 항목 | 판단 | 반영 위치·차이 |
|---|---|---|
| G1 구절 ID 재사용 | 수정 채택 | §4.4. 리뷰는 scenes.json에 참조 구절 해시를 따로 적자고 했다. Claude가 써야 할 필드가 늘어나므로 대신 구절 ID 자체에 문구 해시를 넣었다. 문구가 바뀌면 ID가 사라져 같은 결과를 얻는다 |
| G2 누락·반복 통과 | 수정 채택 | §7.2 6번, §7.3, §4.4. `internal-gap`·`inserted-speech`·`repeat-risk` 검출과 기준값을 정했다. 복수 대응을 완전히 판별하는 대신 반복 위험 구절을 사람 확인으로 돌린다. `ok`와 사람 검수 완료를 구분해 manifest에 개수를 남긴다 |
| G3 옛 음성으로 build | 채택 | §8 `build` 사전 확인 |
| G4 승인·재개 범위 | 채택 | §4.7 `renderDepsSha256`, §8 `final` 세 조건과 재호출 시 무변경, `resume`의 `inputHash` 비교 |
| G5 S0 모션 기준 누락 | 채택 | §4.5 모션 계약을 S0에 포함하고 가짜 registry로 시험, §11 S0 표 |
| G6 자막 반올림 | 채택 | §4.6 자막은 `ceil` 양끝, gap 보정은 ms 단계에서 |
| G7 크로스페이드 자식 타임라인 | 채택 | §4.6 명목·clip 구간 식, `leadIn`·`leadOut` 동안의 상태, `$timing` 필드. §9 검사 frame 목록 |
| G8 정렬 캐시 버전 | 채택 | §7.4 `algorithmVersion`, 자동 결과와 사람 수정의 분리 |
| G9 timeout 재호출·비용 | 채택 | §6 `unknown` 상태와 `--ack-unknown`. 비용 예약은 G9와 축소안을 함께 반영해 유료 사용 승인 때로 미뤘다(D8) |
| G10 숫자·긴 어절 | 채택 | §4.2, §7.1 숫자 내부 구두점 보호, 나눌 수 없는 초과 입력 거부, §7.2 정수 ms |
| 축소: 유료 분기 | 채택 | D8, §6 |
| 축소: Codex 대체 정렬기 | 채택 | §11 위임 |
| 축소: `scripts/lib/` | 채택 | §3 |
| 축소: 결정론 방식 하나 | 채택 | §9 |
| D2·D6·D9 수정 의견 | 채택 | 위 G1, D6 설치 고정·S0 시험, G4 |

리뷰는 Codex CLI 0.160.0(ChatGPT 앱 번들)을 읽기 전용 sandbox, 모델 gpt-6-astra(추론 medium)로 실행했다. Mac에 별도로 설치된 Codex CLI 0.144.5는 설정된 모델을 지원하지 않아 실행되지 않았다.

r3에서 TTS와 정렬 방식을 바꾸면서 이 표의 G2(정렬 검출), G8(정렬 캐시), G9(비용), D6, D8 관련 내용을 다시 썼다. G2의 검출은 LCS 기준 `internal-gap`·`inserted-speech`에서 Forced Alignment 기준 `high-loss`·`long-gap`으로 바뀌었고 `repeat-risk`는 남았다. G9의 timeout 차단은 그대로이고, 비용 상한은 플랜 크레딧과 원장 글자 수 검사로 바뀌었다.

### TTS 교체 (r2 → r3)

사용자가 TTS를 ElevenLabs Eleven v4로 정했다. 바뀐 곳은 §1 외부 조건, D1·D6·D8, §3 설정·스크립트 설명, §4.1 `ttsLanguageCode`, §4.2 `voice`·`tag`, §4.4 `aligner`·`maxWordLoss`, §4.7 manifest, §6 전체, §7.2~7.4, §11 S0·S2 작업과 시험, §12, 출처다. r2 본문은 [archive/implementation-design-r2.md](archive/implementation-design-r2.md)에 남겼다.

### 2차 리뷰 (r3 → r4)

Codex CLI 0.160.0, gpt-6-astra(추론 high)로 실행했다. 7개 모두 채택했다. H3은 리뷰가 든 예시를 직접 계산해 4자 충돌을 재현했다.

| 항목 | 판단 | 반영 위치·차이 |
|---|---|---|
| H1 수동 음성이 build 통과 불가 | 채택 | §4.7 `voice.json`에 `spokenSha256`, provider별 검사 분기(§8). §6.5 `--timings` 수동 시각 경로, S1은 API 키 없이 이 경로 |
| H2 정렬 검출 시험 부족 | 채택 | §7.2 5번 간격 검사를 구절 안팎·양끝으로 확대. §7.3 다섯 경우 실제 시험, 판정을 `flagged` 여부로, 미검출 유형은 청취 확인 목록(§10). D6에 loss의 한계 명시 |
| H3 4자 해시 충돌 | 채택 | §4.4 8자로 늘리고 같은 편 안의 충돌은 오류. §7.4 수동 시각 이관에 문구·범위 대조. S2 시험 추가 |
| H4 Dialogue 요청 계약 | 채택 | §6.1 두 엔드포인트의 완전한 본문, 설정값 이름 변환, 기본값 생략 금지. 캐시 키를 실제 전송 본문으로(§6.2). 운영 중 자동 전환 삭제(축소안과 함께) |
| H5 글자·크레딧 단위 혼재 | 채택 | §6.4 상한을 크레딧 하나로, 정렬 비율 별도 필드, 비용표 제외 항목 명시 |
| H6 불명 상태가 timeout에만 한정 | 채택 | §6.3 전송 전 `started` 기록, 끝 줄 없는 시도는 unknown, TTS·정렬 공통 표, 정렬 실패 시 TTS 캐시 유지 |
| H7 소수 해시·원장 시험 | 채택 | §4 공통 규칙에 숫자 직렬화, S2 시험을 `kind`별 호출 수로 |
| 축소: 엔드포인트 자동 전환 | 채택 | §6.1 |
| 축소: whisper 대체 구현 | 채택 | D6, §7.2 (수동 timings로 끝내고 대안은 그때 결정) |
| 축소: 금액 정산 | 채택 | §6.4는 크레딧 상한·원장·불명 차단만 |

### 사용자 결정 (r4 → r5)

사용자가 ElevenLabs를 Free 플랜으로 시험 수준에서 진행하도록 지시했다. D8을 개발·시험은 Free, 게시용은 유료 전환 후로 고쳤다. Free 음성이 게시물에 섞이지 않도록 `planTier`를 `voice.json`과 TTS 캐시 키에 넣고, Free 음성 run은 `publishable: false`와 게시 불가 파일명으로 남긴다(§4.7, §6.2, §6.4, §8). §1 표, §11 S0 준비 항목, §12도 같이 고쳤다.

같은 날 사용자가 HyperFrames 스킬을 전역 플러그인으로 설치하고 저장소에서 버전을 관리하도록 정했다. `config/tools.lock.json`과 `scripts/env-check.mjs`를 추가하고 S0 작업에 설치·기록·대조·업데이트 절차를 넣었다(§1 표, §3, §11 S0, §12).

## 출처

- HyperFrames: [CLI](https://hyperframes.heygen.com/packages/cli.md), [HTML 스키마](https://hyperframes.heygen.com/reference/html-schema.md), [composition](https://hyperframes.heygen.com/concepts/compositions.md), [변수](https://hyperframes.heygen.com/concepts/variables.md), [결정론](https://hyperframes.heygen.com/concepts/determinism.md), [frame adapter](https://hyperframes.heygen.com/concepts/frame-adapters.md), [스킬](https://hyperframes.heygen.com/guides/skills.md), [플러그인](https://hyperframes.heygen.com/guides/plugins.md), [변경 기록](https://hyperframes.heygen.com/changelog.md), [registry item 스키마](https://raw.githubusercontent.com/heygen-com/hyperframes/main/packages/core/schemas/registry-item.json), [npm](https://registry.npmjs.org/hyperframes)
- ElevenLabs: [Eleven v4](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/eleven-v4), [모델·동시성](https://elevenlabs.io/docs/overview/models), [TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert), [Text to Dialogue API](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert), [타임스탬프 TTS](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps), [Forced Alignment API](https://elevenlabs.io/docs/api-reference/forced-alignment/create), [Forced Alignment 개요](https://elevenlabs.io/docs/overview/capabilities/forced-alignment), [모범 사례](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices), [오류](https://elevenlabs.io/docs/eleven-api/resources/errors), [가격](https://elevenlabs.io/pricing), [상업 이용](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform), [크레딧 소진](https://elevenlabs.io/docs/help-center/account/general/what-happens-when-i-run-out-of-credits)
- r2까지 쓴 Gemini·whisper.cpp 출처는 [r2 이력본](archive/implementation-design-r2.md)에 있다
- 줄바꿈: [BudouX](https://github.com/google/budoux), [Chrome CSS i18n](https://developer.chrome.com/blog/css-i18n-features)
