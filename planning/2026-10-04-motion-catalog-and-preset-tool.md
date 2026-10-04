# 모션 효과 카탈로그와 프리셋 도구 설계

기준일 2026-10-04 (Asia/Seoul). [기획 v2](2026-10-04-claude-code-render-plan-v2.md) §6 "운영 단계에서 AI는 데이터만 만든다"를 모션 효과에 적용한 문서다. 사용자가 정리한 AI 모션 효과 50개(부록 A)를 HyperFrames 카탈로그와 대조하고, 영상마다 모션 코드를 새로 짜지 않도록 프리셋 도구를 설계한다. Codex·Claude에 모션 작업을 넘길 때 이 문서를 기준으로 쓴다.

개정 r2(같은 날): [GPT 리뷰](2026-10-04-plan-review.md)의 R1·R2(모션 부분)·R7과 M0 축소안을 반영했다. Block·Component 조립 경로, 프레임 단위 길이, 검증 상태 기록 방식, 단계표, 인계 폼이 바뀌었다.

## 1. 권고

모션 효과를 직접 구현하는 일부터 시작하지 않는다. HyperFrames 카탈로그에 항목 387개(컴포넌트 222, 블록 165)가 있고, 50개 중 43개는 대응 후보가 있다. 이름·동작이 같은 항목, 비슷한 항목, 여러 항목을 조합해야 하는 경우가 섞여 있어 43개를 그대로 '지원'으로 세지는 않는다. 개별 효과를 재현해 확인한 수치도 아니다.

카탈로그 항목은 정지된 GSAP 타임라인, 시드 고정 난수, 임의 프레임 seek를 등록 조건으로 요구한다. 등록 조건을 지켰다는 것이 M3 Mac·한글 폰트·우리 조합에서 같은 프레임이 나온다는 증거는 아니다. 공식 결정론 문서도 환경별 폰트·브라우저 차이를 설명하므로, 쓸 항목은 우리 환경에서 seek 시험을 거친다.

만들 것은 얇은 연결 도구다. 쓸 항목을 `hyperframes add`로 저장소에 고정해 두고, 우리 쪽 효과 ID(`text-scramble`)와 카탈로그 항목(`scramble-reveal`)과 허용 파라미터를 묶은 레지스트리를 둔다. Claude는 `scenes.json`에 효과 ID와 파라미터만 적고, 조립 스크립트가 HTML을 만든다. 영상마다 GSAP 코드를 생성하지 않으므로 모션 때문에 늘어나는 토큰은 장면당 JSON 몇 줄로 고정된다.

카탈로그에 없는 효과(Page Turn, Pulse Rings, Drag and Drop 등)는 해당 포맷을 실제로 만들 때 같은 계약으로 직접 구현한다.

## 2. 50개 효과 대조표

등급은 숏폼 포맷(v2 §4) 기준이다. **A**는 P0 정보·설명형에 바로 쓸 효과, **B**는 P1 광고·UI 데모에서 쓸 효과, **C**는 특정 연출에만 드물게 쓰는 효과, **이징**은 단독 효과가 아니라 다른 효과에 붙는 움직임 곡선, **보류**는 당분간 만들지 않을 효과다. HyperFrames 항목명은 `npx hyperframes add <이름>`에 그대로 넣는 이름이다.

