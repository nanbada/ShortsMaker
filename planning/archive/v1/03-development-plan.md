# 개발계획

> 상태: v1 개발계획 이력. 현재 실행 순서는 [기획 v2](../../2026-10-04-claude-code-render-plan-v2.md)의 S0~S4이며 아래 M0~M4·Azure CLI는 과거 설계다. 다음 구현은 [현재 인계](../../handoff.md)와 [리뷰](../../2026-10-04-plan-review.md)를 함께 읽는다.

한 명의 구현 담당자가 순차 진행하는 약 8~12 개발일 추정. 기존 환경과 디자인 수정에 따라 변동. 실제 실행/비교 테스트는 아직 수행하지 않았다.

| 단계 | 기간 가정 | 작업 | 종료 산출물 |
|---|---|---|---|
| M0 | 1~2일 | 조직 라이선스 판정, 엔진 비교, TTS 음질 시험 | ADR 확정, benchmark.csv, voice 결정 |
| M1 | 1~2일 | TypeScript CLI, schema/Ajv2020, asset 검증, 상태/manifest | validate 명령과 negative cases |
| M2 | 2~3일 | 장면 5종, brand/motion/caption, 엔진 compiler | 30초 manual-audio 샘플 |
| M3 | 1~2일 | Azure 합성/정규화/cache, timing, SRT | TTS 및 manual 교체 시험 |
| M4 | 2~3일 | still/preview/final, QA report, 실패 재개 | 콘텐츠 3종·AT 완료·사용 문서 |

구조: content/<id>/{brief.md,script.md,video-spec.json,audio,assets}; src/{cli,spec,scenes,motion,captions,tts,render,qa}; schemas; tests/fixtures; out/<id>/<run-id>. 저장소는 git, 에셋 크기가 커지면 별도 보관. DB와 새로운 agent router는 도입하지 않는다.

CLI 목표 계약(아직 구현된 명령이 아님):
`shortsmaker validate <project>` → 구조/의미/에셋 검사
`shortsmaker tts <project> --provider azure --budget <amount>` → frozen audio/timing
`shortsmaker stills <project>` → 장면 및 전환 표본
`shortsmaker preview <project>` → 같은 fps·half scale, 음성 포함
`shortsmaker render <project>` → 검수한 입력 hash와 final export
`shortsmaker resume <project> --run <id>` → 첫 미완료 단계 재개

렌더 경계는 작은 함수 3개: compile(spec,assets), renderStills(job,frames), renderVideo(job,profile). plugin 프레임워크는 만들지 않는다. renderer 교체 필요가 생겼을 때 compiler를 추가한다. preview는 fps를 바꾸지 않아 자막 타이밍을 보존한다.

상태: draft → audio_ready → spec_valid → stills_ready → qa_passed → preview_passed → rendered. 실패는 stage/error/retryability 기록. 각 단계 input hash가 동일할 때만 결과 재사용. QA 사람 승인도 hash에 묶음. 최종 manifest에는 spec/asset/audio hash, engine/package lock hash, Node/browser/OS, codec 설정, ffprobe 결과, 원가 추정과 QA 기록. 동일 입력이라고 이미 존재하는 최종 파일을 덮어쓰지 않고 run-id별 저장.

Cache key: 원문+발음 대본+provider/model/voice/settings+adapter version. 완료 음성을 저장하고 file hash 확인 후 재사용. 공급자 TTS를 다시 호출한 출력의 결정성은 보장하지 않는다.

개발 의존성: 지원 Node LTS, TypeScript, 선택 엔진, React(선택 엔진이 Remotion일 때), Ajv2020, 최소 CLI parser, ffprobe/FFmpeg. 정확한 버전은 M0 설치 시험 결과로 pin하고 lockfile commit. 같은 Remotion 패키지 버전을 맞춘다. 최신 버전 자동 갱신 금지. 취약점/호환 수정은 별도 PR에서 fixture 영상 검사.

시험은 schema/timeline/asset/timing 변환 등 실패가 비용/영상 오류를 만드는 로직에 집중한다. 모든 scene 구현과 똑같은 snapshot test를 만들지 않는다. 렌더 fixture 3개와 caption boundary ±1frame·transition boundary 검사. 랜덤 seed와 frame 계산만 애니메이션에 사용; Date.now, setTimeout 기반 시각 변화 금지. 엔진별 공식 가이드는 선택 후 읽고 적용.

V2는 실제 수요 이후: Google adapter, Playwright 수집, 음악. V3는 2.5D/Three scene과 생성형 video asset. V4는 작업량과 로컬 렌더 병목이 확인된 뒤 cloud/batch. 먼저 첫 3편으로 수동 제작시간과 비용을 측정한다.
