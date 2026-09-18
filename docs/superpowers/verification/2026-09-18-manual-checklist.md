# YTMBox 수동 검증 체크리스트

이 문서는 실제 디스플레이·오디오·Google 계정·하드웨어 미디어키가 필요해 자동 테스트로 확인하지 못한 항목을
릴리스 전에 한 번은 직접 실행해보기 위한 체크리스트다. 2026-09-18 개발 모드, 패키징 앱,
DMG 설치본을 실제 실행했다. 아래 체크와 결과 기록은 이 실행에서 관찰한 범위이며,
하드웨어 입력·청음 등 미확인 항목은 보류로 남긴다.

처음부터 끝까지 순서대로 실행하면 되도록 구성했다. 각 항목은 (a) 무엇을 하는지, (b) 무엇이 일어나야
정상인지, (c) 실패 시 흔한 원인을 적었다. 실패한 항목은 원인까지 `비고`에 적고, 필요하면 관련 소스를 고친 뒤
다시 검증한다.

## 진행 전 기록

- 테스터 macOS 버전: 26.6.2 (25G83)
- 칩: [x] Apple Silicon (arm64)  [ ] Intel (x64)
- 검증 일자: 2026-09-18, 15:54–16:10 KST
- 사용한 빌드: [x] `npm start` (dev)  [x] `release/mac-arm64/YTMBox.app` (또는 `release/mac/`, packaged)  [ ] Homebrew 설치본

Gatekeeper 동작과 아키텍처별 바이너리가 다르므로, 위 정보를 먼저 적어두면 결과를 나중에 비교할 수 있다.

## 0. 빌드

- [x] `npm test && npm run dist` 실행. 모든 테스트 PASS, `release/`에 산출물 4개
      (`YTMBox-<version>-arm64.dmg`, `YTMBox-<version>-x64.dmg`,
      `YTMBox-<version>-arm64.zip`, `YTMBox-<version>-x64.zip`) 생성 확인.

## 1. 실행과 렌더링 (첫 관찰)

- [x] **개발 모드 실행**: `npm start`. 앱 창이 뜨고 몇 초 안에 YouTube Music 페이지가 렌더링된다.
      (지금까지 한 번도 관찰된 적 없는 경로 — 창이 비어 있거나 흰 화면이면 `did-fail-load`나
      콘솔의 CSP/로드 에러를 확인한다.)
- [x] **빌드된 앱 실행**: `open release/mac-arm64/YTMBox.app` (Intel이면 `release/mac/YTMBox.app`).
      dev와 동일하게 창이 뜨고 렌더링된다. 패키징된 애셋 경로(`app.getAppPath()`가 가리키는
      `app.asar` 내부)가 dev와 다르므로 별도로 확인해야 한다 — 여기서만 나는 실패가 있을 수 있다
      (트레이 아이콘, 오프라인 페이지 등은 8절에서 다시 확인).

## 2. 로그인 (가장 위험도가 높은 영역)

UA 위장(`overrideUserAgent`, 기본 ON)은 오직 Google 로그인 차단을 피하기 위해 존재한다. 이 절이
막히면 앱의 핵심 존재 이유가 무너지므로 가장 신경 써서 본다.

- [x] Google 계정으로 로그인 시도. **"이 브라우저 또는 앱은 안전하지 않을 수 있습니다" 차단 화면이
      뜨지 않고** 로그인이 완료된다.
- [x] 로그인 완료 후 Google 페이지에 멈춰있지 않고 **자동으로 `music.youtube.com`으로 돌아온다**
      (`src/main/policy/login-url.ts`의 `loginUrlReturningToYtMusic` / `navigation.ts`의
      `isAccountsHost` 분기).
- [x] 앱을 완전히 종료(Cmd+Q)했다가 재실행. **로그인 세션이 유지된다** (`persist:ytmusic` 파티션,
      `src/main/window.ts`).
