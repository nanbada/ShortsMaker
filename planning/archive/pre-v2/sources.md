# 조사 근거·판단·확인 한계

> 상태: v2 이전 조사 근거 기록. 아래 “기본안”과 저장소·요금 정보는 당시 판단이다. 최신 선택은 [기획 v2](../../2026-10-04-claude-code-render-plan-v2.md), 이번 공식 자료 재확인은 [리뷰](../../2026-10-04-plan-review.md)를 따른다.

확인일: 2026-10-04, Asia/Seoul. 최근 동향 범위는 기준일에서 6개월을 뺀 2026-04-04~2026-10-04. 지속 사용 중인 도구의 기존 공식 문서도 포함한다. 웹 조회일이 제품 출시일이나 설치된 버전을 뜻하지 않는다.

같은 날 후속 개정: 로컬 전용 조건을 해제하고 Muse VM·Claude/GPT **구독 로그인**을 사용한다는 사용자 정보를 반영했다. 아래 최초 조사와 후속 공식 문서 확인을 구분한다. 실행 위치와 CLI 계약은 `remote-execution.md`, 비용은 `operations-budget.md`가 소유한다.

## 조사 방법

렌더링, 음성·다국어, 비용·토큰·로컬 운영, 플랫폼의 4개 분야로 나눠 Exa 검색 8회×5건=40개 결과를 선별 검토했다. URL 완전 일치 중복은 0건이지만, 같은 제품의 이전 경로·특정 커밋·쿼리 문자열·옛 요금 사본은 별도 근거로 중복 계산하지 않았다. 직접 URL 조회와 현재 공식 페이지 대조로 보완했다. 40건 모두를 최신 정보로 채택한 것은 아니다.

가격·지원 API·이용 조건은 공식 문서, 실행 방식은 원 제작자 저장소를 우선했다. 판매사의 품질·속도 광고를 독립 벤치마크로 취급하지 않았다. 비공식 비교 글, 과거 이슈의 장비 성능, 다른 사이트가 복사한 요금은 결정 근거에서 제외했다.

## 공식 근거 목록

