# ShortsMaker V1 PRD

> 상태: v1 요구사항 이력. 개인 수익화·ko/en 시작·Gemini TTS·Mac 대화형 운영은 [기획 v2](../../2026-10-04-claude-code-render-plan-v2.md)를 따른다. 아래 학원·Azure 기본·한국어 전용 요구는 대체되었다. 해시·에셋·시각 QA 원칙은 참고하되 v2 계약의 구현 완료를 뜻하지 않는다.

## 목적과 사용자
1인 제작자가 IT 뉴스, 상품 비교, 학원 설명 콘텐츠를 15~60초 세로 영상으로 반복 제작한다. V1 계약의 최대 길이는 90초. M3 Mac 로컬 CLI와 엔진 기본 미리보기로 운영한다. 여러 사용자 SaaS, 자동 게시, 계정 관리, DB, 결제, 별도 웹 편집기, 대량 클라우드 렌더, 3D, 생성형 영상, 완전 자동 리서치/캡처는 범위 밖이다.

성과 목표(가설): 템플릿 완성 후 30초 콘텐츠 1편의 준비된 대본/에셋 입력부터 최종 파일까지 수동 편집 20분 이하; 주제 3종을 동일 엔진으로 제작; 문구 수정이 renderer 코드 변경 없이 완료. 렌더 시간은 실측 후 예산을 정하며 지금 속도를 보장하지 않는다.

## 제작 흐름
brief/근거 → 확인한 대본 → 음성 생성 또는 파일 입력 → 음성 길이/타이밍 정규화 → VideoSpec 초안 → 로컬 에셋/권리 확인 → 구조·의미 검사 → 대표 still → 사람의 화면/발음 확인 → 저해상도 preview → final.mp4 + captions.srt + render-manifest.json. 렌더 이후 게시 여부는 사람이 결정한다.

| 요구 | 우선순위 | 완료 조건 |
|---|---|---|
| REQ-101 프로젝트 폴더 입력 | P0 | brief, script, spec, assets를 명시적 경로로 읽음 |
| REQ-102 VideoSpec 검사 | P0 | unknown field/type, 범위, 중복 ID, 미존재 asset, gap/overlap 거부 |
| REQ-103 기본 장면 | P0 | text/image/browser/comparison/cta 5종 지원 |
| REQ-104 한국어 폰트/자막 | P0 | 로컬 폰트, phrase caption 기본, 2줄 초과와 overflow 차단 |
| REQ-105 음성 파일 입력 | P0 | WAV/MP3를 읽고 실제 길이를 측정; TTS 없이 제작 가능 |
| REQ-106 TTS | P0 | Azure adapter 1개, 비용 상한/캐시/실패 로그; 수동 파일 대체 |
| REQ-107 타이밍 | P0 | ms 자막과 frame 장면 경계의 변환 규칙 고정 |
| REQ-108 QA/미리보기 | P0 | 각 장면 첫/중간/끝 및 전환 경계 still, 전체 timing preview |
| REQ-109 최종 출력 | P0 | 1080×1920·30fps H.264, yuv420p, AAC, SRT, manifest |
| REQ-110 재현/재시작 | P0 | frozen input·hash·버전 기록, 실패 stage 재개, TTS 중복 과금 방지 |
| REQ-111 대체 TTS | P1 | Google adapter를 계약대로 추가 가능; 초기에는 구현 안 함 |
| REQ-112 음악 | P1 | 최초 V1은 음성만; 후속 옵션에서 ducking과 loudness 검사 |

## 기능별 정책
safeArea 기본(top 180/right 180/bottom 340/left 80px)은 플랫폼 공식 보장값이 아닌 보수적 내부 preset이다. 기종/플랫폼 UI에 따라 검토하고 변경한다. 제목 64px, 자막 48px 시작값; 텍스트 축소 무한 반복보다 장면 분할. 실제 DOM bounding box로 safeArea 및 text overflow 검사. 스크린샷 내 원래 글자는 safeArea 검사와 별도로 읽기 크기 확인.

정확한 수치/인용은 brief 근거를 유지한다. 금융·학원 성과·가격 문구는 사람 검수. 캡처 개인정보는 사용자가 제공하기 전에 제거하거나 명시적 mask 절차를 거친다. 렌더에서는 네트워크에 의존하지 않으며 에셋은 로컬에 고정한다.