- [ ] **가장 먼저 의심할 곳**: `src/main/policy/user-agent.ts`의 `shouldRestoreOriginalUa`.
      현재 페이지와 요청이 모두 `accounts.google.com`일 때(로그인 실패 후 "다시 시도" 케이스를 위한
      예외 처리), 위장된 UA 대신 **원래 Electron UA로 되돌린다** — 즉 UA 위장이 정확히 숨기려는
      토큰을, 로그인 도중인 그 순간에 다시 노출시킨다. 로그인이 막힌다면 이 예외가 원인일 가능성이
      가장 크다.
- [ ] **위 예외를 먼저 격리해서 진단한다** (아래 "UA 위장 자체를 끄는" 단계보다 먼저 시도할 것):
      `shouldRestoreOriginalUa`가 무조건 `false`를 반환하도록 임시로 고치고, 다시 빌드해서
      (`npm run build`) 로그인을 재시도한다. 이렇게 하면 UA 위장(`overrideUserAgent`)은 그대로 켜진
      채 이 "다시 시도" 예외만 없앤 상태가 된다. 이때 로그인이 성공하면 이 예외가 원인이 확정된
      것이므로, 제거하거나 별도 설정 뒤로 옮기는 것을 검토한다. 확인 후에는 원래 코드로 되돌린다.
- [ ] **로그인이 막히는 경우의 다음 진단 경로**: 메뉴 바 `설정` → `Chrome User-Agent로 위장 (재시작 필요)`
      체크를 끄고 재시작해서 다시 시도해본다. 이 토글이 실제 메뉴 라벨이다
      (`src/main/menu.ts`). **주의**: 이 토글은 UA 위장 자체와 위 `shouldRestoreOriginalUa` 예외를
      동시에 끄므로, 위의 격리된 진단(예외만 끄기)을 먼저 시도한 뒤에 이 단계로 넘어와야 원인을
      구분할 수 있다. 이 시도의 결과(꺼도 여전히 막히는지, 꺼면 되는지)는 성공이든 실패든
      반드시 비고에 기록한다 — 막혔을 때의 유일한 대응 수단이므로 "확인 안 함"으로 남기지 않는다.

## 3. 창과 생명주기

- [x] 창 크기와 위치를 바꾼 뒤 앱을 종료하고 재실행. 이전 크기·위치로 복원된다
      (`windowState.bounds`, 저장은 리사이즈/이동 후 300ms 디바운스).
- [x] 창을 맥시마이즈한 뒤 종료하고 재실행. 맥시마이즈 상태로 복원된다 (`windowState.isMaximized`).
- [ ] macOS에서 빨간 버튼(닫기)으로 창을 닫는다. **앱이 종료되지 않고 재생 중이던 오디오도 계속
      재생된다.** Dock 아이콘 클릭과 트레이 `열기` 메뉴 양쪽 모두로 창이 복원된다.
- [x] 앱이 실행된 상태에서 두 번째 인스턴스를 실행(`open` 또는 Finder에서 다시 더블클릭). 새 창이
      뜨지 않고 기존 창이 포커스된다 (`requestSingleInstanceLock` / `second-instance`).
- [ ] **한동안 재생한 뒤 Cmd+Q와 트레이 `종료`로 각각 종료한다.** 창이 사라질 뿐 아니라
      `pgrep -f YTMBox`이 비어야 한다. 프로세스가 남으면 페이지의 `beforeunload` 거부권이
      다시 살아난 것이다 (`src/main/unload.ts`). 재생 직후·일시정지 상태 양쪽에서 확인한다.
- [x] **창을 최소화한 뒤, 세 가지 방법으로 모두 복원되는지 확인한다** — 이 복원 경로는 최근 수정되었고
      아직 실제로 검증된 적이 없다:
  - [x] 두 번째 인스턴스 실행 (`second-instance` 이벤트 → `showMainWindow`)
  - [x] Dock 아이콘 클릭 (`activate` 이벤트 → `showMainWindow`)
  - [x] 트레이 메뉴의 `열기` 항목 클릭
  세 경로 모두 `mainWindow.isMinimized()`면 `restore()`를 호출하는 동일한 `showMainWindow`
  함수를 쓴다 (`src/main/index.ts`) — 하나라도 안 되면 세 곳 다 의심한다.