| # | 명칭 (검색어) | 보조 검색어 | HyperFrames 대응 | 쓰임 | 등급 |
|---|---|---|---|---|---|
| 1 | Text Scramble | GSAP ScrambleText, decode text effect | `scramble-reveal`, `matrix-decode`, `caption-matrix-decode` | 훅 문장, 키워드 공개 | A |
| 2 | Typewriter Effect | typing animation | `typewriter`, `typed-prompt`, `notes-typing` | 프롬프트·검색창 장면 | A |
| 3 | Split Text Animation | GSAP SplitText | `bottom-up-letters`, `top-down-letters`, `per-word-rise` | 제목 등장 | A |
| 4 | Kinetic Typography | kinetic type | `kinetic-center-build`, `headline-slam`, `caption-kinetic-slam` | 첫 3초 훅 | A |
| 5 | Character-by-Character Reveal | text reveal animation | `tracking-in`, `soft-blur-in`, `focus-blur-resolve` | 차분한 제목 (3번과 겹침) | A |
| 6 | Text Morph | gooey text morph | `morph-text`, `text-match-cut`, `kinetic-type-swap` | 단어 교체·비교 | A |
| 7 | Odometer / Rolling Numbers | number ticker, slot machine, split-flap | `number-wheel`, `slot-machine-roll`, `split-flap-board` | 수치 강조 | A |
| 8 | Count Up Animation | animated counter, countUp.js | `count-up`, `mk-progress-stat`, `number-pop-in`, `apple-money-count` | 수치 강조 | A |
| 9 | Glitch Text | RGB split, chromatic aberration | `rgb-glitch-text`, `caption-glitch-rgb`, `glitch`(셰이더 전환) | 반전·경고 | B |
| 10 | Mask Reveal | clip-path reveal, track matte(AE) | `svg-mask-reveal`, `lt-mask-reveal`, `iris-reveal` | 이미지 공개 | A |
| 11 | Wipe Reveal / Wipe Transition | clip-path wipe | `directional-wipe`, `caption-clip-wipe`, `before-after-wipe`, `comparison-split` | 전후 비교 | A |
| 12 | Scanline Reveal | light sweep reveal, slit-scan | `scan-band`, `slit-scan-reveal`, `camera-scan-gate` | 결과 공개 | C |
| 13 | Staggered Animation | GSAP stagger | `stagger-cascade`, `staggered-fade-up`, `text-stagger`, `grid-card-assemble` | 목록·카드 | A |
| 14 | Shared Element Transition | FLIP animation, GSAP Flip, View Transitions API | `modal-morph`, `card-resize` | UI 데모 | B |
| 15 | Shape Morphing | GSAP MorphSVG | `morph-swap`, `icon-morph-beat`, `facet-morph` | 아이콘 상태 전환 | B |
| 16 | Liquid Morph | gooey effect, metaball | `ink-bleed-reveal`, `morph-text`, `vfx-liquid-background` | 무드 전환 | C |
| 17 | Animated Blob | blob animation SVG | `mk-background`, `soft-blob-touch`, `aurora-drift` | 배경 | B |
| 18 | Ripple Effect | material ripple | `press-ripple`, `ripple-waves`(셰이더 전환) | 탭 강조 | B |
| 19 | Pulse / Pulse Rings | pulse animation CSS | 전용 항목 없음 (`logo-sting`의 링 1개, `yt-circle-pointer`의 펄스) | 위치 강조 | B, 직접 구현 |
| 20 | SVG Line Drawing | GSAP DrawSVG, stroke-dashoffset | `svg-stroke-trace`, `outline-draw`, `marker-highlight`, `hw-underline` | 강조선·도식 | A |
| 21 | Motion Path | GSAP MotionPath | `arc-motion-path`, `offset-path-traveler`, `tracing-beam` | 흐름 설명 | A |
| 22 | Particle Dissolve | Thanos snap effect, disintegration | `particle-text-dissolve`(dissolve 방향), `code-shader-dissolve`, `domain-warp-dissolve` | 사라짐 연출 | C |
| 23 | Particle Assemble | particles forming text/logo | `particle-text-dissolve`(assemble 방향), `particle-image-reveal`, `glass-shard-title` | 로고·결론 | C |
| 24 | Pixel Dissolve | pixelate transition | `grid-pixelate-wipe`, `halftone-dissolve`, `ordered-dither-pass` | 장면 전환 | B |
| 25 | Motion Blur | — | `motion-blur`, `shutter-slam` | 빠른 이동에 덧붙임 | 이징 |
| 26 | Motion Trail / Echo | Echo effect(AE) | `echo-trail`, `cursor-glyph-trail` | 속도감 | C |
| 27 | Wiggle | wiggle expression(AE), GSAP CustomWiggle | `hw-boil`, `caption-neon-accent` | 손그림 생동감 | C |
| 28 | Shake Animation | shake animation CSS | `input-feedback`, `camera-shake`, `headline-slam` | 오류·임팩트 | B |
| 29 | Bounce Animation | bounce easing, GSAP CustomBounce | GSAP `bounce.out` 이징 | 착지 | 이징 |
| 30 | Spring Animation | spring physics | `spring-pop`, `sheet-spring-up`, `spring-stack-shuffle` | 배지·카드 등장 | A |
| 31 | Elastic Animation | elastic easing, squash and stretch | `badge-pop`, `rubber-band-bumper`, GSAP `elastic.out` | 버튼 | 이징 |
| 32 | Page Turn | CC Page Turn(AE) | 없음 | 자료 넘김 | C, 직접 구현 |
| 33 | Page Peel | page curl | 없음 | 스티커 | 보류 |
| 34 | Card Flip | 3D card flip CSS | `transitions-3d`(3D Card Flip 1종) | 퀴즈 정답 공개 | A |
| 35 | 3D Flip Transition | cube transition | `transitions-3d` | 장면 전환 | B |
| 36 | Whip Pan / Swish Pan | swish pan transition | `whip-pan`(셰이더), `whip-pan-cut` | 장면 전환 | A |
| 37 | Zoom Blur Transition | zoom transition | `cinematic-zoom`(셰이더), `zoom-through-transition`, `transitions-scale` | 장면 전환 | A |
| 38 | Spin Transition | spin transition | 없음 (`swirl-vortex`로 대체 가능) | 장면 전환 | C |
| 39 | Parallax Animation | 2.5D parallax | `parallax-zoom`, `camera-rig-depth-stack`, `push-in`, `caption-parallax-layers` | 일러스트 2.5D (v2 사례 2) | A |
| 40 | Magnetic Button / Cursor | magnetic hover effect | `vfx-magnetic` | UI 데모 | 보류 |
| 41 | Drag and Drop Animation | — | 없음 (`simulated-cursor` + `spring-stack-shuffle` 조합) | UI 데모 | B, 직접 구현 |
| 42 | Toast / Snackbar | — | `notification-pileup`, `liquid-glass-notification`, `micro-transitions` | 알림 연출 | B |
| 43 | Progress Indicator / Bar | — | `mk-progress-stat`, `conic-progress-ring`, `mk-usage-arc` | 수치·단계 | A |
| 44 | Loading Spinner | activity indicator | `svg-line-draw-loader`, `success-check` | 대기 → 완료 | B |
| 45 | Skeleton Loading | skeleton screen | `skeleton-reveal`, `scroll-feed` | UI 데모 | B |
| 46 | Shimmer Effect | shimmer CSS | `shimmer-sweep`, `text-shimmer` | 강조 | A |
| 47 | Accordion Expand / Collapse | — | `panel-reveal` | UI 데모 | B |
| 48 | Marquee / Infinite Marquee | ticker | `perspective-marquee`, `news-ticker` | 배경 띠 | B |
| 49 | Seamless Loop | perfect loop | 효과가 아니라 조건 (`drift-hold`, `aurora-drift`가 루프 정확) | 쇼츠 반복 재생 | 조립 규칙 |
| 50 | Vortex / Swirl Transition | swirl transition | `swirl-vortex`(셰이더) | 장면 전환 | C |

