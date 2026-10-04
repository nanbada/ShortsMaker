# VideoSpec v1 계약

> 상태: 현재 파일로 존재하는 **v1.0.0 계약의 설명**. [기획 v2](../../planning/2026-10-04-claude-code-render-plan-v2.md)의 다국어·새 장면·모션 계약은 아직 미구현이다. v1을 v2 입력 검증기로 사용하지 않는다. 변경 범위와 호환성 검토는 [리뷰 §2](../../planning/2026-10-04-plan-review.md#2-구현-전-해결할-항목)를 참고한다.

JSON Schema 2020-12. VideoSpec은 renderer의 props/HTML이 아닌 엔진 중립 편집 계약이다. 스키마에 임의 코드, URL fetch, React fragment를 넣지 않는다. V1 format은 1080×1920·30fps 고정, 최대 2700 frames. engine/codec/concurrency는 runtime config에서 관리한다.

장면은 정수 startFrame/durationFrames, 자막과 음성 길이는 정수 ms. 장면 구간은 [startFrame, startFrame+durationFrames), 자막은 [startMs,endMs). frame→ms는 frame*1000/fps 실수 계산, captions 표시 판정은 해당 frame 시각이 구간 안인지 비교한다. ms→장면 frame은 round(ms*fps/1000)로 한 번만 변환한다. 이중 반올림 금지. 음성 duration 기반 전체 frames=ceil((durationMs+offsetFrame*1000/fps)*fps/1000).

장면 기본 순서는 배열 순서다. cut이면 다음 start=현재 end, duration=0. crossfade이면 다음 start=현재 end-transition duration. transition은 현재·다음 장면 길이보다 짧아야 하며 중첩은 해당 두 장면에만 허용. 마지막 transition은 cut/0. 첫 start=0, 마지막 end=전체 duration. 이 정책의 트리플 overlap은 거부한다.

caption은 V1에서는 순서대로 겹치지 않는 phrase가 기본. word는 실제 native/aligned timing이 있을 때만 사용한다. Korean 문자 인덱스 공급자별 단위 차이를 adapter에서 정규화한다. narration.offsetFrame 기준 자막 ms는 영상 시작 기준 절대 시간. scriptPath는 원래 대본이고 발음용 수정 기록은 TTS artifact에 보관한다.

JSON Schema만으로 해결하지 못하는 관계: 중복 ID, asset reference/type, 경로 realpath escape, 실제 sha256/권리/파일 존재, timestamp 크기 순서, timeline 연결/transition, 영상 duration 일치, DOM overflow/하이라이트 범위, 미디어 실제 길이는 별도 semantic/asset/visual validator에서 확인한다.

browser.highlight 좌표는 원본 스크린샷 px이며 렌더 transform으로 함께 이동한다. 스크린샷 원본 크기로 사각형 범위를 검사한다. image focus는 0~1 정규 좌표. 폰트 asset은 실제 loaded 이후 still을 생성한다.

schemaVersion은 1.0.0 정확히 지원. 다른 버전을 조용히 해석하지 않고 migration 요구. default 값은 compiler 내부 임의 추가보다 spec 생성 시 채워 frozen file로 저장. additionalProperties=false로 오타를 차단한다.

첨부 validate_spec.py는 이 스키마가 사용하는 키워드 구조와 주요 의미 관계를 외부 의존성 없이 검사한다. 실제 에셋/렌더 QA를 검증하지 않는다. 제품 구현에서는 Ajv2020 표준 검증+별도 의미 검사+asset 검사로 대체한다. example은 모든 종류를 완전히 시연하는 실제 영상이 아니라 입력 구조 예시다.