## 4. 트레이

- [x] 메뉴 바에 트레이 아이콘이 나타난다. 시스템을 라이트 모드/다크 모드로 각각 바꿔가며 아이콘이
      배경과 구분되어 잘 보인다 (Template 이미지라 macOS가 자동으로 색을 반전시킨다).
- [x] 트레이 메뉴 항목이 정확히 다음 5개이고 각각 동작한다: `열기` / `재생 / 일시정지` / `다음 곡` /
      `이전 곡` / `종료` (`src/main/tray.ts`의 실제 라벨).
  - [x] `재생 / 일시정지`, `다음 곡`, `이전 곡`은 preload IPC 채널(`MEDIA_CHANNEL`)이 실제로 동작하는지
        확인하는 첫 실사용 경로다. 아무 반응이 없으면 YouTube Music 현재 DOM에서
        `ytmusic-player-bar .next-button` / `.previous-button` 등 셀렉터가 바뀌었을 가능성이 크다
        (재생 관련 커맨드를 처리하는 렌더러/프리로드 코드에서 확인).

## 4-1. 메뉴 막대 곡 표시 (macOS)

- [ ] 재생을 시작하면 트레이 아이콘 옆에 `제목 — 아티스트`가 나타난다. 곡을 넘기면 즉시 바뀐다.
- [ ] 제목이 긴 곡에서 아티스트가 먼저 사라지고, 그래도 길면 `…`로 잘린다. 메뉴 막대가
      다른 아이콘을 밀어낼 만큼 길어지지 않는다. 폭이 불편하면 `TRAY_TITLE_BUDGET`
      (`src/shared/now-playing.ts`, 기본 32칸)을 조정한다.
- [ ] 일시정지해도 제목이 남아 있고, 앱을 막 켜서 아무것도 재생하지 않았을 때는 아이콘만 보인다.

## 5. 메뉴와 설정 영속성

- [x] 메뉴 바 `설정`에 체크박스 두 개가 보인다:
  - `Chrome User-Agent로 위장 (재시작 필요)` — 기본 **체크됨**
  - `미디어키 강제 점유 (다른 앱의 미디어키를 가로챔)` — 기본 **체크 해제**
- [x] 각 체크박스를 토글한 뒤 앱을 재시작해도 상태가 유지된다.
- [x] `~/Library/Application Support/YTMBox/settings.json` 파일이 존재하고, 위에서 바꾼 값이 반영돼
      있는지 `cat`으로 확인한다. **다른 이름의 디렉터리(예: `ytmbox`, `com.brad.ytmbox`) 아래 생기지
      않는지도 확인한다** — `productName: YTMBox`을 그대로 쓰므로 `YTMBox` 디렉터리가 맞다.

## 6. 미디어키

- [ ] **강제 점유 OFF (기본값)**: 곡을 재생한 뒤 하드웨어 재생/일시정지, 다음, 이전 키를 누른다.
      앱이 반응하고, macOS 제어센터의 "재생 중" 위젯에 현재 곡이 표시된다. 이는 Chromium
      MediaSession을 통한 기본 경로이며 별도 권한이 필요 없다.
- [ ] **강제 점유 ON**으로 바꾸면 macOS 손쉬운 사용(Accessibility) 권한 요청 팝업이 뜬다. 권한을
      허용한 뒤 하드웨어 키가 앱을 제어하는지 확인한다. 다시 OFF로 바꾸면 키를 놓아준다
      (`globalShortcut.unregisterAll()`).