자막은 이 표와 별개다. 카탈로그 Captions 분류에 단어 하이라이트·카라오케·팝 등 17종이 있고, 자막 스타일은 v2 §5 정렬 파이프라인과 함께 정한다.

### 검색어 보정

목록의 명칭 대부분은 그대로 검색해도 튜토리얼이 나온다. 아래는 검색 결과가 엇나가거나 더 잘 나오는 이름이 있는 경우다.

- **Scanline Reveal**: 검색하면 CRT 화면의 줄무늬 오버레이가 주로 나온다. 빛줄기가 지나가며 공개되는 연출은 "light sweep reveal", 행마다 시간차를 두는 연출은 "slit-scan"으로 찾는다.
- **Liquid Morph, Text Morph**: 웹 구현 자료는 "gooey effect"(SVG 블러 + 임계값 필터)로 찾아야 많다.
- **Particle Dissolve**: "Thanos snap effect"로 찾으면 예제가 많다.
- **Shared Element Transition**: 안드로이드 용어다. 웹·GSAP에서는 "FLIP animation", "GSAP Flip plugin", "View Transitions API"가 같은 기법이다.
- **Odometer**: 숫자 단위로 굴러가는 형태는 "number ticker", "slot machine", 공항 안내판 형태는 "split-flap"이다.
- **Page Peel**: "page curl"이 더 많이 쓰인다.
- **Wiggle, Echo**: After Effects 표현식·이펙트 이름이다. GSAP에서는 CustomWiggle 플러그인이 대응한다.
- **Bounce, Elastic, Spring**: GSAP에서는 별도 효과가 아니라 이징(`bounce.out`, `elastic.out`)이다. CustomBounce 플러그인도 있다.

HyperFrames 안에서는 `npx hyperframes catalog --query "문장"`이 기기 내 모델로 의미 검색을 하므로, 영어 명칭이 확실하지 않을 때 동작을 문장으로 적어 찾는다.

GSAP는 2025년 4월 3.13부터 SplitText, MorphSVG, ScrambleText, DrawSVG 등 기존 유료 플러그인을 상업 이용 포함 무료로 풀었다. 직접 구현할 때 이 플러그인을 써도 비용이 들지 않는다.

## 3. 프리셋 도구 설계

### 해결할 문제

모션을 붙일 때마다 Claude가 GSAP 코드를 새로 쓰면 영상마다 토큰이 들고, 같은 효과도 매번 조금씩 다르게 구현되며, seek 규칙을 어긴 코드가 렌더 단계에서야 드러난다. 효과 구현은 한 번 검증해 고정하고, 운영 중에는 고르기만 하게 만든다.

### 구성

```
motion/
  registry.json        # 효과 ID → 구현 소스·파라미터·길이 범위
  vendor/              # hyperframes add 결과를 커밋해 고정
  local/               # 카탈로그에 없는 효과 (같은 계약으로 직접 구현)
  CATALOG.md           # registry.json에서 생성. /short 스킬이 읽는 유일한 모션 문서
scripts/
  motion_assemble.*    # scenes.json + registry → 컴포지션 HTML (LLM 호출 없음)
  motion_gallery.*     # 효과별 데모 렌더·스냅샷 (사람이 고를 때, 회귀 검사)
```

