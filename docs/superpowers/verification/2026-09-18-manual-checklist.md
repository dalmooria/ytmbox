# YTMusic 수동 검증 체크리스트

이 문서는 실제 디스플레이·오디오·Google 계정·하드웨어 미디어키가 필요해 자동 테스트로 확인하지 못한 항목을
릴리스 전에 한 번은 직접 실행해보기 위한 체크리스트다. 지금까지 이 앱은 개발 모드에서도, 빌드된 앱으로도
누구도 실제로 실행해본 적이 없다 — 이 문서의 첫 번째 목적은 "앱이 켜져서 YouTube Music이 뜬다"는 것 자체를
확인하는 것이다.

처음부터 끝까지 순서대로 실행하면 되도록 구성했다. 각 항목은 (a) 무엇을 하는지, (b) 무엇이 일어나야
정상인지, (c) 실패 시 흔한 원인을 적었다. 실패한 항목은 원인까지 `비고`에 적고, 필요하면 관련 소스를 고친 뒤
다시 검증한다.

## 진행 전 기록

- 테스터 macOS 버전: ______________
- 칩: [ ] Apple Silicon (arm64)  [ ] Intel (x64)
- 검증 일자: ______________
- 사용한 빌드: [ ] `npm start` (dev)  [ ] `release/mac-arm64/YTMusic.app` (또는 `release/mac/`, packaged)  [ ] Homebrew 설치본

Gatekeeper 동작과 아키텍처별 바이너리가 다르므로, 위 정보를 먼저 적어두면 결과를 나중에 비교할 수 있다.

## 0. 빌드

- [ ] `npm test && npm run dist` 실행. 모든 테스트 PASS, `release/`에 산출물 4개
      (`YTMusic-<version>-arm64.dmg`, `YTMusic-<version>-x64.dmg`,
      `YTMusic-<version>-arm64.zip`, `YTMusic-<version>-x64.zip`) 생성 확인.

## 1. 실행과 렌더링 (첫 관찰)

- [ ] **개발 모드 실행**: `npm start`. 앱 창이 뜨고 몇 초 안에 YouTube Music 페이지가 렌더링된다.
      (지금까지 한 번도 관찰된 적 없는 경로 — 창이 비어 있거나 흰 화면이면 `did-fail-load`나
      콘솔의 CSP/로드 에러를 확인한다.)
- [ ] **빌드된 앱 실행**: `open release/mac-arm64/YTMusic.app` (Intel이면 `release/mac/YTMusic.app`).
      dev와 동일하게 창이 뜨고 렌더링된다. 패키징된 애셋 경로(`app.getAppPath()`가 가리키는
      `app.asar` 내부)가 dev와 다르므로 별도로 확인해야 한다 — 여기서만 나는 실패가 있을 수 있다
      (트레이 아이콘, 오프라인 페이지 등은 8절에서 다시 확인).

## 2. 로그인 (가장 위험도가 높은 영역)

UA 위장(`overrideUserAgent`, 기본 ON)은 오직 Google 로그인 차단을 피하기 위해 존재한다. 이 절이
막히면 앱의 핵심 존재 이유가 무너지므로 가장 신경 써서 본다.

- [ ] Google 계정으로 로그인 시도. **"이 브라우저 또는 앱은 안전하지 않을 수 있습니다" 차단 화면이
      뜨지 않고** 로그인이 완료된다.
- [ ] 로그인 완료 후 Google 페이지에 멈춰있지 않고 **자동으로 `music.youtube.com`으로 돌아온다**
      (`src/main/policy/login-url.ts`의 `loginUrlReturningToYtMusic` / `navigation.ts`의
      `isAccountsHost` 분기).