- [ ] **실패 경로 기록**: 다른 앱이 이미 미디어키를 점유 중이거나 손쉬운 사용 권한이 거부된 상태에서
      강제 점유를 켜면, 설정은 그대로 저장되고 체크박스도 계속 체크된 채로 남지만 실제로는 아무 키도
      동작하지 않는다. 유일한 신호는 콘솔 경고(`[media-keys] ...`)뿐이다. 이는 알려진, 의도적으로
      고치지 않은 한계다 — 실제로 어떻게 나타나는지(조용히 실패하는지, 어떤 로그가 찍히는지)를
      비고에 기록해서 이 갭의 체감 정도를 남긴다.

## 7. 내비게이션

- [x] YouTube Music 페이지 안에서 외부로 나가는 링크(예: 아티스트 채널의 외부 링크, 도움말 링크 등)를
      클릭하면 **기본 브라우저**에서 새 탭으로 열리고, 앱 안에는 새 창이 뜨지 않는다
      (`setWindowOpenHandler`가 항상 `deny`하고 허용되지 않은 URL은 `shell.openExternal`로 보낸다).
- [x] music.youtube.com 내부 내비게이션(앨범, 아티스트, 검색 결과 클릭 등)은 앱 창 안에서 그대로
      이동한다.

## 8. 오프라인

- [ ] Wi-Fi를 끄고 앱을 실행(또는 실행 중 Wi-Fi를 끄고 새로고침). Chromium 기본 에러 페이지 대신
      `assets/offline.html` 오프라인 안내 페이지("YouTube Music에 연결할 수 없습니다")가 뜬다
      (`did-fail-load`의 메인 프레임 실패를 감지, 사용자 취소(-3)는 무시).
- [x] 오프라인 페이지의 `다시 시도` 링크를 클릭하면 시스템 브라우저가 아니라 **앱 안에서** 다시
      `music.youtube.com`으로 로드를 시도한다 (허용된 URL로의 일반 내비게이션이라
      내비게이션 정책에 걸려 외부로 나가지 않는다).

## 9. 패키지 빌드와 Gatekeeper

- [ ] DMG(`release/YTMBox-<version>-arm64.dmg` 또는 `-x64.dmg`)를 열어 `/Applications`로 드래그
      설치한 뒤 실행한다. macOS 15 이상에서는 "손상되었기 때문에 열 수 없습니다" 오류가 예상된다
      (ad-hoc 서명, `identity: "-"`, notarize 없음). 아래 명령으로 해결되는지 확인한다:
      ```
      xattr -cr /Applications/YTMBox.app
      ```
- [x] 위 패키징된 `.app`에서 4절(트레이 아이콘)과 8절(오프라인 페이지)을 다시 확인한다. 두 기능
      모두 `app.getAppPath()`로 `app.asar` 내부 경로를 참조하므로, dev에서는 되고 패키징된 빌드에서는
      안 되는 경로 문제가 있을 수 있다 — 1절과 별개로 반드시 재확인한다.
- [ ] (선택, tap 저장소를 만든 뒤) `brew tap <github-user>/tap && brew install --cask ytmbox`로
      설치했을 때는 cask의 `postflight`가 자동으로 격리 속성을 제거하므로 위 Gatekeeper 경고 없이
      바로 실행되는지 확인한다. tap 저장소가 아직 없다면 이 항목은 "보류"로 기록한다.

## 결과 기록

각 대항목 실행 후 아래 표에 `PASS` / `FAIL(원인)` / `보류(이유)`를 채운다.