**registry.json 항목**은 다음 필드만 둔다.

```json
{
  "id": "text-scramble",
  "aliases": ["Scramble Text", "문자 해독"],
  "kind": "text-in",
  "source": {
    "type": "hf-component",
    "name": "scramble-reveal",
    "revision": "<설치 시 기록>",
    "sha256": "<vendor 파일 해시>",
    "wrapper": "motion/wrappers/text-scramble.html",
    "files": ["motion/vendor/scramble-reveal/"],
    "minCliVersion": "<원본 manifest 값>",
    "license": { "value": "<원본 manifest 값>", "evidence": "<manifest 경로 또는 URL>" },
    "native": { "width": null, "height": null, "durationFrames": null }
  },
  "params": {
    "text":   { "type": "string", "maxLength": 24 },
    "accent": { "type": "enum", "values": ["green", "blue", "violet"] }
  },
  "durationFrames": { "min": 18, "max": 60, "default": 36, "stretch": "timeline" },
  "verified": [
    { "lang": "en", "font": "Inter", "size": "1080x1920", "revision": "<동일>", "evidence": "out/gallery/text-scramble/en/" }
  ]
}
```

위 값은 형식 설명용이며 실제 시험 결과가 아니다.

`kind`는 `text-in`, `text-out`, `emphasis`, `number`, `element`, `transition`, `background` 중 하나다. `params`에는 카탈로그 항목이 받는 변수 중 실제로 바꿀 것만 넣는다. 예를 들어 `scramble-reveal`은 `text`, `accent`, `style`, `exit` 변수를 받는다.

`source.type`은 `hf-block`, `hf-component`, `hf-shader-transition`, `local` 넷 중 하나다. 공식 기여 문서에서 Block은 크기·길이가 정해진 독립 composition이고, Component는 다른 composition 안에 넣는 snippet이다. 그래서 Block은 `data-composition-src`로 마운트하는 adapter를, Component는 검증한 wrapper를 거쳐 쓴다. 셰이더 전환은 장면 경계에 붙는 별도 경로다. `native`에는 Block의 원본 크기·길이를 적는다. `revision`·`sha256`·`files`는 `hyperframes add` 결과를 고정한 근거이고, `license`는 원본 manifest의 선택 필드 값과 그 출처를 옮긴다. 값이 비어 있거나 외부 에셋(폰트·이미지)이 들어 있으면 권리를 따로 확인하기 전까지 쓰지 않는다.

`durationFrames`는 30fps 기준 정수다. `stretch`는 길이를 바꿀 때의 동작으로, `timeline`(타임라인을 늘림), `speed`(속도만 바꿈), `hold`(원래 길이로 재생하고 최종 상태 유지) 중 하나를 효과마다 정한다.

`verified`는 언어·폰트·해상도·효과 revision과 증거 경로를 한 묶음으로 기록한다. 목록에 없는 조합은 미검증이다. CATALOG.md는 그 언어에서 검증된 효과만 보여 주고, 검증기는 `scenes.json`의 언어와 효과 조합을 다시 검사해 미검증 조합을 렌더 전에 거부한다. 효과 revision이나 폰트가 바뀌면 해당 기록은 무효가 된다.

**scenes.json 확장**은 요소 단위 `motion`과 장면 경계 `transition` 두 가지다.

```json
{
  "type": "keyword",
  "text": "월 $0",
  "motion": {
    "in":  { "id": "text-scramble", "durationFrames": 36, "params": { "accent": "blue" } },
    "out": { "id": "blur-out-up", "durationFrames": 12 }
  },
  "transition": { "id": "crossfade", "durationFrames": 12 }
}
```

in·out은 각자 `params`와 길이를 가진다. 전환은 장면 경계를 가운데 두고 앞뒤 장면에 반씩 걸친다. 장면 시작 시각은 음성 타이밍에서 정해지므로 전환 때문에 바뀌지 않는다.

검증은 `schemas/v2/scenes.schema.json`([기획 v2](2026-10-04-claude-code-render-plan-v2.md) §6 데이터 계약)에서 `additionalProperties: false` 원칙으로 한다. 효과 ID는 레지스트리에서 생성한 enum, 파라미터는 그 효과의 `params`, 길이는 `durationFrames` 범위로 검사한다. 효과 `kind`가 자리와 맞는지(배경 효과를 `in`에 쓰지 않음), in·out 길이 합이 장면보다 짧은지, 전환 길이가 양쪽 장면의 절반보다 짧은지도 본다. 틀린 값은 렌더 전에 막힌다.

