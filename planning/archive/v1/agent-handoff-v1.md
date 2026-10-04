## 과거 v1 인계 원문 — 참고 전용

아래는 변경 전 역할과 지시문을 보존한 기록이다. 현재 역할·엔진·TTS·범위를 정하는 근거로 사용하지 않는다.

# Codex / Claude / Gemini 역할 및 인계
역할은 운영 권고이며 특정 모델의 성능을 검증한 순위가 아니다. 현재 구독 도구를 사용하고 별도 router/서버를 추가하지 않는다. 모든 작업에 세 모델을 쓰지 않는다.

| 담당 | 주 역할 | 입력 → 출력 | 경계 |
|---|---|---|---|
| Codex | 구현 책임과 검증 | PRD/schema/ADR → 최소 코드 변경, 테스트, 렌더, 오류 수정 | 최종 code owner. 스펙/범위를 임의 변경하지 않음 |
| Claude | 시각 설계와 템플릿 개선 | brief/brand/stills → storyboard, motion 제안, scene 개선 patch | 승인된 scene 계약 유지. 전체 엔진 매번 재작성 금지 |
| Gemini | 출처 수집과 독립 내용 검토 | URL/대본 → claim-source 표, 날짜/수치/누락 검사 | 검증한 사실과 추론 분리. 검색 접근 불가면 명시 |
| 사람 | 목표/발음/사실/최종 영상 승인 | preview/QA/비용 → 수정 또는 승인 | 유료 호출 예산, 업로드/게시 결정 |

낮은 난도는 Codex 단독. 자료 근거가 필요한 뉴스는 Gemini 1회. 디자인이 막히거나 신규 template은 Claude 1회. 금액/규정처럼 오류 영향이 큰 대본은 독립 검토. 모델 명칭/가격/토큰 한도를 가정하지 않고 현재 이용 도구에서 확인한다. 자동 모델 간 동기화는 없으므로 markdown 인계와 git diff를 사용한다.

인계 폼: goal, inputPaths, authoritativeDocs, allowedFiles, constraints, acceptanceCriteria, currentCommit, unresolvedIssues, nextAction. 결과 폼: changedFiles, checksRun, evidencePaths, remainingRisks, nextAction. 동일 파일 동시 편집 금지. 코드 기여는 작은 branch/patch로 인계하고 Codex가 통합. 요구 변경은 ADR와 PRD 먼저 변경.

## Codex 시작 지시문
ShortsMaker V1을 구현하라. 먼저 README와 ADR/PRD/schema를 읽고 M0 엔진 비교를 수행하라. Remotion을 기본 후보로 두되 동일 입력 HyperFrames spike와 라이선스 판정을 기록한 후 확정하라. 테스트/시각 결과 없이 빠르다고 단정하지 말라. M1부터 작은 단계로 구현하고 각 milestone의 인수 조건을 완료하라. 예시 에셋과 0 해시를 실제 에셋이라고 취급하지 말라. 인증키/유료 API 예산이 없으면 manual audio로 핵심 렌더를 먼저 완성하라. DB, SaaS, 모델 router, 자동 게시, 3D를 넣지 말라. 최종적으로 3개 콘텐츠의 final.mp4/SRT/manifest와 인수 결과를 제공하라.

## Claude 디자인 지시문
PRD와 5종 scene 계약을 지키며 제공한 한국어 대본/brand/still의 가독성과 구도를 검토하라. 먼저 대표 frame의 overflow, 대비, safeArea, caption overlap을 표시하라. 신규 장면이 꼭 필요하지 않으면 기존 template/VideoSpec만 수정하라. patch는 지정한 scene 파일에 제한하고 요구나 schema 변경은 제안으로 분리하라. 이미지에 잘못된 글자/숫자를 그려 넣지 말라.

## Gemini 검토 지시문
제공한 대본의 검증 가능한 주장을 claim-source 표로 정리하라. 공식 원문을 확인하고 발표일/사건일/가격 데이터 날짜를 분리하라. 출처가 없으면 미확인으로 표시하고 문구 수정을 제안하라. 제품 UI/수치/비교 근거를 임의로 만들어 내지 말라. 엔진 변경이나 코드 작성 없이 검토 결과만 반환하라.