| # | 절 | 결과 | 비고 |
|---|---|---|---|
| 0 | 빌드 (테스트 + `npm run dist`) | PASS | 초기 62개, 로그인 복귀 수정 후 65개 테스트 통과. 최종 dist 종료 코드 0; 0.1.0 arm64/x64 DMG·ZIP 4개 생성. |
| 1 | 실행과 렌더링 (dev / packaged) | PASS | 로그인 전 Premium 안내가 렌더링됨. 로그인 후 dev/packaged 모두 Music 홈 확인. /Applications 설치본도 실행. |
| 2 | Google 로그인 및 세션 유지 | PASS(수정 후, 범위 주의) | 사용자가 직접 Google 로그인 성공. 초기에는 Premium에 남음 → 같은 창 로그인 복귀 처리 수정. 기존 로그인 세션으로 해당 링크 재실행 시 music.youtube.com 복귀 확인. 새 인증정보 입력부터의 수정 후 재시험은 미실시. |
| 3 | 창 상태 복원, hide-on-close, 단일 인스턴스, 최소화 복원 3경로 | PASS / 일부 보류 | 1000×700, x=358/y=173 복원 및 최대화 복원. 닫힌 창에서 재생 시간 1.69→8.36초 증가. 최소화→두 번째 인스턴스/Dock/트레이 모두 창 1개로 복원. 실제 청음은 사용자 확인 대기. |
| 4 | 트레이 아이콘 및 메뉴 5항목 | PASS | 라이트/다크 아이콘 식별. 실제 트레이 5개 동작 항목 확인. 재생 시작·정지, 다음 곡, 이전 명령의 재시작 확인. 재생 위치 0초에서 previous IPC로 이전 곡 복귀도 확인. 종료 후 프로세스 종료 재확인은 아래 실행 기록 참고. |
| 5 | 설정 메뉴 체크박스 및 영속성 | PASS | 기본 true/false → false/true 토글 후 재시작 유지 → true/false 복구. userData=YTMusic. 소문자 경로는 대소문자 비구분 파일시스템의 동일 inode이며 별도 파일 아님. |
| 6 | 미디어키 (OFF/ON/실패 경로) | 보류(물리 입력/권한 조건) | OFF MediaSession playing·곡 제목 확인. ON 단축키 등록 true, OFF 해제 false 확인. 기존 접근성 신뢰 상태 true라 최초 권한 팝업/실제 거부·타 앱 점유 조건 미재현. 물리 키·제어센터·청음 사용자 확인 대기. |
| 7 | 외부 링크 / 내부 내비게이션 | PASS(통제된 외부 링크) | 실제 앨범 링크 클릭→앱 내부 playlist 이동. example.com window.open→Chrome Example Domain 탭과 주소창 확인, 앱 창 1개 유지. 실제 아티스트 외부 링크는 별도 미시험. |
| 8 | 오프라인 페이지 및 다시 시도 | PASS(앱 세션 차단 대체) | 전체 Wi-Fi 대신 세션 오프라인/요청 차단을 사용. dev 및 app.asar의 offline.html 문구 확인. 차단 해제 후 다시 시도 클릭→앱 안 music.youtube.com 복귀. 물리 Wi-Fi OFF는 미실시. |
| 9 | DMG 설치, Gatekeeper, 패키징 빌드에서의 트레이/오프라인 | PASS / 조건부 보류 | 최종 arm64 DMG 마운트·/Applications 복사 설치, codesign 검증 및 xattr -cr 종료 0. 로컬 빌드는 quarantine이 없어 Gatekeeper 경고/경고 제거 효과는 미검증. Homebrew tap 미준비, x64 실기기 실행 미검증. |

FAIL이 있으면 해당 소스로 돌아가 수정한 뒤 그 항목만 다시 검증하고 표를 갱신한다.

## 2026-09-18 실행 기록과 남은 조건

체크 표시는 결과 표의 검증 범위와 함께 읽는다. 특히 물리 Wi-Fi 차단은 세션 차단으로,
외부 링크는 통제된 `https://example.com/` 링크로 대체했다. 수동 UI 조작은 Orca 및 macOS
접근성 API, 관찰·일부 동작은 실행 중 Electron의 로컬 디버거로 수행했다.