**조립 스크립트**는 `source.type`별 adapter를 고른다. Block은 `data-composition-src`로 vendor 파일을 가리키고 `data-variable-values`에 파라미터를 넣는다. Component는 wrapper에 넣고 요소 ID에 장면·슬롯별 접두어를 붙여, 같은 효과를 한 장면에서 두 번 써도 ID가 겹치지 않게 한다. 텍스트와 JSON 값은 HTML 속성·JSON 문맥에 맞게 직렬화해 따옴표·줄바꿈이 HTML을 깨지 않게 하고, 참조하는 파일 경로가 registry `files` 안에 있는지 확인한다.

**CATALOG.md**는 효과마다 ID, 한 줄 설명, 쓸 때, 파라미터만 적는다. 부록 A 같은 긴 설명은 넣지 않는다. 운영 중 Claude가 읽는 모션 정보는 이 파일 하나다.

**갤러리**는 효과마다 한국어·영어 예시 문장으로 2초 데모를 렌더하고 `hyperframes snapshot`으로 대표 프레임을 남긴다. 같은 환경에서 순차·역순·무작위 순서로 seek한 프레임을 비교하고, 장면 경계 전후 프레임을 포함한다. 효과를 고를 때 보는 자료이고, HyperFrames나 폰트를 바꿨을 때 결과가 달라졌는지 확인하는 회귀 검사이며, `verified` 기록의 증거다.

### 직접 구현 계약

`motion/local/`의 효과는 카탈로그 등록 조건을 그대로 따른다. 정지된 GSAP 타임라인을 `window.__timelines`에 등록하고, `data-composition-id`와 타임라인 ID를 맞추고, 요소 ID에 접두어를 붙인다. `Date.now()`, 시드 없는 `Math.random()`, `requestAnimationFrame` 같은 실시간 루프를 쓰지 않고, 어떤 프레임으로 seek해도 같은 결과가 나와야 한다. 이 조건을 지키면 나중에 카탈로그에 기여할 수도 있다.

### 한국어에서 확인할 것

카탈로그 항목은 영어 기준으로 만들어졌을 가능성이 높아 첫 단계에서 한국어로 직접 렌더해 본다.

- `scramble-reveal`은 고정 글리프 행을 순환한다. 글리프가 라틴 문자뿐이면 한글 문장이 확정되기 전 단계에서 영문 기호가 섞여 보인다. 한글 음절 풀을 쓰는 변형이 필요한지 본다.
- 글자 단위 분리 효과(`bottom-up-letters` 등)가 한글 음절 단위로 끊기는지, `word-break: keep-all`과 충돌하지 않는지 본다.
- `variable-axis-type`, `weight-wave`처럼 가변 폰트 축을 쓰는 효과는 한국어 가변 폰트가 있어야 한다.
- 폰트는 프레임 0 이전에 로드가 끝나야 한다. Noto Sans KR 로드 방식을 조립 스크립트에서 고정한다.

### 단계

| 단계 | 시점 | 할 일 | 완료 기준 |
|---|---|---|---|
| M0 | v2 S3와 함께 | 첫 편에 쓰는 효과 3~5개 설치(Block·Component 각 1개 이상), registry.json, adapter·wrapper, 검증기, CATALOG.md 생성, ko·en 갤러리, `/short` 연결 | Block·Component를 같은 장면에서 2회씩 써도 ID 충돌·변수 누락 없음. 9:16 배치와 로컬 의존 파일 확인. 순차·역순·무작위 seek 동일 프레임. 미검증 언어 조합을 렌더 전에 거부. 효과 ID만 바꿔 재렌더할 때 Claude가 HTML·JS를 생성하지 않음 |
| M1 | M0 통과 후 필요 시 | 아래 등급 A 후보로 확대 | 추가 효과마다 M0 기준 통과 |
| M2 | P1 광고 포맷 착수 시 | 등급 B 설치·검증 | UI 데모 1편 완성 |
| M3 | 해당 포맷이 필요할 때 | Pulse Rings, Drag and Drop, Page Turn 직접 구현. 셰이더 전환은 채택할 때 별도 시험 | 임의 프레임 seek 결과 일치, `hyperframes check` 통과 |

등급 A 확대 후보 15개는 `scramble-reveal`, `typewriter`, `per-word-rise`, `headline-slam`, `morph-text`, `number-wheel`, `count-up`, `svg-mask-reveal`, `directional-wipe`, `stagger-cascade`, `marker-highlight`, `spring-pop`, `shimmer-sweep`, `whip-pan`, `cinematic-zoom`이다. 정보형 숏폼의 훅·키워드·수치·목록·전환을 한 벌씩 덮는다. M0의 3~5개는 첫 편 대본이 정해진 뒤 이 중에서 고르고, 셰이더 전환인 `whip-pan`·`cinematic-zoom`은 M3 시험 전까지 쓰지 않는다.

