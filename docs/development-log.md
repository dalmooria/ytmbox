# YTMBox 개발 기록

이 문서는 YTMBox가 지금 모습이 된 경위를 남긴다. 무엇을 만들었는지보다 **왜 그렇게 만들었는지,
무엇이 깨졌었고 어떻게 확인했는지**에 무게를 둔다. 코드를 읽어서 알 수 있는 것은 적고, 코드만
봐서는 복원할 수 없는 것을 적는다.

작성 시점: 2026-09-18 / 커밋 38개 / 테스트 94개.

## 무엇인가

music.youtube.com을 감싸는 Electron 데스크톱 앱. macOS가 1순위, Windows는 부차적이다.
개인용으로 만들었지만 오픈소스로 공개하고 개인 Homebrew tap으로 배포할 계획이다.
Apple Developer 계정이 없어 **ad-hoc 서명**으로 배포한다.

- 사양: `docs/superpowers/specs/2026-09-17-ytmusic-electron-wrapper-design.md`
- 구현 계획: `docs/superpowers/plans/2026-09-18-ytmusic-electron-wrapper.md`
- 수동 검증: `docs/superpowers/verification/2026-09-18-manual-checklist.md`

기술 스택은 Electron 44.4.2(Node 24 번들), TypeScript, vitest다. 번들러를 쓰지 않고 `tsc`로만
CommonJS를 만든다.

## 경과

계획서의 15개 태스크를 먼저 구현했고(`506245e`까지), 그 뒤 실제로 앱을 써보면서 나온 문제를
하나씩 고쳤다. **계획 단계에서 잡힌 결함보다 실행해보고 나서 잡힌 결함이 더 심각했다** —
아래 결함 목록에서 치명적인 것들은 전부 후자다.

| 단계 | 결과 |
|---|---|
| 계획 구현 (태스크 15개) | 커밋 23개, 테스트 62개 |
| 수동 검증 1회차 | 로그인 복귀 결함 발견·수정 |
| 종료 불가 버그 | `beforeunload` 거부권 — 강제 종료 외에 방법 없던 상태 |
| 아이콘 적용 | 실제 아트워크 반영 |
| 메뉴 막대 곡 표시 | 렌더러→메인 IPC 신설 |
| YTMBox로 개명 | 앱 이름·번들 ID·cask·창 제목 |
| 플레이어 바 컨트롤 노출 | 볼륨·셔플·반복 상시 표시 |

## 기능

- Google 로그인 및 세션 유지 (`persist:ytmusic` 파티션)
- 창 크기·위치·최대화 상태 기억
- 창을 닫아도 재생 유지, 트레이/Dock에서 복원 (macOS)
- 단일 인스턴스
- Chrome User-Agent 위장 (Google의 임베디드 브라우저 차단 우회, 기본 켜짐)
- 내비게이션 허용목록, 외부 링크는 기본 브라우저로
- 트레이 아이콘 + 재생 컨트롤 메뉴
- **메뉴 막대에 현재 곡 표시** (macOS)
- **창 제목을 앱이 소유** (`곡 제목 — YTMBox`)
- **볼륨·셔플·반복 상시 표시**
- 오프라인 안내 페이지
- 미디어키 강제 점유 옵션 (기본 꺼짐)

## 고친 결함들

실행해보기 전에는 드러나지 않았던 것들이 가장 비쌌다.

### 종료가 되지 않던 버그

가장 심각했다. YouTube Music은 `window`에 `beforeunload` 리스너를 여러 개 등록한다. 그중
하나가 이탈을 취소하면 Electron은 `will-prevent-unload` 리스너가 없는 창의 닫기를 **에러도
로그도 없이 거부**하고, `app.quit()`이 `close` 단계에서 멈춰 `will-quit`에 도달하지 못한다.
이 상태에서는 Cmd+Q·트레이 `종료`·Apple Event가 전부 무력화되고 강제 종료만 남는다.

주의할 점은 **처음엔 이 현상을 디버거 탓으로 오귀인했다는 것**이다. 수동 검증 기록에 "디버거가
붙은 반복 실행 중 일부 프로세스가 창 종료 뒤 남았다"고 적고 정상 실행의 문제가 아니라고
결론지었다. 실제로는 그게 버그였다. 갓 띄운 앱은 정상 종료되고 잠시 쓰고 나면 종료되지 않는
조건부 재현이라 판단이 흐려졌다.

수정: `src/main/unload.ts`. 검증: `beforeunload` 핸들러를 CDP로 주입한 상태에서 수정 전에는
`app.quit()` 후에도 생존, 수정 후에는 1초 내 종료.

### 같은 창에서 열리는 Google 로그인

Premium 안내 페이지의 로그인은 팝업이 아니라 같은 창에서 열려 `setWindowOpenHandler`에 걸리지
않았고, 인증 후 Google 페이지에 남았다. `will-navigate`에서 `accounts.google.com` 최초 진입만
Music 복귀 URL로 바꾼다. 인증 진행 중인 단계 이동은 건드리지 않는다.

**아직 확인되지 않은 위험**: 이 분기는 music.youtube.com에서 accounts.google.com으로 가는
모든 렌더러 내비게이션을 가로챈다. 로그아웃(`/Logout`)이나 계정 전환도 여기 걸릴 수 있는데
시험해보지 않았다. 깨진다면 조건을 `/ServiceLogin` 계열로 좁히는 것이 최소 수정이다.

### 보안 결함 두 가지