- **로그인 수정**: `src/main/navigation.ts`의 `will-navigate`에서 Google 로그인 최초 진입도
  Music 복귀 URL을 사용한다. 이미 `accounts.google.com`에서 진행 중인 인증 이동은 유지한다.
  회귀 테스트 3개를 추가했고, 수정 전 1개 실패 → 수정 후 전체 65개 통과를 확인했다.
  실제 Premium 화면에서 기존 로그인 링크와 같은 URL을 클릭했을 때, 기존 세션을 사용해
  `https://music.youtube.com/`으로 자동 돌아왔다. 최종 DMG의 `/Applications` 설치본에서도
  같은 복귀와 app.asar 오프라인 화면·다시 시도를 재확인했다.
- **UA 진단 조건**: 기본 UA 설정에서 로그인 차단이 발생하지 않았다. 따라서
  `shouldRestoreOriginalUa`를 임시 변경하거나 UA OFF로 로그인 실패 원인을 분리하는
  조건부 진단은 해당 없음이다. UA OFF 설정의 저장/재시작은 별도로 검증했다.
- **창과 재생**: 실제 닫기 버튼 이후 BrowserWindow는 파괴되지 않고 숨겨졌으며 동영상은
  paused=false 상태로 재생 시간이 증가했다. 트레이와 Dock 복원, 최소화 복원 세 경로를 실행했다.
  이전 곡은 곡 중간에서 누르면 현재 곡의 처음으로 돌아가는 YouTube Music 동작이 관찰됐다.
  0초 위치에서 다시 previous를 전달하면 `그대의 세계` → `내가 있을게`로 돌아왔다.
- **종료 관찰 (2026-09-18 정정)**: 당초 "디버거가 붙은 반복 실행 중 일부 프로세스가 창 종료 뒤
  남았다"를 디버거의 부작용으로 판단했으나, **이는 오귀인이었고 실제 버그였다.** YouTube Music이
  `window`에 등록하는 `beforeunload` 핸들러가 이탈을 취소하면 Electron은 `will-prevent-unload`
  리스너가 없는 창의 닫기를 조용히 거부하고, `app.quit()`이 `close` 단계에서 멈춰 `will-quit`/`quit`에
  도달하지 못한다. 이 상태에서는 Cmd+Q·트레이 `종료`·Apple Event가 모두 무력화되고 강제 종료만 남는다.
  `src/main/unload.ts`의 `attachUnloadOverride`로 수정했고, `beforeunload`를 주입한 상태에서
  종료가 1초 내에 완료되는 것을 확인했다. Cmd+Q가 성공했던 관찰(PID 89256, 21920)은 페이지가
  아직 이탈을 취소하지 않는 상태였기 때문으로, 종료 성공은 조건부였다.
- **권한/하드웨어**: 강제 점유 ON에서 기존 Accessibility 신뢰 상태가 true였으며
  MediaPlayPause 등록을 확인했다. OFF에서 등록이 해제됐다. 실제 권한 거부·다른 앱 점유 실패
  경고, 최초 요청 팝업, 물리 미디어키, 제어센터 표시, 오디오 청음은 미확인이다.
- **Gatekeeper**: 로컬 DMG 설치본에는 `com.apple.quarantine`이 없었다. 경고 없이 실행된 것은
  확인했지만 다운로드한 미공증 앱의 Gatekeeper 통과를 입증하지 않는다.
- **복구**: macOS 테마는 원래 라이트 모드로, 앱 설정은 UA ON / 강제 점유 OFF로 복구했다.
  앱에 적용한 임시 네트워크 차단도 해제했다. Google 로그인 세션은 유지했다.

남은 사용자 검증: 하드웨어 미디어키 OFF/ON 각각, 제어센터 곡 표시와 청음.
남은 환경 검증: 신규 접근성 허용/거부·미디어키 점유 충돌, 다운로드 quarantine이 있는 DMG,
Intel 실기기, Homebrew tap 준비 후 설치. 이 조건들이 확인되기 전 전체 릴리스 검증 완료로 보지 않는다.