S1에서 HyperFrames 대신 Remotion으로 돌아가면 이 설계는 카탈로그 대응 열이 무효가 되고, 레지스트리·스키마·조립 구조만 남는다. 그 경우 구현 소스를 Remotion 컴포넌트로 바꾼다.

## 4. 인계 폼

[04-agent-handoff](handoff.md) 양식을 따른다.

- **goal**: M0. 첫 편에 쓰는 효과 3~5개를 설치하고 registry·adapter·검증기를 만든 뒤, 한국어·영어 갤러리로 효과별 `verified` 기록을 남긴다.
- **inputPaths**: 이 문서 §2·§3, 기획 v2 §6 데이터 계약, `schemas/v2/scenes.schema.json`
- **authoritativeDocs**: `planning/2026-10-04-claude-code-render-plan-v2.md`, 이 문서
- **allowedFiles**: `motion/**`, `scripts/motion_*.*`, `schemas/v2/scenes.schema.json`의 모션 부분, `out/gallery/**`
- **constraints**: 카탈로그 원본 파일 수정 금지(변형이 필요하면 `motion/local/`에 복사본). 새 효과를 임의로 추가하지 않음. 렌더는 Mac 로컬.
- **acceptanceCriteria**: §3 단계표 M0 완료 기준 전부. 효과마다 ko·en 데모 MP4·스냅샷, `hyperframes check` 통과, `verified` 기록과 문제 프레임 경로가 담긴 결과표
- **currentCommit**: `647746e` 기준이지만 이 문서와 리뷰 문서를 포함한 다수 파일이 미추적 상태다. 인계 전에 커밋하거나 실제 HEAD와 `git status` 결과를 함께 넘긴다.
- **unresolvedIssues**: `hyperframes add` 버전 지정 방법(그 전까지 vendor 커밋과 revision·해시 기록으로 고정), 설치 항목별 license 값과 외부 에셋 권리, 셰이더 전환의 Mac 렌더 시간
- **nextAction**: 결과표를 보고 M1 레지스트리 초안 작성

## 5. AI 영상 프롬프트 공식과의 관계

부록 B의 공식([초기 상태] → [움직임] → [변화] → [최종 상태] → [시간])은 생성형 영상이나 원샷 프롬프트용이다. 프리셋 방식에서는 같은 정보가 구조화된 값으로 바뀐다. 초기·최종 상태는 요소의 `text`와 장면 속성, 움직임·변화는 효과 ID와 `params`, 시간은 `duration`이다. 새 효과를 Claude에게 처음 구현시킬 때(M3)는 이 공식으로 동작을 설명한다.

## 6. 미확인 사항

- 효과별 한국어·일본어·중국어 렌더 품질 (M0에서 확인)
- `hyperframes add`의 버전 지정 방법. 확인 전까지는 vendor 파일을 커밋하는 방식으로 고정한다.
- 카탈로그 항목의 라이선스. 기여 문서는 선택 필드 `license`·`minCliVersion`·`registryDependencies`를 설명한다. 저장소 전체는 Apache-2.0이지만 개별 항목에 값이 채워져 있는지와 외부 에셋 권리는 설치할 때 항목별로 확인해 registry에 기록한다.
- 셰이더 전환(`whip-pan`, `cinematic-zoom`, `swirl-vortex`)의 M3 Pro 렌더 시간
- `transitions-push`, `transitions-radial` 등 쇼케이스 블록에 든 개별 전환 목록 (`transitions-3d`, `transitions-other`, `transitions-scale`만 확인)

## 출처

