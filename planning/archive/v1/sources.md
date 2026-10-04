# 공식 근거와 확인 범위

> 상태: v1 조사 당시의 출처 기록. 현재 개인 채널 조건·엔진·TTS 선택을 결정하는 문서가 아니다. 최신 계획의 출처는 [기획 v2](../../2026-10-04-claude-code-render-plan-v2.md), 이번에 재확인한 근거는 [리뷰](../../2026-10-04-plan-review.md)에 있다. 아래 요금·지원 정보는 당시 기록이다.

2026-10-04 웹 원문 확인. 자료의 날짜는 실제 릴리스 지원 버전과 같지 않을 수 있으므로 구현 M0에서 설치 버전을 재확인한다.

- https://github.com/heygen-com/hyperframes — HTML/seekable animation, skills, QA/CLI, Apache-2.0, cloud 경로. 공식 제작사의 비교표는 이해관계가 있으므로 성능 우위 증거로 사용하지 않았다.
- https://www.remotion.dev/docs/parameterized-rendering — props 기반 재사용.
- https://www.remotion.dev/docs/ai/skills — agent 제작 지원.
- https://www.remotion.dev/docs/cli/still — 대표 프레임 출력. 여러 frame 명령은 설치 버전 도움말로 재확인, V1은 renderStill 호출 반복 사용 가능.
- https://www.remotion.dev/docs/license/pricing — 조직 규모와 무료/Company 조건 및 가격. 사용자 학원의 조직 전체 인원은 미확인.
- https://learn.microsoft.com/ko-kr/azure/ai-services/speech-service/how-to-speech-synthesis — SSML와 WordBoundary.
- https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support — ko-KR 지원. 실제 voice별 region/이벤트 검증 필요.
- https://docs.cloud.google.com/text-to-speech/docs/ssml — SSML marks/timepoints. 모든 voice의 모든 기능 지원을 뜻하지 않음.
- https://elevenlabs.io/docs/overview/models — v4 공식 문서 및 Text to Dialogue 경로. 특정 TTS timestamps endpoint와 v4의 호환은 본 설계에서 검증하지 않음.
- https://elevenlabs.io/pricing — 상업 license 유료 플랜 조건. 일시적 프로모션 가격으로 장기 비용 계산하지 않음.
- https://github.com/QwenLM/Qwen3-TTS — Korean, 모델 종류, Apache license. M3 성능 미측정.

제공된 Grok 자료는 아이디어 참고에만 사용. 비용 0원, 제작시간 보장, AE급 자동 품질 같은 주장은 채택하지 않았다. 최초 GPT 조사 원문이 이번 입력에 없으므로 그 결론을 그대로 인용하거나 근거를 복원하지 않았다. 공개 문서 기반 설계이며 엔진 benchmark·TTS 청취·실제 영상 렌더는 개발 단계의 미완료 작업이다.
