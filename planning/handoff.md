# Claude / Codex / Gemini 개발 인계

2026-10-04 정리. 현재 방향은 [기획 v2](2026-10-04-claude-code-render-plan-v2.md), 모션 초안은 [프리셋 설계](2026-10-04-motion-catalog-and-preset-tool.md)를 따른다. [리뷰](2026-10-04-plan-review.md)의 수정안은 채택 여부와 미해결 항목을 인계에 명시한다. 과거 v1 역할·지시문은 [archive/v1/agent-handoff-v1.md](archive/v1/agent-handoff-v1.md)에 보존했고 현재 실행 지시가 아니다. 공통 작업 규칙은 루트 `AGENTS.md`에 있다.

## 현재 역할과 작업 경계

개발에는 Claude의 설계·구현, Codex의 코드 리뷰·대체 구현, Gemini의 자료·언어 검토를 필요에 따라 활용한다. 매 작업의 주 담당자가 통합과 검증을 맡으며 특정 도구가 영구 code owner라는 과거 규칙은 적용하지 않는다. 운영 기본은 Claude 대화형 실행이며 매 영상의 다중 모델 릴레이를 요구하지 않는다.

인계는 모델 호출 권한을 추가하지 않는다. 다른 채팅에 메시지를 보내거나 에이전트를 위임하는 것은 해당 작업의 별도 지시 범위를 따른다. 모델·추론 설정은 native 설정을 보존하며 문서의 모델 이름만으로 변경하지 않는다.

## 공통 인계 폼

| 필드 | 기록할 내용 |
|---|---|
| `goal` | 이번 단계의 구체적 결과 |
| `inputPaths` | 필요한 입력·샘플 경로 |
| `authoritativeDocs` | v2 및 이번 단계에 필요한 문서·절 |
| `allowedFiles` | 수정 가능한 파일과 담당자 |
| `constraints` | 범위·환경·이미 허용된 호출/예산·게시 경계 |
| `acceptanceCriteria` | 통과해야 할 검사와 결과 경로 |
| `currentCommit` | 인계 시 실제 HEAD. 미추적/변경 파일 목록도 함께 기록 |
| `unresolvedIssues` | 리뷰 항목 ID, 미확인 외부 조건, 결정 필요 사항 |
| `nextAction` | 바로 수행할 한 단계 |

결과에는 `changedFiles`, `checksRun`, `evidencePaths`, `remainingRisks`, `nextAction`을 남긴다. 동일 파일 동시 편집을 피하고 다른 에이전트의 설명 대신 실제 diff·결과로 통합한다. HEAD만으로 미추적 자료가 전달되었다고 가정하지 않는다.

## 다음 구현 요청의 시작점

v2(r2) §6·§10 → 모션 문서 §3 → 리뷰 §7 → [v1 계약 설명](../schemas/v1/README.md) 순서로 읽는다. 리뷰 R1~R7과 축소안은 r2에 반영됐다. 다음 작업은 v2 S0이며, `schemas/v2/scenes.schema.json`과 검증기부터 만든다. HyperFrames 첫 한국어 설명형 1편으로 시작하고 Remotion 동시 제품화·VM 큐는 초기 범위에 넣지 않는다. 모션은 S3에서 3~5개(M0)로 시작한다.

음성 파일 입력으로 렌더를 먼저 검증할 수 있다. 실제 TTS 연결은 기존 인증·승인된 예산 범위에서 진행하며 키 발급·추가 결제는 문서에 적혀 있다는 이유로 실행하지 않는다. 대본 변경과 화면만 변경을 구분해 캐시를 검증하고, 설치된 CLI 버전·폰트·최종 출력 검사를 기록한다. 구현 요청이 없는 이번 문서 정리에서 설치·렌더·유료 호출을 시작하지 않는다.