- [HyperFrames 저장소](https://github.com/heygen-com/hyperframes), [카탈로그 전체 목록](https://hyperframes.heygen.com/_llms/catalog.md), [카탈로그 검색](https://hyperframes.heygen.com/developers/catalog-search.md)
- [카탈로그 기여 조건(블록·컴포넌트 차이, 결정론 조건)](https://hyperframes.heygen.com/contributing/catalog.md), [결정론 렌더링](https://hyperframes.heygen.com/concepts/determinism.md), [변수](https://hyperframes.heygen.com/concepts/variables.md)
- [scramble-reveal](https://hyperframes.heygen.com/catalog/components/scramble-reveal.md), [transitions-3d](https://hyperframes.heygen.com/catalog/blocks/transitions-3d.md), [transitions-other](https://hyperframes.heygen.com/catalog/blocks/transitions-other.md), [transitions-scale](https://hyperframes.heygen.com/catalog/blocks/transitions-scale.md)
- [GSAP 3.13 무료화 공지](https://gsap.com/blog/3-13/), [Webflow 공지](https://webflow.com/updates/gsap-becomes-free)
- 검색어 확인: [gooey text morph 튜토리얼](https://blog.olivierlarose.com/tutorials/text-gooey), [CSS gooey 예제 모음](https://freefrontend.com/css-gooey/), [scanline 검색 결과 예(CRT 오버레이)](https://codepen.io/ynef/pen/yvvyGv)

---

## 부록 A. 원본 목록 (사용자 정리)

모션디자인은 툴·업계마다 같은 효과를 다르게 부르는 경우가 있어, 일부 명칭은 표준화된 고유명사가 아니라 실무·튜토리얼에서 통용되는 검색어 기준이다.

1. Text Scramble / Scramble Text — 랜덤 문자 → 최종 문장으로 해독. 무작위 기호가 빠르게 바뀌다가 하나씩 확정
2. Typewriter Effect — 글자가 한 글자씩 타이핑됨. 커서가 깜빡이며 문장이 순차 입력
3. Split Text Animation — 글자를 문자·단어·줄 단위로 분리해서 움직임. 각 글자가 분리되어 순차적으로 올라와 정렬
4. Kinetic Typography — 글자 자체의 움직임을 활용하는 모션 타이포. 핵심 단어가 확대·회전하며 위치 변경
5. Character-by-Character Reveal / Text Reveal — 글자가 하나씩 순차적으로 공개됨. 왼쪽부터 글자가 나타나 최종 문장 완성
6. Text Morph — 한 단어나 글자 형태가 다른 형태로 변형. 첫 단어가 자연스럽게 다른 단어로 변화
7. Rolling Numbers / Odometer Animation — 계기판처럼 숫자가 굴러감. 숫자가 빠르게 회전하다 12,480에서 정지
8. Count Up Animation — 숫자가 목표값까지 증가. 0에서 100까지 빠르게 올라간 뒤 정지
9. Glitch Text — 문자가 깨지고 RGB가 어긋나는 효과. 순간적으로 깨졌다가 정상 상태로 복구
10. Mask Reveal — 특정 영역을 따라 숨겨진 내용 공개. 움직이는 도형 뒤로 이미지가 나타남
11. Wipe Reveal / Wipe Transition — 한 방향으로 쓸어내듯 화면 공개. 왼쪽에서 오른쪽으로 다음 장면 등장
12. Scanline Reveal / Scanner Reveal — 스캔선이 지나간 부분부터 내용 공개. 밝은 선이 위→아래로 이동하며 결과물 복원
13. Staggered Animation / Stagger — 여러 요소가 시간차를 두고 연속 움직임. 카드가 0.1초 간격으로 차례대로 등장
14. Shared Element Transition — 같은 요소가 두 화면 사이를 자연스럽게 이어줌. 작은 카드가 이동·확대되며 메인 카드가 됨
15. Morphing / Shape Morphing — 한 형태가 다른 형태로 자연스럽게 변형. 원이 늘어나며 직사각형 카드로 변경
16. Liquid Morph / Liquid Transition — 액체처럼 늘어나고 합쳐지며 형태 전환. 원형 버튼이 액체처럼 퍼져 전체 패널로 변함
17. Animated Blob / Blob Animation — 유기적인 덩어리가 계속 형태를 바꿈. 블롭이 호흡하듯 부드럽게 변형
18. Ripple Effect — 클릭 지점에서 원형 파동 확산. 버튼을 누르면 파동이 바깥으로 퍼짐
19. Pulse / Pulse Rings — 중심에서 원형 링이 반복적으로 확산. 여러 링이 순차적으로 퍼졌다 사라짐
20. SVG Line Drawing / Stroke Animation — 선이 그려지면서 로고·도형 완성. 빈 화면에서 선이 이동하며 윤곽을 그림
21. Path Animation / Motion Path — 지정된 경로를 따라 오브젝트 이동. 아이콘이 곡선 경로를 따라 목적지까지 이동
22. Particle Dissolve / Disintegration — 물체가 작은 입자로 분해돼 사라짐. 이미지가 가장자리부터 입자로 흩어짐
23. Particle Assemble / Particle Reveal — 흩어진 입자가 모여 물체 생성. 입자들이 중앙에 모여 하나의 로고 완성
24. Pixel Dissolve / Pixel Transition — 화면이 픽셀 단위로 분해되며 전환. 작은 픽셀로 쪼개지며 다음 화면 등장
25. Motion Blur — 빠른 움직임에 방향성 있는 흐림 추가. 카드 이동 방향으로 모션 블러 발생
26. Motion Trail / Echo Effect — 움직인 오브젝트 뒤에 여러 잔상이 남음. 빠르게 이동한 아이콘 뒤로 반투명 잔상 생성
27. Wiggle — 작고 불규칙하게 흔들리는 움직임. 중심 위치 주변에서 미세하게 흔들림
28. Shake Animation — 오브젝트를 빠르게 흔드는 애니메이션. 오류 순간 입력창이 좌우로 세 번 흔들림
29. Bounce Animation — 목표 위치에 도달한 뒤 튕기는 움직임. 요소가 떨어진 뒤 두 번 튕기며 정지
30. Spring Animation — 스프링 물리처럼 목표점을 지나쳤다가 복귀. 목표 위치를 살짝 지나친 뒤 탄성 있게 정지
31. Elastic Animation — 고무처럼 늘어나거나 찌그러졌다 원상복구. 버튼이 늘어난 뒤 원래 모양으로 돌아옴
32. Page Turn — 실제 종이를 넘기듯 페이지 전환. 오른쪽 모서리가 들리며 다음 페이지 등장
33. Page Peel — 페이지·스티커 모서리가 벗겨지는 듯한 효과. 화면 모서리가 말려 올라가며 아래 화면 공개
34. Card Flip — 카드를 뒤집어 앞·뒷면 전환. Y축으로 180도 회전해 뒷면 정보 표시
35. 3D Flip Transition — 화면이 3D 공간에서 뒤집히며 장면 전환. 현재 화면이 회전하며 다음 장면으로 변경
36. Whip Pan / Swish Pan — 카메라를 빠르게 휘두르며 장면 전환. 강한 모션 블러와 함께 옆 장면으로 이동
37. Zoom Blur Transition — 급격한 줌과 블러를 이용한 전환. 화면 중심으로 빠르게 확대되며 다음 장면 연결
38. Spin Transition — 화면이 회전하면서 장면 교체. 빠르게 회전한 뒤 다음 화면에서 정지
39. Parallax Animation — 전경과 배경이 서로 다른 속도로 이동. 앞쪽은 빠르게, 배경은 느리게 움직여 깊이감 생성
40. Magnetic Button / Magnetic Cursor — 커서와 UI 요소가 자석처럼 반응. 커서가 접근하자 버튼이 커서 방향으로 끌려옴
41. Drag and Drop Animation — 요소를 끌어서 다른 위치에 놓는 인터랙션. 카드를 폴더로 드래그해 놓자 내부로 이동
42. Toast / Snackbar Animation — 잠깐 나타났다 사라지는 상태 메시지. 하단 메시지가 올라와 2초 유지 후 사라짐
43. Progress Indicator / Progress Bar — 작업 진행 상태를 시각적으로 표시. 진행 막대가 0%에서 100%까지 차오름
44. Loading Spinner / Activity Indicator — 진행 중임을 나타내는 회전형 로딩 표시. 로딩 표시가 회전하다 완료 순간 사라짐
45. Skeleton Loading / Skeleton Screen — 콘텐츠가 들어올 자리를 임시 형태로 표시. 텍스트·이미지 영역에 회색 플레이스홀더 표시
46. Shimmer Effect — 플레이스홀더 등의 표면 위로 빛이 흐르는 효과. 밝은 빛띠가 왼쪽→오른쪽으로 반복 이동
47. Accordion Expand / Collapse — 접힌 UI 영역을 펼치거나 다시 접음. 항목을 누르면 아래 영역이 늘어나며 내용 공개
48. Marquee / Infinite Marquee — 텍스트·카드 등이 한 방향으로 계속 흐름. 오른쪽에서 왼쪽으로 이동하며 끝없이 반복
49. Seamless Loop / Perfect Loop — 마지막 장면과 첫 장면을 자연스럽게 연결. 시작과 끝이 이어져 끊김 없이 무한 반복
50. Vortex / Swirl Transition — 화면이 소용돌이치며 중심으로 빨려 들어가는 전환. 주변 UI가 회전하며 중앙으로 흡수된 뒤 다음 장면 등장

**특이한 효과 추천**: Text Scramble, Odometer Animation, Shared Element Transition, Liquid Morph, Particle Dissolve, Particle Assemble, Scanline Reveal, Magnetic Button, Motion Trail, Page Peel, Whip Pan, Vortex Transition, SVG Line Drawing, Staggered Animation, Shimmer Effect

**헷갈리는 이름 검색**: 자석처럼 반응 → Magnetic Button / Magnetic Cursor · 문자 해독 → Text Scramble · 입자로 사라짐 → Particle Dissolve / Disintegration · 입자로 조립 → Particle Assemble / Particle Reveal · 순차 등장 → Staggered Animation · 역방향 재생 → Reverse Animation · 액체 변형 → Liquid Morph / Liquid Transition · 잔상 → Motion Trail / Echo Effect · 파동 → Ripple Effect · 숫자 롤링 → Odometer Animation / Rolling Numbers

## 부록 B. AI 영상 프롬프트 공식 (사용자 정리)

[초기 상태] → [움직임] → [변화] → [최종 상태] → [시간]

예: "무작위 문자들이 빠르게 바뀐다. 2초 동안 글자가 하나씩 확정된다. 마지막에는 'AI MOTION'이라는 문장으로 완성된다."
