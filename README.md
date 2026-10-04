# ShortsMaker

개인 수익화 채널용 숏폼을 코드로 렌더하는 프로젝트다. 지금은 설계 단계라 렌더러·TTS 연결·`/short` 스킬·모션 도구가 아직 없다.

방향은 HyperFrames 우선(Remotion 대안), Gemini TTS, Mac 로컬, Claude 대화형 운영이다. 한국어·영어로 시작해 일본어·중국어를 더한다. Muse VM·야간 무인 실행·자동 게시는 필요할 때 검토한다.

## 현재 문서

| 문서 | 용도 |
|---|---|
| [기획 v2](planning/2026-10-04-claude-code-render-plan-v2.md) | 제품 방향, 데이터 계약(§6), 단계 S0~S5(§10) |
| [모션 카탈로그·프리셋](planning/2026-10-04-motion-catalog-and-preset-tool.md) | 모션 레지스트리·조립 설계, M0~M3 |
| [리뷰](planning/2026-10-04-plan-review.md) | GPT 리뷰. 반영 결과는 §7 |
| [인계](planning/handoff.md) | 에이전트 간 인계 양식 |
| [작업 기록](planning/worklog.md) | 시점별 결정·변경·검증 |

에이전트 공통 규칙은 [AGENTS.md](AGENTS.md)에 있다. Codex는 이 파일을 직접 읽고, Claude Code는 [CLAUDE.md](CLAUDE.md), Gemini CLI는 [GEMINI.md](GEMINI.md)가 이 파일을 불러온다.

## 폴더

```
planning/            현재 기준 문서, 인계, 작업 기록
planning/archive/    v1(Remotion·Azure·한국어 전용)과 v2 이전(VM 우선) 이력
schemas/v1/          v1.0.0 예시 계약과 검사 코드 (보존)
```

이력 문서는 상단에 적용 상태를 표시해 두었고 실행 지시로 쓰지 않는다. 렌더 코드 폴더는 v2 S0부터 §6 구조로 만든다.

## v1 계약 검사

`schemas/v1/`은 v1.0.0 예시 계약이다. 언어가 `ko-KR`로 고정돼 있고 새 장면 유형과 객체형 모션을 지원하지 않는다. 예시 에셋과 0으로 채운 해시는 실제 미디어가 아니다. 설명은 [schemas/v1/README.md](schemas/v1/README.md)에 있다.

```sh
python3 schemas/v1/validate_spec.py schemas/v1/video-spec.example.json
python3 -m unittest discover -s schemas/v1 -p 'test_*.py'
```

이 검사는 구조와 일부 의미 관계만 본다. 실제 에셋·권리·음성 길이·렌더·다국어 품질은 검증하지 않는다.