- [ ] 앱을 완전히 종료(Cmd+Q)했다가 재실행. **로그인 세션이 유지된다** (`persist:ytmusic` 파티션,
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

- [ ] 창 크기와 위치를 바꾼 뒤 앱을 종료하고 재실행. 이전 크기·위치로 복원된다
      (`windowState.bounds`, 저장은 리사이즈/이동 후 300ms 디바운스).
- [ ] 창을 맥시마이즈한 뒤 종료하고 재실행. 맥시마이즈 상태로 복원된다 (`windowState.isMaximized`).
- [ ] macOS에서 빨간 버튼(닫기)으로 창을 닫는다. **앱이 종료되지 않고 재생 중이던 오디오도 계속
      재생된다.** Dock 아이콘 클릭과 트레이 `열기` 메뉴 양쪽 모두로 창이 복원된다.
- [ ] 앱이 실행된 상태에서 두 번째 인스턴스를 실행(`open` 또는 Finder에서 다시 더블클릭). 새 창이
      뜨지 않고 기존 창이 포커스된다 (`requestSingleInstanceLock` / `second-instance`).
- [ ] **창을 최소화한 뒤, 세 가지 방법으로 모두 복원되는지 확인한다** — 이 복원 경로는 최근 수정되었고
      아직 실제로 검증된 적이 없다:
  - [ ] 두 번째 인스턴스 실행 (`second-instance` 이벤트 → `showMainWindow`)
  - [ ] Dock 아이콘 클릭 (`activate` 이벤트 → `showMainWindow`)
  - [ ] 트레이 메뉴의 `열기` 항목 클릭
  세 경로 모두 `mainWindow.isMinimized()`면 `restore()`를 호출하는 동일한 `showMainWindow`
  함수를 쓴다 (`src/main/index.ts`) — 하나라도 안 되면 세 곳 다 의심한다.

## 4. 트레이

- [ ] 메뉴 바에 트레이 아이콘이 나타난다. 시스템을 라이트 모드/다크 모드로 각각 바꿔가며 아이콘이
      배경과 구분되어 잘 보인다 (Template 이미지라 macOS가 자동으로 색을 반전시킨다).
- [ ] 트레이 메뉴 항목이 정확히 다음 5개이고 각각 동작한다: `열기` / `재생 / 일시정지` / `다음 곡` /
      `이전 곡` / `종료` (`src/main/tray.ts`의 실제 라벨).
  - [ ] `재생 / 일시정지`, `다음 곡`, `이전 곡`은 preload IPC 채널(`MEDIA_CHANNEL`)이 실제로 동작하는지
        확인하는 첫 실사용 경로다. 아무 반응이 없으면 YouTube Music 현재 DOM에서
        `ytmusic-player-bar .next-button` / `.previous-button` 등 셀렉터가 바뀌었을 가능성이 크다
        (재생 관련 커맨드를 처리하는 렌더러/프리로드 코드에서 확인).

## 5. 메뉴와 설정 영속성

- [ ] 메뉴 바 `설정`에 체크박스 두 개가 보인다:
  - `Chrome User-Agent로 위장 (재시작 필요)` — 기본 **체크됨**
  - `미디어키 강제 점유 (다른 앱의 미디어키를 가로챔)` — 기본 **체크 해제**
- [ ] 각 체크박스를 토글한 뒤 앱을 재시작해도 상태가 유지된다.
- [ ] `~/Library/Application Support/YTMusic/settings.json` 파일이 존재하고, 위에서 바꾼 값이 반영돼
      있는지 `cat`으로 확인한다. **다른 이름의 디렉터리(예: `ytmusic`, `com.brad.ytmusic`) 아래 생기지
      않는지도 확인한다** — `productName: YTMusic`을 그대로 쓰므로 `YTMusic` 디렉터리가 맞다.

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

- [ ] YouTube Music 페이지 안에서 외부로 나가는 링크(예: 아티스트 채널의 외부 링크, 도움말 링크 등)를
      클릭하면 **기본 브라우저**에서 새 탭으로 열리고, 앱 안에는 새 창이 뜨지 않는다
      (`setWindowOpenHandler`가 항상 `deny`하고 허용되지 않은 URL은 `shell.openExternal`로 보낸다).
- [ ] music.youtube.com 내부 내비게이션(앨범, 아티스트, 검색 결과 클릭 등)은 앱 창 안에서 그대로
      이동한다.

## 8. 오프라인

- [ ] Wi-Fi를 끄고 앱을 실행(또는 실행 중 Wi-Fi를 끄고 새로고침). Chromium 기본 에러 페이지 대신
      `assets/offline.html` 오프라인 안내 페이지("YouTube Music에 연결할 수 없습니다")가 뜬다
      (`did-fail-load`의 메인 프레임 실패를 감지, 사용자 취소(-3)는 무시).
- [ ] 오프라인 페이지의 `다시 시도` 링크를 클릭하면 시스템 브라우저가 아니라 **앱 안에서** 다시
      `music.youtube.com`으로 로드를 시도한다 (허용된 URL로의 일반 내비게이션이라
      내비게이션 정책에 걸려 외부로 나가지 않는다).

## 9. 패키지 빌드와 Gatekeeper

- [ ] DMG(`release/YTMusic-<version>-arm64.dmg` 또는 `-x64.dmg`)를 열어 `/Applications`로 드래그
      설치한 뒤 실행한다. macOS 15 이상에서는 "손상되었기 때문에 열 수 없습니다" 오류가 예상된다
      (ad-hoc 서명, `identity: "-"`, notarize 없음). 아래 명령으로 해결되는지 확인한다:
      ```
      xattr -cr /Applications/YTMusic.app
      ```
- [ ] 위 패키징된 `.app`에서 4절(트레이 아이콘)과 8절(오프라인 페이지)을 다시 확인한다. 두 기능
      모두 `app.getAppPath()`로 `app.asar` 내부 경로를 참조하므로, dev에서는 되고 패키징된 빌드에서는
      안 되는 경로 문제가 있을 수 있다 — 1절과 별개로 반드시 재확인한다.
- [ ] (선택, tap 저장소를 만든 뒤) `brew tap <github-user>/tap && brew install --cask ytmusic`로
      설치했을 때는 cask의 `postflight`가 자동으로 격리 속성을 제거하므로 위 Gatekeeper 경고 없이
      바로 실행되는지 확인한다. tap 저장소가 아직 없다면 이 항목은 "보류"로 기록한다.

## 결과 기록

각 대항목 실행 후 아래 표에 `PASS` / `FAIL(원인)` / `보류(이유)`를 채운다.

| # | 절 | 결과 | 비고 |
|---|---|---|---|
| 0 | 빌드 (테스트 + `npm run dist`) | | |
| 1 | 실행과 렌더링 (dev / packaged) | | |
| 2 | Google 로그인 및 세션 유지 | | |
| 3 | 창 상태 복원, hide-on-close, 단일 인스턴스, 최소화 복원 3경로 | | |
| 4 | 트레이 아이콘 및 메뉴 5항목 | | |
| 5 | 설정 메뉴 체크박스 및 영속성 | | |
| 6 | 미디어키 (OFF/ON/실패 경로) | | |
| 7 | 외부 링크 / 내부 내비게이션 | | |
| 8 | 오프라인 페이지 및 다시 시도 | | |
| 9 | DMG 설치, Gatekeeper, 패키징 빌드에서의 트레이/오프라인 | | |

FAIL이 있으면 해당 소스로 돌아가 수정한 뒤 그 항목만 다시 검증하고 표를 갱신한다.