Final 렌더는 unknown rights, placeholder hash, 미해결 QA 오류, 음성 길이 불일치가 있으면 중단한다. 수정하면 content hash가 바뀌며 기존 QA 승인도 무효화한다. preview는 경고와 함께 draft 에셋을 허용할 수 있다.

## TTS 대안과 기본값
| 선택 | 역할 | 정렬/제약 |
|---|---|---|
| Azure Speech | V1 기본 합성 후보 | WordBoundary/SSML; 선택한 ko-KR voice의 이벤트를 실제 시험 |
| 수동 녹음/기존 음성 | 항상 가능한 운영 대체 | 수동 phrase timing 입력. 외부 서비스 중단에도 제작 가능 |
| Google Cloud TTS | P1 서비스 대체 | SSML mark는 mark 위치이지 자동 word timestamp가 아님; 지원 voice 확인 |
| ElevenLabs | 선택 품질 옵션 | 유료 상업 조건 확인; 공식 모델 문서는 v4를 Text to Dialogue API로 설명. 기존 TTS timestamp endpoint와 동일 지원이라 가정 금지 |
| Qwen3-TTS | V2 로컬 실험 | 공식 한국어 지원·Apache-2.0. M3 실행 속도/메모리/정렬은 미검증. V1 의존성으로 넣지 않음 |

음성 품질은 아직 청취 비교하지 않았다. 한국어 10문장(금액/날짜/약어/영한 혼용/학원명) 동일 대본으로 자연스러움·발음·반복 일관성·타임스탬프를 평가한 뒤 voice ID를 고정한다. 국내 서비스 추가는 이 시험을 통과한 경우만 고려한다.

TTS 표준 출력: narration.wav, durationMs, provider/model/voice/settings, 원문 및 발음용 텍스트, segments[{text,startMs,endMs,timingSource}], 비용/요청 ID. 화면 대본과 발음 대본을 분리하고 원문 character mapping을 보관. WordBoundary 시작 시각만 있으면 다음 시작 또는 음성 끝으로 종료를 추정하되 phrase 합성 후 검수. 이벤트가 없으면 문구 단위 수동 정렬로 내려가며 가짜 word timestamp를 생성하지 않는다. Korean word/어절 구분을 일괄 영문 공백 토큰으로 처리하지 않는다.

429/일시적 5xx에 지수 backoff 최대 3회; timeout은 중복 청구 가능성을 로그에 표시. provider 자동 전환은 목소리가 바뀌므로 silent fallback 금지. 음성을 다시 만들면 duration/caption/spec/QA를 재생성한다. API key는 환경변수, 산출물/로그에 비밀 제외.

비용 모델: 월 비용 = 엔진 license + 합성 문자/분 과금 + alignment + agent/API 사용 + 렌더 compute + media license. 구독 Claude/Gemini/Codex와 별도 TTS API 과금을 구분한다. 고정 요금표를 코드에 박지 않고 운영 config에 price/date를 기록. 기본은 유료 합성 비활성, 사용자 설정 budget 이후 실행. free tier를 상업용 지속 가능성의 근거로 삼지 않는다.

## 인수 기준
AT-01 구조 정상 예시 통과, 알 수 없는 필드 거부. AT-02 누락/중복/잘못된 해시 에셋 차단. AT-03 1frame gap 및 예기치 않은 overlap 거부. AT-04 음성 ±1frame 초과 길이 차이 차단. AT-05 자막 구간 역전/중복/범위 밖 거부. AT-06 한국어 긴 제목 overflow 검출. AT-07 재렌더에서 TTS 호출 0회. AT-08 랜덤 순서 frame 렌더와 순차 렌더의 동일 프레임 육안/픽셀 비교. AT-09 final ffprobe 규격 확인. AT-10 TTS 실패 후 manual 파일로 완료. AT-11 3개 콘텐츠 샘플 최종 검수. AT-12 라이선스 판정 기록 완료.

음성/자막 대표 구간 10곳을 청취해 150ms 이하 동기 목표 확인. 음성 loudness -16 LUFS, true peak ≤-1dBTP는 내부 목표; 플랫폼 요구로 단정하지 않는다. 비트 단위 MP4 일치는 보장하지 않으며 고정 환경에서 프레임 내용 재현성을 검증한다.
