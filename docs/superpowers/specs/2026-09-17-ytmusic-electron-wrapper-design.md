# YouTube Music Electron Wrapper — 설계 문서

작성일: 2026-09-17

## 1. 목표

YouTube Music 웹(https://music.youtube.com)을 macOS(1순위)와 Windows(2순위)에서 실행 가능한 데스크톱 앱으로 제공한다.
내부는 웹을 그대로 사용하고, Electron은 껍데기 역할만 한다. 개인 용도로 만들되 GitHub에 오픈소스로 공개한다.

## 2. 범위

### 포함
- YouTube Music 웹을 BrowserWindow에서 직접 로드
- Google 로그인 정상 동작 (임베디드 브라우저 차단 우회)
- 재실행 시 로그인 세션 유지
- 외부 링크는 OS 기본 브라우저로 열기
- 창 크기·위치 기억
- 미디어 키(재생/일시정지/다음/이전) 연동
- macOS에서 창을 닫아도 재생 유지, Dock/트레이에서 복원
- 단일 인스턴스 보장
- 앱 아이콘
- electron-builder로 macOS DMG/ZIP 빌드, Homebrew cask로 배포
- Windows 빌드 설정 포함 (검증 우선순위 낮음)

### 제외 (YAGNI)
- 광고 차단, 다운로더 (YouTube ToS 리스크, 영구 제외)
- 테마, 가사, 플러그인 시스템, 커스텀 타이틀바, 크로스페이드, 이퀄라이저, 원격 제어 API
- 자동 업데이트
- Apple 코드 서명·공증 (개발자 계정 없음, 후술)
- Linux 배포

### 2차 범위 (껍데기 완성 후 별도 스펙으로 진행)
공통 기반인 song-info 채널(preload에서 현재 곡 정보를 읽어 main으로 전달)을 먼저 만들고 그 위에 다음을 얹는다. 모두 pear-desktop(MIT) 구현을 참고하며 출처를 고지한다.
- SponsorBlock 구간 자동 스킵
- 곡 변경 데스크톱 알림
- 트레이 메뉴에 현재 곡 표시
- 앱 시작 시 자동재생 방지
- 지수 볼륨(저볼륨 구간 세밀 조절)
- 이후 후보: Discord Rich Presence, Last.fm 스크로블, 미니 플레이어(항상 위 + 작은 창), 추가 전역 단축키, 재생 속도

## 3. 기술 스택

| 항목 | 선택 |
|---|---|
| 언어 | TypeScript |
| 런타임 | Electron (최신 안정 버전) |
| 빌드 | electron-builder |
| 테스트 | vitest |
| 창 상태 저장 | electron-store (자체 구현, electron-window-state는 2018년 이후 미유지보수) |
| 패키지 매니저 | npm |

## 4. 구조

```
src/
  main/
    index.ts          # 앱 진입점: 단일 인스턴스 락, 생명주기, 모듈 조립
    window.ts         # BrowserWindow 생성, 세션 파티션, 창 상태 복원
    user-agent.ts     # UA 위장 및 accounts.google.com 재시도 예외
    navigation.ts     # 허용 도메인 판정, setWindowOpenHandler / will-navigate
    media-keys.ts     # globalShortcut 미디어키 등록 → 렌더러 제어
    tray.ts           # 트레이 아이콘 및 메뉴 (열기 / 재생·일시정지 / 종료)
    menu.ts           # macOS 앱 메뉴 (Cmd+Q 종료 포함)
  preload/
    index.ts          # contextBridge로 재생 제어 함수만 노출
build/
  icon.icns / icon.ico / icon.png
docs/superpowers/specs/
```

각 모듈은 하나의 책임만 가지며, `index.ts`가 조립한다. 순수 로직(도메인 판정, UA 문자열 선택)은 Electron API에 의존하지 않는 함수로 분리해 단위 테스트한다.

## 5. 핵심 동작

### 5.1 창 및 세션 (`window.ts`)
- `session.fromPartition('persist:ytmusic')`로 영속 세션을 만들고 BrowserWindow의 `webPreferences.session`에 지정한다. 쿠키·로컬스토리지가 재실행 후에도 유지되어 로그인이 남는다.
- `webPreferences`: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `preload` 지정.
- 창 생성 후 `https://music.youtube.com`을 `loadURL`한다. `<webview>`나 WebContentsView는 사용하지 않는다.
- `electron-store`에 `bounds`와 `isMaximized`를 저장한다. `resize`/`move`(디바운스)와 `close` 시 저장하고, 복원 시 `screen.getDisplayMatching`으로 화면 밖 좌표를 보정한다. 기본 크기 1280×800.
- Electron 최신 버전에서는 `contextIsolation`, `nodeIntegration: false`, `sandbox`가 기본값이지만 의도를 문서화하기 위해 명시한다.

### 5.2 Google 로그인 우회 (`user-agent.ts`)
pear-desktop(구 th-ch/youtube-music)의 `src/index.ts` 방식을 따른다. 단, pear-desktop은 이 옵션이 기본 꺼짐이고 2022년 이후 로그인 차단 이슈가 없으므로 현재는 기본 UA로도 로그인이 되는 것으로 보인다. UA 위장은 무해하므로 기본 켜짐으로 두되, 설정으로 끌 수 있게 한다.
- 창 생성 시 `webContents.userAgent`와 `app.userAgentFallback`을 OS별 일반 Chrome UA 문자열로 교체한다. UA에서 `Electron/x.y.z` 토큰이 사라져 Google이 임베디드 브라우저로 판정하지 않는다.
- UA 문자열은 상수로 관리하며 Chrome 메이저 버전을 주기적으로 갱신한다.
- `session.webRequest.onBeforeSendHeaders`에서, 현재 페이지와 요청 URL이 모두 `https://accounts.google.com`으로 시작할 때만 원래 Electron UA로 되돌린다. 이는 로그인 실패 후 "다시 시도" 케이스를 위한 예외다.
- 로그인은 별도 팝업 없이 같은 창 안에서 진행된다. 로그인 후 YouTube Music으로 리다이렉트된다.

### 5.3 내비게이션 규칙 (`navigation.ts`)
- 순수 함수 `isAllowedUrl(url): boolean`이 허용 여부를 판정한다. 허용 호스트:
  - `music.youtube.com`
  - `accounts.google.com`, `*.google.com`
  - `www.youtube.com`, `youtube.com` (로그인 리다이렉트 경유)
  - `*.youtube.com` (consent 등), `*.googleapis.com`, `apis.google.com`
  - `*.googleusercontent.com`, `*.gstatic.com`, `*.ggpht.com` (리소스)
- `webContents.setWindowOpenHandler`: 허용 URL이면 같은 창에서 `loadURL`하고 `{ action: 'deny' }`. 비허용이면 `shell.openExternal` 후 deny. 새 창은 어떤 경우에도 만들지 않는다.
- `webContents.on('will-navigate')`: 비허용 URL이면 `preventDefault` 후 `shell.openExternal`.

### 5.4 미디어 키 (`media-keys.ts`, `preload/index.ts`)
- 기본 동작: `globalShortcut`을 **등록하지 않는다**. YouTube Music 웹이 `navigator.mediaSession` 핸들러를 등록하므로, Chromium의 MediaSession 연동을 통해 재생 시작 후에는 macOS Now Playing(MPRemoteCommandCenter)이 하드웨어 미디어키를 처리한다. macOS "지금 재생 중" 위젯도 같은 경로로 자동 연동된다. 동작 여부는 수동 검증한다.
- 이유: `globalShortcut`의 미디어키는 macOS에서 손쉬운 사용성(Accessibility) 권한이 필요하고, 다른 앱(Spotify, Music.app)의 미디어키를 가로채며, 등록 시 Electron 내부 경로가 바뀌어 Now Playing 처리와 충돌할 수 있다. pear-desktop도 같은 이유로 기본 꺼짐이다.
- 선택 옵션 "미디어키 강제 점유": 켜면 `globalShortcut.register`로 `MediaPlayPause`, `MediaNextTrack`, `MediaPreviousTrack`, `MediaStop`을 등록한다. 등록 전 `systemPreferences.isTrustedAccessibilityClient(true)`로 권한을 확인·요청하고, 종료 시 `unregisterAll()`한다.
- 트레이 메뉴와 강제 점유 옵션에서 쓰는 재생 제어는 메인이 `webContents.send('media:command', cmd)`로 전달하고, preload가 `ipcRenderer.on`을 함수로 감싸 `contextBridge`로 노출한다(Electron 29+는 `ipcRenderer` 객체 직접 노출 불가). 렌더러 측은 DOM 버튼 클릭 대신 `document.querySelector('video')`의 `play()`/`pause()`를 우선 사용하고, 다음/이전은 `navigator.mediaSession` 핸들러 또는 플레이어 버튼 선택자를 쓴다. 선택자는 preload 한 곳에 상수로 모은다.

### 5.5 macOS 창 닫기 및 트레이 (`index.ts`, `tray.ts`, `menu.ts`)
- macOS에서 창 `close` 이벤트는 `preventDefault` 후 `hide()`. 재생은 계속된다.
- `app.on('activate')`(Dock 클릭)와 트레이 메뉴 "열기"에서 `show()`.
- 종료는 트레이 메뉴 "종료" 또는 Cmd+Q(앱 메뉴)에서만 한다. 이때 `isQuitting` 플래그를 세워 close 핸들러가 hide하지 않도록 한다.
- Windows에서는 창 닫기 시 트레이로 최소화하는 동일 동작을 적용한다.
- 트레이 메뉴: 열기 / 재생·일시정지 / 다음 곡 / 이전 곡 / 종료.

### 5.6 단일 인스턴스 (`index.ts`)
- `app.requestSingleInstanceLock()` 실패 시 즉시 `app.quit()`.
- `second-instance` 이벤트에서 기존 창을 `show()` + `focus()`.

### 5.7 앱 아이콘
- `build/icon.png`(1024×1024)를 원본으로 두고 electron-builder가 icns/ico를 생성한다.
- 트레이 아이콘은 macOS용 템플릿 이미지(`trayTemplate.png` 16×16, `trayTemplate@2x.png` 32×32, 흑백)를 별도로 둔다. Tray 인스턴스는 GC 방지를 위해 모듈 스코프에 보관한다.

## 6. 보안
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`를 필수로 한다. 외부 사이트를 로드하므로 렌더러에 Node 접근을 절대 허용하지 않는다.
- preload는 미디어 명령 수신 리스너 하나만 노출한다.
- 새 창 생성을 전면 차단하고, 허용 목록 밖 URL은 항상 외부 브라우저로 보낸다.

## 7. 빌드 및 배포

### 7.1 electron-builder
- `appId`: `com.brad.ytmusic` (확정 시 변경 가능), 제품명 `YTMusic`.
- macOS 타깃: `dmg`, `zip`, 아키텍처 `arm64` + `x64`.
- Windows 타깃: `nsis` (설정만 포함, 검증은 후순위).
- 코드 서명: `mac.identity: "-"`로 **ad-hoc 서명**. (`null`은 서명 생략이며, Apple Silicon은 ad-hoc 서명조차 없으면 "손상됨"으로 실행되지 않는다.) `notarize: false`.
- 산출물은 GitHub Releases에 태그별로 업로드한다. 릴리스는 GitHub Actions 워크플로(`release.yml`)로 macOS 러너에서 빌드·업로드한다.

### 7.2 Homebrew cask
- 별도 tap 레포(`<github-user>/homebrew-tap`)에 `Casks/ytmusic.rb`를 둔다.
- cask는 GitHub Release의 arm64/x64 zip을 가리키며 `sha256`을 명시한다.
- 아키텍처별 URL은 `arch arm: "arm64", intel: "x64"`와 `sha256 arm:, intel:` 문법을 쓴다.
- 격리 해제는 cask 안의 `postflight`에서 처리한다:
  ```ruby
  postflight do
    system "xattr", "-r", "-d", "com.apple.quarantine", "#{appdir}/YTMusic.app"
  end
  ```
  (`--no-quarantine` 플래그는 Homebrew 5.0에서 폐지되어 현재 사용할 수 없다. 개인 tap은 공식 cask의 Gatekeeper 정책 적용을 받지 않는다.)
- 설치 안내:
  ```
  brew tap <github-user>/tap
  brew install --cask ytmusic
  ```
- 릴리스마다 버전과 sha256을 갱신한다. 초기에는 수동 갱신, 이후 GitHub Actions로 자동화 가능(범위 밖).

### 7.3 미서명 앱 제약
- Apple Developer 계정이 없어 Gatekeeper 경고("확인되지 않은 개발자" 또는 "손상됨")가 뜬다.
- 대응: brew 설치 시 cask `postflight`가 격리 속성을 제거한다. DMG로 직접 설치한 사용자를 위해 README에 수동 해제 명령 `xattr -cr /Applications/YTMusic.app`을 적는다.
- 추후 계정이 생기면 electron-builder에 `identity`와 `notarize` 설정만 추가하면 되도록 설정 구조를 잡는다.

## 8. 에러 처리
- 네트워크 오류로 페이지 로드 실패(`did-fail-load`, `isMainFrame === true`인 경우만, `errorCode === -3` ERR_ABORTED는 무시) 시 간단한 오프라인 안내 HTML을 로드하고 "다시 시도" 버튼을 둔다.
- 강제 점유 옵션의 미디어키 등록 실패(권한 미허용, 다른 앱이 선점)는 경고 로그만 남기고 앱은 정상 실행한다.
- 트레이 아이콘 파일 누락 시 트레이 없이 실행한다 (macOS는 Dock으로 복원 가능).

## 9. 테스트

### 단위 테스트 (vitest)
- `navigation.ts`의 `isAllowedUrl`: 허용 호스트, 서브도메인, 비허용 호스트, 잘못된 URL.
- `user-agent.ts`의 UA 선택 함수: OS별 문자열 반환, `Electron` 토큰 미포함.
- `user-agent.ts`의 재시도 예외 판정 함수: 페이지 URL과 요청 URL 조합.
- 미디어 명령 → 선택자 매핑.

### 수동 검증 체크리스트
1. 앱 실행 → 로그인 화면 → Google 로그인 성공 → YouTube Music 진입
2. 앱 종료 후 재실행 시 로그인 유지
3. "YouTube에서 보기" 등 외부 링크가 기본 브라우저에서 열림
4. 창 크기·위치 변경 후 재실행 시 복원
5. 재생 시작 후 하드웨어 미디어키로 재생/일시정지/다음/이전 동작, macOS 지금 재생 중 위젯에 곡 정보 표시
6. macOS 창 닫기 후 재생 유지, Dock 클릭으로 복원, Cmd+Q로 종료
7. 앱 두 번 실행 시 기존 창이 포커스됨
8. `brew install --cask`로 설치 후 Gatekeeper 경고 없이 실행 성공

## 10. 참고
- pear-devs/pear-desktop (구 th-ch/youtube-music, MIT) `src/index.ts`: UA 위장, `onBeforeSendHeaders` 재시도 예외, 단일 인스턴스 락 구현. 코드 차용 시 저작권 고지(Copyright (c) th-ch, MIT) 필요.
- Electron globalShortcut 문서: macOS 미디어키의 Accessibility 권한 요구 — https://www.electronjs.org/docs/latest/api/global-shortcut
- electron-builder mac 서명 옵션 — https://www.electron.build/docs/mac/
- Homebrew `--no-quarantine` 폐지 — https://github.com/Homebrew/brew/issues/20755
- Homebrew Cask Cookbook — https://docs.brew.sh/Cask-Cookbook