- `shell.openExternal`이 스킴을 검사하지 않아 `file:`이나 커스텀 스킴이 OS 핸들러로 전달될 수
  있었다. `isExternallyOpenable`로 http/https만 통과시킨다.
- UA 복원 조건이 `startsWith`라 `accounts.google.com.evil.com`이 통과했다. 정확한 호스트 일치와
  https 확인으로 바꿨다.

### 그 밖에

| 결함 | 내용 |
|---|---|
| 의존성 핀 | `@types/node ^20`이 vitest 5 peer 범위와 충돌, Node 20이 Electron 44 요구치 미달 → Node 24로 |
| 순환 import | `navigation.ts` ↔ `window.ts` → `constants.ts` 도입 |
| 고아 프로세스 | `window-all-closed` 빈 핸들러가 기본 종료를 억제, 트레이 없는 non-macOS에서 창도 트레이도 없이 생존 |
| `createTray` 계약 위반 | `Tray | null`을 반환한다면서 생성 예외가 그대로 전파 |
| macOS 버전 하한 누락 | 사양의 macOS 13+ 요구가 어느 태스크에도 없었음 → `minimumSystemVersion` |
| 오프라인 재진입 | `did-fail-load` → `loadFile` 무한 루프 가능 → 래치 + `.catch()` |
| 아이콘 | 제공된 PNG가 불투명 회색 배경 위 67% 크기 렌더링이라 Dock에서 회색 사각형이 됐을 것 |
| 아이콘 생성기 | `npm run icons`가 실제 아트워크를 플레이스홀더로 덮어씀 → 앱 아이콘 생성 제거 |
| 락파일 | 개명 후 `package-lock.json`에 옛 이름 잔류 |

### 플레이어 바 컨트롤

볼륨·셔플·반복이 **두 겹으로** 숨어 있었다. `(max-width: 1149px)`에서 `display: none`이고, 그
위로 `.volume-slider`는 `opacity: .000001`이다. 한 겹만 고치면 여전히 보이지 않는다.

되돌리는 과정에서 함정이 둘 더 있었다. `display`만 복구하면 슬라이더가 flex 부모에 눌려
100px→32px로 찌그러지고, `flex: none`만 주면 이번엔 컨테이너 밖으로 넘쳐 **작업 메뉴(⋮) 위를
덮어 클릭을 가로챈다.** 후자는 스크린샷으로는 정상으로 보였고, 바 안의 모든 레이블 요소를
히트테스트해서야 드러났다. `min-width: max-content`로 컨테이너에 자리를 줘 해결했다.

## 의도적으로 하지 않은 것

- **2차 기능 전체.** 사양 단계에서 "껍데기를 먼저 완성한 후 2차로 미루자"고 결정했다.
- **앱 이름 변경 시 userData 이관 코드.** 배포 전이라 사용자가 한 명뿐이고, 폴더를 한 번
  옮기는 것으로 끝났다. 배포 후에 개명한다면 이관 코드가 필요하다.
- **`persist:ytmusic` 파티션 개명.** userData 안쪽 경로라 바꾸면 로그인만 날아가고 얻는 게 없다.
- **`ytmusic-player-bar`, `YTMUSIC_URL` 개명.** 전자는 YouTube Music의 DOM 요소명, 후자는
  서비스 주소다. 우리 앱을 가리키지 않는다.
- **플레이어 바 CSS on/off 토글.** 요청 범위 밖이라 항상 켜짐으로 뒀다.

## 검증 방법과 한계

단위 테스트(94개)로는 순수 함수와 이벤트 배선만 덮인다. 실제 동작은 대부분 **실행 중인 앱에
CDP로 붙어** 확인했다.

| 무엇 | 어떻게 |
|---|---|
| `mediaSession`을 샌드박스 preload에서 읽을 수 있는가 | 격리 월드와 메인 월드 값을 나란히 출력해 비교 |
| 종료 버그 | `beforeunload` 주입 후 `app.quit()` 전후 프로세스 생존 확인 |
| 플레이어 바 레이아웃 | 바 안 모든 레이블 요소를 `elementFromPoint`로 히트테스트 |
| 메뉴 막대·창 제목 | System Events로 실제 창 제목과 메뉴 이름 조회 |
| 패키징 결과물 | asar 추출 후 파일 존재 확인, `codesign --verify`, Info.plist 조회 |
| 아이콘 | 설치된 `.icns`를 PNG로 되돌려 알파 채널 확인 |

**한 번도 확인되지 않은 것들** — 이것들이 남아 있는 한 릴리스 검증이 끝났다고 볼 수 없다:

- 하드웨어 미디어키 (OFF/ON 각각), 제어센터 곡 표시, 실제 청음
- 접근성 권한 최초 요청 팝업, 권한 거부 경로, 다른 앱과의 미디어키 점유 충돌
- 다운로드로 quarantine 속성이 붙은 DMG에서의 Gatekeeper 동작 (로컬 빌드에는 속성이 없다)
- Intel 실기기
- Windows 빌드 — 설정만 있고 한 번도 빌드·실행된 적이 없다
- Homebrew tap 설치 경로
- 로그아웃 / 계정 전환

## 도구에 관한 메모

검증 중 dev 앱을 `npx electron dist/main/index.js`로 띄우면 `app.getAppPath()`가 어긋나
**트레이가 생성되지 않는다**(경고만 남기고 조용히 넘어간다). `npm start`(`electron .`)와 패키징
빌드는 정상이다. 이것 때문에 메뉴 막대 기능을 검증하지 못한 채 넘어갈 뻔했다.