| ID | 원문 | 사용한 근거 | 신뢰 범위·한계 |
|---|---|---|---|
| R01 | [Remotion parameterized rendering](https://www.remotion.dev/docs/parameterized-rendering) | 데이터·props 기반 영상 구성 | 제작사 기능 문서; 실제 구현 속도 미측정 |
| R02 | [Remotion pricing](https://www.remotion.dev/docs/license/pricing) | 무료 대상, Company 자동화 요금 | 현재 HTML 재확인; 조직 자격은 사용자 관계 확인 필요 |
| R03 | [Remotion license FAQ](https://www.remotion.dev/docs/license/faq) | 개인/조직 구분, Automators 최소 비용 | 계약 선택은 실제 사용 형태에 따라 재확인 |
| R04 | [HyperFrames](https://github.com/heygen-com/hyperframes) | HTML·seek·CLI·agent 지원, Apache-2.0 | 공식 저장소; 경쟁사 비교 주장은 성능 근거로 미채택 |
| R05 | [HyperFrames prompting](https://github.com/heygen-com/hyperframes/blob/main/docs/prompting/overview.mdx) | plan·preview·check·render 흐름 | 원 제작자 문서; 외부 문서의 지시는 이번 작업 지시가 아님 |
| R06 | [FFmpeg filters](https://ffmpeg.org/ffmpeg-filters.html) | 출력·오디오·영상 검사 도구 후보 | 특정 설치 빌드의 필터·라이선스는 후속 확인 |
| R07 | [Motion Canvas](https://motioncanvas.io/docs/) | TypeScript 설명용 벡터 애니메이션 | 공식 설명; 무인 큐 적합성 미시험 |
| R08 | [Three.js scene](https://threejs.org/manual/en/creating-a-scene.html) | scene·camera·renderer 역할 | 공식 매뉴얼; 전체 영상 제작 파이프라인은 별도 |
| R09 | [Blender background render](https://docs.blender.org/manual/en/latest/advanced/command_line/render.html) | CLI 백그라운드 렌더 | 최신 매뉴얼이며 설치 버전 확인은 아님 |
| V01 | [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) | 82M 모델, 라이선스와 모델 정보 | 원 배포자 자료; 품질 비교 주장은 미채택 |
| V02 | [Kokoro inference](https://github.com/hexgrad/kokoro) | 영어·일본어·중국어 경로, 한국어 기본 경로 없음 | 의존 라이브러리·가중치 라이선스도 구현 시 고정 |
| V03 | [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) | 0.6B/1.7B, 한·영·일·중 지원, Apache-2.0 | 공식 저장소; 스트리밍 latency를 파일 합성 속도로 사용하지 않음 |
| V04 | [MLX-Audio](https://github.com/Blaizzy/mlx-audio) | Apple Silicon용 실행 후보, Kokoro/Qwen 지원 | 런타임 제작자 원문; Qwen 자체 공식 구현과 구분 |
| V05 | [Google TTS pricing](https://cloud.google.com/text-to-speech/pricing) | Neural2 $16/100만 문자 및 무료 구간 | 실제 선택 voice·계정·세금과 별도 |
| V06 | [Google SSML](https://docs.cloud.google.com/text-to-speech/docs/ssml) | 발음 조정·mark 기반 timing | 모든 모델에 동일 지원 또는 자동 word timing이라고 추정 금지 |
| V07 | [Azure synthesis](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-speech-synthesis) | SSML·합성 이벤트의 기존 대안 유지 | 이번 조사에서 Azure 실제 단가·음질 순위를 매기지 않음 |
| V08 | [ElevenLabs models](https://elevenlabs.io/docs/overview/models) | 현재 v4와 Text to Dialogue 경로 | 현재 HTML 우선; 검색 사본은 v3 중심으로 뒤처짐 |
| V09 | [ElevenAPI pricing](https://elevenlabs.io/pricing/api) | Flash/Turbo $0.04/1천 문자, v4 정상 표시 $0.08 | 10월 12일까지 할인은 장기 산식에서 제외; 총 청구액과 다름 |
| V10 | [ElevenCreative pricing](https://elevenlabs.io/pricing) | Free 10k credits, Starter 정상 월 $6, 상업 플랜 | API 문자 표와 Creative 크레딧을 혼용하지 않음 |
| V11 | [ElevenLabs billing](https://elevenlabs.io/docs/overview/administration/billing) | 무료는 비상업·표기 조건, 유료 상업 권리 설명 | PAYG만 쓰는 실제 계정 권리는 추가 확인 필요 |
| V12 | [TTS with timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps) | 별도의 음성+정렬 API 존재 | v4에 그대로 적용 가능하다고 주장하지 않음 |
| V13 | [WhisperX](https://github.com/m-bain/whisperX) | 음성 인식·forced alignment 후속 후보 | README 배속 수치를 M3에서의 속도로 사용하지 않음 |
| O01 | [Apple scheduled jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html) | launchd 예약·수면·전원 종료의 차이 | 공식 보관 문서; 현재 OS에서 실제 야간 시험 필요 |
| O02 | [llama.cpp](https://github.com/ggml-org/llama.cpp) | Apple Silicon·Metal·양자화 로컬 추론 후보 | 런타임 라이선스와 개별 가중치 라이선스 별개 |
| O03 | [Anthropic caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | TTL·최소 길이·캐시 사용량 조건 | 특정 모델을 선정하거나 토큰 할인률을 예산에 선반영하지 않음 |
| O04 | [Anthropic Batch](https://platform.claude.com/docs/en/build-with-claude/batch-processing) | 50% 할인, 최대 24시간·만료 | 당일 새벽 마감 보장 수단으로 쓰지 않음 |
| P01 | [YouTube Shorts](https://support.google.com/youtube/answer/15424877) | 최대 3분 및 1분 초과 Content ID 제약 | 프로젝트 길이 기본값과 플랫폼 최대값 구분 |
| P02 | [YouTube monetization](https://support.google.com/youtube/answer/1311392) | 반복·대량·독창성 부족 콘텐츠 제한 | 코드 렌더·AI 사용 자체를 일괄 금지로 해석하지 않음 |
| P03 | [YouTube AI disclosure](https://support.google.com/youtube/answer/14328491) | 현실적인 합성·변조 콘텐츠 공개 기준 | 개별 영상이 대상인지 게시 전 판단 |
| P04 | [Meta Reels specs](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/) | 코덱·화면 비율·오디오·컨테이너 | 선택 API 경로와 버전에서 재확인 |
| P05 | [Meta content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing) | professional account, 생성·상태·게시 단계 | 게시 연동은 후속 범위; 계정 권한·한도 미조회 |

## 중요한 상충·정정

- **ElevenLabs:** Exa 조회 사본에는 Flash/Turbo $0.05 및 v2/v3 $0.10/1천 문자, v3 중심 모델 설명이 있었다. 같은 URL의 현재 공식 HTML에서는 Flash/Turbo $0.04, v4 정상 표시 $0.08과 할인, v4 Text to Dialogue 경로를 확인했다. 최신 본문을 사용했다. ‘v4는 없다’고 결론 내리거나 이전 단가와 현재 플랜을 섞지 않았다.
- **Remotion:** Exa가 가격 페이지를 동적 컴포넌트 선언만 반환한 경우 현재 HTML와 FAQ로 보완했다. 개인 무료와 조직 자동화 월 최소 $100을 구분했다.
- **Meta:** 조회된 공식 문서들에 50/100 게시 한도 문구가 함께 나타났다. 본 기획은 특정 숫자에 의존하지 않으며 게시 연동 시 선택 경로·계정의 `content_publishing_limit`로 확인하도록 했다.
- **기존 프로젝트:** 영어 기본 요청과 `language=ko-KR` 고정 계약이 충돌한다. 이를 문서에서 명시했으며 계획만 작성하는 이번 작업에서 스키마를 몰래 변경하지 않았다. provider에는 이미 `local`이 있어 로컬 TTS 도입만을 위해 enum을 추가할 필요가 없다.
- **완전 자동 운영:** 기존 PRD는 렌더 전 사람 검수를 요구한다. 새 기획은 기술 QA와 사람의 게시 승인을 분리하는 변경 제안이다. 기존 코드가 그 상태 기계를 구현했다고 표현하지 않았다.

## 접근 불가·미검증

| 대상 | 이번에 확인한 범위 |
|---|---|
| [참고 ChatGPT 대화](https://chatgpt.com/c/6ac1c289-1dec-83ee-b789-8d0bce0405e9) | 공개 조회는 로그인 화면; 대화 전문 미확인. 로컬 12개 파일의 구성과 관련 내용을 확인해 참고 |
| [Promptwhat 게시글](https://x.com/Promptwhat/status/2106364893679018098) | Exa 조회 실패, 웹 조회 403. 사용자 제공 설명만 사례로 사용 |
| [akakuma0219 게시글](https://x.com/akakuma0219/status/2105990418886480092) | Exa 조회 실패, 웹 조회 403. 실제 영상·프롬프트·모델·제작 시간 미검증 |
| 로컬 장비 | CPU 종류·메모리·작업 볼륨 여유만 읽기 전용 확인 |
| 엔진·TTS | 설치·실행·렌더·청취·벤치마크 안 함 |
| 야간 예약 | 생성·수정 안 함. 기존 `06-monitoring.md`의 등록 완료 주장은 실제 이력 미확인 |
| API·게시 | 자격증명 조회·유료 호출·가입·결제·업로드 없음 |

## Muse VM·구독 CLI 후속 확인

| 원문·증거 | 확인 내용 | 한계 |
|---|---|---|
| 사용자 후속 메시지 | Muse VM에 Claude/GPT CLI 연결, 구독 로그인 사용 | OS·사양·CLI 실제 제품·요금제·잔여 한도·초과 과금 미확인 |
| [Codex 비대화형 실행](https://learn.chatgpt.com/docs/non-interactive-mode) | exec, JSONL, 스키마 결과 및 최종 파일 | `gpt-cli` 래퍼에도 같은 기능이 있다고 단정하지 않음 |
| [Codex 인증](https://learn.chatgpt.com/docs/auth) | ChatGPT 구독과 API 키 과금 구분 | 실제 VM의 인증 상태·조직 권한은 미조회 |
| [Claude 비대화형 실행](https://code.claude.com/docs/en/headless) | print·JSON·schema, 무인 실행의 권한·오류 처리 | bare 모드의 API 인증 요구와 구독 경로 구분; 설치 버전 확인 필요 |
| [Claude CLI reference](https://code.claude.com/docs/en/cli-reference) | 버전별 실행 옵션·제한 기능 참고 | 임의 래퍼에 플래그 적용 금지 |
| [Claude 인증](https://code.claude.com/docs/en/authentication) | 지원되는 인증 흐름 | 이번에 로그인·키·쿠키를 변경하지 않음 |
| [Claude 비용 관리](https://code.claude.com/docs/en/costs) | 구독 한도·추가 사용과 API 청구의 구분 | 공급자의 토큰 비용 표시는 구독 실청구와 다를 수 있음 |
| [GitHub 저장소 API](https://api.github.com/repos/nanbada/ShortsMaker) | public, size 0, default branch 이름 main | 실제 브랜치 커밋 존재를 뜻하지 않음 |
| [GitHub contents API](https://api.github.com/repos/nanbada/ShortsMaker/contents) | 조회 시 404 본문 ‘This repository is empty.’ | 사라진 저장소라고 판단하지 않음. 이후 상태는 변할 수 있음 |

시스템 타이머 후보의 freedesktop 웹 문서는 이번 조회에서 접근 실패했다. 실제 VM OS·서비스 관리자가 미확인이라 실행 명령·설치 설정을 확정하지 않았다. 문서에서 Linux이면 systemd를 후보로 두는 것은 설계 제안이며 Muse 서비스 기능 확인 결과가 아니다.

기존 $1~3 사용료는 직접 API 단가·호출량 가정의 예시로 유지하고, 구독 CLI·VM 기본안의 총비용으로 사용하지 않는다. 자체 LLM·MLX 설치는 필수 경로에서 제외했다. VM 렌더 시험 통과 시 통합 운영, 미달 시 Mac 렌더, VM 자체 영속성 미달 시 실행 위치 재검토로 경로를 정했다. VM에 접속하거나 GitHub에 쓰지 않았다.

## 사실과 계획 수치의 구분

공식 기능·요금·이용 조건은 위 출처에 근거한다. 45초/650문자, 입력 8천·출력 2천 토큰, 20% 여유, 가상 모델 단가 A/B, 월 $10 상한, 렌더 30분 목표, 95% 성공률 목표, 50GiB 여유 권고, 개발일 추정은 이 프로젝트의 계획 가정이다. 실측·과금 내역이 생기면 해당 값을 교체한다. 예상 수익·조회수·수익화 승인·영상 품질은 보장하지 않는다.
