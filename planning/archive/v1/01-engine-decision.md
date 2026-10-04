# 엔진 선택 ADR-001

> 상태: v1 엔진 결정 이력. 현재 선택은 [기획 v2](../../2026-10-04-claude-code-render-plan-v2.md)의 HyperFrames 우선·Remotion 대안이다. 아래 비교 시험·Remotion 우선 조건은 과거 기준이며 현재 구현 지시로 사용하지 않는다.

상태: Remotion을 V1 기본 후보로 선택. 0단계 비교 검증 후 확정.

앞선 답변의 HyperFrames 제외 판단은 수정한다. HeyGen 공식 저장소에는 HTML 기반 제작, seek 가능한 animation adapter, agent skills, catalog, snapshot/lint/check/preview/render, AWS Lambda 경로, Apache-2.0 라이선스가 명시되어 있다. 단순 참고용 Grok 자료가 엔진 선택을 좌우하게 하지 않는다. 제공된 최초 GPT 조사 전문은 이번 자료에서 확인하지 못했으므로 초기 추천 이유를 임의로 복원하지 않았다. 현재 공식 자료와 프로젝트 요구로 재평가했다.

| 기준 | Remotion | HyperFrames | V1 판단 |
|---|---|---|---|
| 작성 단위 | React component, props | HTML, timing attributes, seekable adapter | 검증된 React 템플릿 재사용에 Remotion 적합 |
| AI 제작 지원 | 공식 agent skills | 공식 agent skills와 제작 workflow | 둘 다 가능. 구별 근거로 사용하지 않음 |
| QA/영상 출력 | still, preview, render API/CLI | snapshot, lint/check, preview/render | 둘 다 가능. 실제 시험 필요 |
| 배포 | 로컬/클라우드 경로 | 로컬/분산 경로 | V1은 로컬만 사용 |
| 라이선스 | 개인 및 조직 3인 이하 Free, 4인 이상 Company 조건 | 엔진 Apache-2.0 | 학원 법인 사용이면 조직 전체 규모부터 확인 |
| 유지보수 | React 생태계와 프레임 기반 컴포넌트 | HTML/GSAP 등 기존 자산 활용 | 사용자 프로젝트에 필요한 구조로 평가 |

추천은 요구 기반 설계 판단이며 렌더 속도나 디자인 품질의 실측 우위가 아니다. HTML 광고를 빠르게 만들고 기존 GSAP 자산을 활용하며 조직 규모에 따른 비용을 피하려면 HyperFrames가 더 유리할 수 있다. React 재사용, 타입 계약, 반복적인 정보형 쇼츠에 집중하면 Remotion이 자연스럽다.

Remotion 가격 페이지는 개인/3인 이하 조직의 상업 이용과 자동화를 허용하며 4인 이상 조직은 유료 대상으로 설명한다. 현재 Automators는 render당 $0.01, 월 $100 최소, Creators는 seat당 월 $25를 표시한다. 개발 참여자만 세어 무료라고 가정하지 말 것. 실제 이용 형태는 FAQ/Terms로 재확인. HyperFrames의 Apache 라이선스가 외부 음악/폰트/GSAP/미디어나 호스팅 비용까지 면제하지 않는다.

## 0단계 비교 시험: 최대 2 개발일
같은 30초 한국어 대본, 같은 로컬 WAV/PNG/폰트, 1080×1920·30fps, 제목/UI 확대/비교/CTA 4컷과 동일 phrase caption을 구현한다. 초기 구현 시간, 내용 수정 3회 시간, 설치 실패, 렌더 시간/최대 메모리, 문자 잘림/동기화/랜덤 seek 오류를 기록한다. M3 Mac에서 동일 조건·cold/warm 각 3회. 에셋과 설정 고정. 비교용 코드는 작은 독립 spike 폴더에만 둔다.

필수 통과: 오디오/자막 동기 오차 150ms 이하 목표, 임의 프레임 seek 정상, 폰트/에셋 로컬화, 영상 누락 없음, 내용 변경에 엔진 코드 수정 불필요. 미달 엔진은 탈락. 둘 다 통과하면 Remotion 기본. HyperFrames가 내용 수정 총시간을 30% 이상 줄이거나 Remotion 조직 라이선스 비용이 예산을 넘으면 HyperFrames로 변경한다. 30%는 내부 결정 기준이지 기존 벤치마크가 아니다. 둘 다 실패하면 신규 플랫폼 구축보다 편집기 기반 파일럿으로 요구를 축소한다.

V1에서 두 엔진을 동시에 제품화하지 않는다. VideoSpec은 엔진 중립이되 실제 compiler/renderer는 하나만 구현한다. 향후 전환은 새 compiler 추가로 해결하며 React/HTML 코드를 VideoSpec에 넣지 않는다.
