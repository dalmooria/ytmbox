# YTMusic Electron Wrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** music.youtube.com을 그대로 로드하는 macOS 우선 Electron 데스크톱 앱을 만들고, ad-hoc 서명된 DMG/ZIP을 GitHub Releases와 Homebrew 개인 tap으로 배포할 수 있게 한다.

**Architecture:** 메인 프로세스는 `src/main/`의 단일 책임 모듈(window, navigation, user-agent, settings, tray, menu, media-keys, offline)을 `index.ts`가 조립한다. Electron API에 의존하지 않는 판정 로직은 `src/main/policy/`에 순수 함수로 두고 vitest로 테스트한다. 렌더러는 YouTube Music 웹 그대로이며, 샌드박스 preload는 IPC로 받은 재생 명령을 DOM에 적용하는 리스너 하나만 가진다.

**Tech Stack:** TypeScript 5, Electron 44, electron-builder 26, electron-store 8 (CommonJS), vitest 5, tsc 단독 컴파일(번들러 없음), GitHub Actions, Homebrew cask.

**Spec:** `docs/superpowers/specs/2026-09-17-ytmusic-electron-wrapper-design.md`

## Global Constraints

- 지원 OS: macOS 13 Ventura 이상 (arm64 + x64), Windows 10 이상(2순위).
- 제품명 `YTMusic`, appId `com.brad.ytmusic`, 산출물 파일명 `YTMusic-<version>-<arch>.zip` / `.dmg` (arch = `arm64` | `x64`).
- `webPreferences`는 반드시 `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- 세션 파티션은 `persist:ytmusic`.
- 새 창(BrowserWindow) 생성은 메인 창 하나뿐. `setWindowOpenHandler`는 항상 `{ action: 'deny' }`.
- `globalShortcut` 미디어키는 기본 미등록. 설정 `forceMediaKeys`가 true일 때만 등록.
- UA 위장은 설정 `overrideUserAgent` 기본 true.
- macOS 코드 서명은 `identity: "-"` (ad-hoc), `notarize: false`.
- 광고 차단, 다운로더, 자동 업데이트, 플러그인, 테마는 구현하지 않는다.
- 샌드박스 preload는 상대 경로 `require`가 불가능하므로 `src/preload/index.ts`는 외부 import 없이 자기완결적으로 작성한다. 채널명과 선택자 리터럴은 `src/shared/media.ts`와 동일하게 유지한다.
- 모든 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 줄을 붙인다.

## File Structure

```
package.json                 # 스크립트, 의존성, main 진입점
tsconfig.json                # src → dist CommonJS 컴파일
vitest.config.ts             # src/**/*.test.ts
electron-builder.yml         # 패키징 설정
.gitignore
LICENSE                      # MIT
THIRD_PARTY_NOTICES.md       # pear-desktop(th-ch) 출처 고지
README.md
scripts/make-icons.js        # 의존성 없는 플레이스홀더 아이콘 생성기
build/icon.png               # 1024×1024 앱 아이콘 원본 (electron-builder가 icns/ico 생성)
assets/trayTemplate.png      # 16×16 트레이 템플릿
assets/trayTemplate@2x.png   # 32×32
assets/offline.html          # 오프라인 폴백 페이지
homebrew/ytmusic.rb          # tap 레포에 복사할 cask 템플릿
.github/workflows/ci.yml     # push/PR 시 test + build
.github/workflows/release.yml# v* 태그 시 mac 빌드 → Release 첨부
src/shared/media.ts          # MediaCommand 타입, 채널명, 선택자 (main 측 사용)
src/main/policy/url.ts       # isAllowedUrl (순수)
src/main/policy/user-agent.ts# pickUserAgent, shouldRestoreOriginalUa (순수)
src/main/policy/window-bounds.ts # fitBoundsToDisplays (순수)
src/main/settings.ts         # electron-store 래퍼 (overrideUserAgent, forceMediaKeys, windowState)
src/main/user-agent.ts       # UA 위장 Electron 연결
src/main/navigation.ts       # setWindowOpenHandler / will-navigate 연결
src/main/window.ts           # BrowserWindow 생성, 세션, 창 상태 저장/복원, hide-on-close
src/main/offline.ts          # did-fail-load → offline.html
src/main/media-keys.ts       # forceMediaKeys 옵션용 globalShortcut
src/main/tray.ts             # Tray 생성 및 메뉴
src/main/menu.ts             # 앱 메뉴 + Settings 체크박스
src/main/index.ts            # 단일 인스턴스, 생명주기, 조립
src/preload/index.ts         # media:command 수신 → DOM 제어
```

---

### Task 1: 프로젝트 스캐폴드와 최소 실행 창

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/main/index.ts`, `src/main/policy/smoke.test.ts`

**Interfaces:**
- Produces: `npm run build`(tsc → `dist/`), `npm start`, `npm test` 스크립트. 이후 모든 태스크가 이 스크립트를 사용한다.

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "ytmusic",
  "productName": "YTMusic",
  "version": "0.1.0",
  "description": "YouTube Music desktop wrapper",
  "main": "dist/main/index.js",
  "license": "MIT",
  "author": "Brad",
  "private": true,
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "npm run build && electron .",
    "test": "vitest run",
    "icons": "node scripts/make-icons.js",
    "dist": "npm run build && electron-builder --mac --publish never",
    "dist:win": "npm run build && electron-builder --win --publish never"
  },
  "dependencies": {
    "electron-store": "^8.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.0",
    "electron": "^44.4.2",
    "electron-builder": "^26.15.3",
    "typescript": "^5.6.0",
    "vitest": "^5.0.1"
  }
}
```

- [ ] **Step 2: tsconfig.json 작성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022", "DOM"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 3: vitest.config.ts와 .gitignore 작성**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

`.gitignore`:
```
node_modules/
dist/
release/
*.log
.DS_Store
```

- [ ] **Step 4: 스모크 테스트 작성**

`src/main/policy/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 의존성 설치 후 테스트 실행**

Run: `npm install && npm test`
Expected: `1 passed`

- [ ] **Step 6: 최소 메인 진입점 작성**

`src/main/index.ts`:
```ts
import { app, BrowserWindow } from 'electron';

const YTMUSIC_URL = 'https://music.youtube.com';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  void win.loadURL(YTMUSIC_URL);
  return win;
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 7: 빌드 및 실행 확인**

Run: `npm run build && ls dist/main/index.js`
Expected: 파일 존재, tsc 오류 없음.

Run: `npm start` (창이 열리고 YouTube Music이 보이면 Cmd+Q로 종료)
Expected: YouTube Music 웹이 창 안에 로드됨.

- [ ] **Step 8: 커밋**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/
git commit -m "feat: scaffold Electron + TypeScript project with minimal window

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: URL 허용 정책 (순수 함수)

**Files:**
- Create: `src/main/policy/url.ts`, `src/main/policy/url.test.ts`
- Delete: `src/main/policy/smoke.test.ts`

**Interfaces:**
- Produces: `isAllowedUrl(raw: string): boolean` — https이고 허용 호스트일 때만 true.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/main/policy/url.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAllowedUrl } from './url';

describe('isAllowedUrl', () => {
  it.each([
    'https://music.youtube.com/',
    'https://music.youtube.com/watch?v=abc',
    'https://accounts.google.com/ServiceLogin',
    'https://myaccount.google.com/',
    'https://www.youtube.com/signin',
    'https://youtube.com/',
    'https://consent.youtube.com/m',
    'https://apis.google.com/js/api.js',
    'https://www.googleapis.com/x',
    'https://lh3.googleusercontent.com/a.png',
    'https://www.gstatic.com/x.js',
    'https://yt3.ggpht.com/a.jpg',
  ])('allows %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/',
    'https://evil.com/?next=music.youtube.com',
    'https://fakegoogle.com/',
    'https://google.com.evil.net/',
    'http://music.youtube.com/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    '',
  ])('blocks %s', (url) => {
    expect(isAllowedUrl(url)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `rm src/main/policy/smoke.test.ts && npm test`
Expected: FAIL — `Cannot find module './url'`

- [ ] **Step 3: 구현**

`src/main/policy/url.ts`:
```ts
const EXACT_HOSTS: ReadonlySet<string> = new Set([
  'music.youtube.com',
  'accounts.google.com',
  'www.youtube.com',
  'youtube.com',
  'apis.google.com',
]);

const SUFFIX_HOSTS: readonly string[] = [
  '.google.com',
  '.youtube.com',
  '.googleapis.com',
  '.googleusercontent.com',
  '.gstatic.com',
  '.ggpht.com',
];

/** 앱 창 안에서 열어도 되는 URL인지 판정한다. https + 허용 호스트만 true. */
export function isAllowedUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (EXACT_HOSTS.has(host)) return true;
  return SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 모든 케이스 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/main/policy/
git commit -m "feat: add URL allow-list policy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: 내비게이션 연결 (새 창 차단, 외부 링크는 기본 브라우저)

**Files:**
- Create: `src/main/navigation.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `isAllowedUrl` (Task 2)
- Produces: `attachNavigationPolicy(win: BrowserWindow): void`

- [ ] **Step 1: navigation.ts 작성**

```ts
import { BrowserWindow, shell } from 'electron';
import { isAllowedUrl } from './policy/url';

/**
 * 새 창은 절대 만들지 않는다. 허용 URL은 같은 창에서 열고,
 * 나머지는 OS 기본 브라우저로 보낸다.
 */
export function attachNavigationPolicy(win: BrowserWindow): void {
  const { webContents } = win;

  webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      void webContents.loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return; // 오프라인 폴백 페이지(Task 9)
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });
}
```

- [ ] **Step 2: index.ts에 연결**

`src/main/index.ts`의 `createWindow`에서 `loadURL` 직전에 호출:
```ts
import { app, BrowserWindow } from 'electron';
import { attachNavigationPolicy } from './navigation';

const YTMUSIC_URL = 'https://music.youtube.com';

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  attachNavigationPolicy(win);
  void win.loadURL(YTMUSIC_URL);
  return win;
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
```

- [ ] **Step 3: 수동 확인**

Run: `npm start`
- 곡 우클릭 → "YouTube에서 보기"(또는 공유 → 링크 열기)가 기본 브라우저에서 열리고 앱 안에 새 창이 생기지 않는지 확인.
- 앱 안에서 다른 곡/앨범으로 이동은 정상 동작.

- [ ] **Step 4: 커밋**

```bash
git add src/main/navigation.ts src/main/index.ts
git commit -m "feat: block new windows and route external links to system browser

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: User-Agent 정책 (순수 함수) + 연결

**Files:**
- Create: `src/main/policy/user-agent.ts`, `src/main/policy/user-agent.test.ts`, `src/main/user-agent.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Produces:
  - `pickUserAgent(platform: string, chromeVersion: string): string`
  - `shouldRestoreOriginalUa(pageUrl: string, requestUrl: string): boolean`
  - `applyUserAgentSpoof(win: BrowserWindow): void` — `loadURL` 전에 호출해야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/main/policy/user-agent.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pickUserAgent, shouldRestoreOriginalUa } from './user-agent';

describe('pickUserAgent', () => {
  it('returns a macOS Chrome UA on darwin', () => {
    const ua = pickUserAgent('darwin', '130.0.6723.152');
    expect(ua).toContain('Macintosh; Intel Mac OS X');
    expect(ua).toContain('Chrome/130.0.6723.152');
    expect(ua).toContain('Safari/537.36');
  });

  it('returns a Windows UA on win32', () => {
    expect(pickUserAgent('win32', '130.0.0.0')).toContain('Windows NT 10.0; Win64; x64');
  });

  it('returns a Linux UA for anything else', () => {
    expect(pickUserAgent('linux', '130.0.0.0')).toContain('X11; Linux x86_64');
    expect(pickUserAgent('freebsd', '130.0.0.0')).toContain('X11; Linux x86_64');
  });

  it('never contains the Electron token', () => {
    for (const p of ['darwin', 'win32', 'linux']) {
      expect(pickUserAgent(p, '130.0.0.0')).not.toMatch(/Electron/i);
    }
  });
});

describe('shouldRestoreOriginalUa', () => {
  const login = 'https://accounts.google.com/signin/v2';
  it('is true only when page and request are both on accounts.google.com', () => {
    expect(shouldRestoreOriginalUa(login, 'https://accounts.google.com/_/x')).toBe(true);
  });
  it('is false when the page is YouTube Music', () => {
    expect(shouldRestoreOriginalUa('https://music.youtube.com/', 'https://accounts.google.com/_/x')).toBe(false);
  });
  it('is false when the request goes elsewhere', () => {
    expect(shouldRestoreOriginalUa(login, 'https://www.gstatic.com/a.js')).toBe(false);
  });
  it('is false for empty page URL (before first load)', () => {
    expect(shouldRestoreOriginalUa('', 'https://accounts.google.com/')).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './user-agent'`

- [ ] **Step 3: 순수 함수 구현**

`src/main/policy/user-agent.ts`:
```ts
const ACCOUNTS_PREFIX = 'https://accounts.google.com';

/**
 * Electron 토큰이 없는 일반 Chrome UA를 만든다.
 * chromeVersion은 process.versions.chrome을 넘겨 Electron 내장 버전과 맞춘다.
 * 방식 출처: pear-desktop (구 th-ch/youtube-music, MIT) src/index.ts
 */
export function pickUserAgent(platform: string, chromeVersion: string): string {
  const tail = `AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  switch (platform) {
    case 'darwin':
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ${tail}`;
    case 'win32':
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) ${tail}`;
    default:
      return `Mozilla/5.0 (X11; Linux x86_64) ${tail}`;
  }
}

/**
 * 로그인 실패 후 "다시 시도" 케이스: 현재 페이지와 요청이 모두
 * accounts.google.com일 때만 원래 Electron UA로 되돌린다.
 */
export function shouldRestoreOriginalUa(pageUrl: string, requestUrl: string): boolean {
  return pageUrl.startsWith(ACCOUNTS_PREFIX) && requestUrl.startsWith(ACCOUNTS_PREFIX);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Electron 연결 작성**

`src/main/user-agent.ts`:
```ts
import { app, BrowserWindow } from 'electron';
import { pickUserAgent, shouldRestoreOriginalUa } from './policy/user-agent';

/** loadURL 이전에 호출. 세션 단위로 UA를 바꾸고 재시도 예외 훅을 건다. */
export function applyUserAgentSpoof(win: BrowserWindow): void {
  const { webContents } = win;
  const originalUa = webContents.userAgent;
  const spoofedUa = pickUserAgent(process.platform, process.versions.chrome);

  webContents.userAgent = spoofedUa;
  app.userAgentFallback = spoofedUa;
  webContents.session.setUserAgent(spoofedUa);

  webContents.session.webRequest.onBeforeSendHeaders((details, callback) => {
    if (shouldRestoreOriginalUa(webContents.getURL(), details.url)) {
      details.requestHeaders['User-Agent'] = originalUa;
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}
```

- [ ] **Step 6: index.ts에 연결 (아직 설정 없이 항상 켬)**

`createWindow` 안, `attachNavigationPolicy(win);` 앞에 추가:
```ts
import { applyUserAgentSpoof } from './user-agent';
// ...
  applyUserAgentSpoof(win);
  attachNavigationPolicy(win);
  void win.loadURL(YTMUSIC_URL);
```

- [ ] **Step 7: 수동 확인**

Run: `npm start` → 로그인 버튼 → Google 계정 로그인 진행.
Expected: "이 브라우저 또는 앱은 안전하지 않을 수 있습니다" 없이 로그인 완료 후 YouTube Music으로 돌아옴.

- [ ] **Step 8: 커밋**

```bash
git add src/main/policy/user-agent.ts src/main/policy/user-agent.test.ts src/main/user-agent.ts src/main/index.ts
git commit -m "feat: spoof Chrome user agent to allow Google login

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: 설정 저장소 (electron-store)

**Files:**
- Create: `src/main/settings.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Produces:
  ```ts
  interface WindowState { bounds: { x: number; y: number; width: number; height: number }; isMaximized: boolean }
  interface Schema { overrideUserAgent: boolean; forceMediaKeys: boolean; windowState: WindowState | null }
  const settings: Store<Schema>  // .get(key), .set(key, value)
  ```
- 이후 Task 6(windowState), Task 10(forceMediaKeys), Task 11(메뉴 토글)이 사용한다.

- [ ] **Step 1: settings.ts 작성**

```ts
import Store from 'electron-store';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds: Rect;
  isMaximized: boolean;
}

export interface Schema {
  /** 일반 Chrome UA로 위장 (Google 로그인 차단 우회). 변경 시 재시작 필요. */
  overrideUserAgent: boolean;
  /** globalShortcut으로 하드웨어 미디어키를 강제 점유. 기본 꺼짐. */
  forceMediaKeys: boolean;
  windowState: WindowState | null;
}

export const settings = new Store<Schema>({
  name: 'settings',
  defaults: {
    overrideUserAgent: true,
    forceMediaKeys: false,
    windowState: null,
  },
});
```

- [ ] **Step 2: UA 위장을 설정에 연동**

`src/main/index.ts`의 `createWindow`:
```ts
import { settings } from './settings';
// ...
  if (settings.get('overrideUserAgent')) {
    applyUserAgentSpoof(win);
  }
  attachNavigationPolicy(win);
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build && npm start`
Expected: 컴파일 오류 없음. 종료 후 `~/Library/Application Support/ytmusic/settings.json`이 생성되고 기본값 3개가 들어 있음.

Run: `cat ~/Library/Application\ Support/ytmusic/settings.json`
Expected: `{"overrideUserAgent":true,"forceMediaKeys":false,"windowState":null}`

- [ ] **Step 4: 커밋**

```bash
git add src/main/settings.ts src/main/index.ts
git commit -m "feat: add persistent settings store

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: 창 상태 기억 + 영속 세션 + hide-on-close (window.ts)

**Files:**
- Create: `src/main/policy/window-bounds.ts`, `src/main/policy/window-bounds.test.ts`, `src/main/window.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `settings`, `Rect`, `WindowState` (Task 5), `applyUserAgentSpoof` (Task 4), `attachNavigationPolicy` (Task 3)
- Produces:
  - `fitBoundsToDisplays(saved: Rect | null, displays: Rect[], fallback: { width: number; height: number }): Rect | { width: number; height: number }`
  - `createMainWindow(opts: { isQuitting: () => boolean }): BrowserWindow`
  - `YTMUSIC_URL` 상수 export

- [ ] **Step 1: 실패하는 테스트 작성**

`src/main/policy/window-bounds.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fitBoundsToDisplays } from './window-bounds';

const primary = { x: 0, y: 0, width: 1920, height: 1080 };
const secondary = { x: 1920, y: 0, width: 1920, height: 1080 };
const fallback = { width: 1280, height: 800 };

describe('fitBoundsToDisplays', () => {
  it('returns fallback size when nothing is saved', () => {
    expect(fitBoundsToDisplays(null, [primary], fallback)).toEqual(fallback);
  });

  it('keeps saved bounds when they lie inside a display', () => {
    const saved = { x: 100, y: 100, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(saved);
  });

  it('keeps saved bounds on a secondary display', () => {
    const saved = { x: 2000, y: 50, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary, secondary], fallback)).toEqual(saved);
  });

  it('falls back when the saved window is entirely off-screen (display unplugged)', () => {
    const saved = { x: 2000, y: 50, width: 1000, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(fallback);
  });

  it('falls back when saved bounds have non-positive size', () => {
    const saved = { x: 0, y: 0, width: 0, height: 700 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual(fallback);
  });

  it('clamps a window larger than its display down to the display size', () => {
    const saved = { x: 0, y: 0, width: 5000, height: 4000 };
    expect(fitBoundsToDisplays(saved, [primary], fallback)).toEqual({
      x: 0, y: 0, width: 1920, height: 1080,
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './window-bounds'`

- [ ] **Step 3: 순수 함수 구현**

`src/main/policy/window-bounds.ts`:
```ts
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * 저장된 창 위치가 현재 연결된 디스플레이 중 하나와 겹치면 그대로(크기는 해당 디스플레이 이하로 클램프),
 * 아니면 fallback 크기만 반환해 Electron이 화면 중앙에 배치하게 한다.
 */
export function fitBoundsToDisplays(
  saved: Rect | null,
  displays: Rect[],
  fallback: Size,
): Rect | Size {
  if (!saved || saved.width <= 0 || saved.height <= 0) return fallback;
  const display = displays.find((d) => intersects(saved, d));
  if (!display) return fallback;
  return {
    x: saved.x,
    y: saved.y,
    width: Math.min(saved.width, display.width),
    height: Math.min(saved.height, display.height),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: window.ts 작성**

```ts
import { app, BrowserWindow, screen, session } from 'electron';
import path from 'node:path';
import { fitBoundsToDisplays } from './policy/window-bounds';
import { settings } from './settings';
import { applyUserAgentSpoof } from './user-agent';
import { attachNavigationPolicy } from './navigation';

export const YTMUSIC_URL = 'https://music.youtube.com';
const PARTITION = 'persist:ytmusic';
const DEFAULT_SIZE = { width: 1280, height: 800 };
const SAVE_DEBOUNCE_MS = 300;

export interface MainWindowOptions {
  /** true면 close 이벤트에서 hide 대신 실제로 닫는다. */
  isQuitting: () => boolean;
}

export function createMainWindow(opts: MainWindowOptions): BrowserWindow {
  const saved = settings.get('windowState');
  const displays = screen.getAllDisplays().map((d) => d.workArea);
  const bounds = fitBoundsToDisplays(saved?.bounds ?? null, displays, DEFAULT_SIZE);

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 320,
    title: 'YTMusic',
    show: false,
    webPreferences: {
      session: session.fromPartition(PARTITION),
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (saved?.isMaximized) win.maximize();

  if (settings.get('overrideUserAgent')) {
    applyUserAgentSpoof(win);
  }
  attachNavigationPolicy(win);
  attachWindowStatePersistence(win);

  win.on('close', (event) => {
    if (opts.isQuitting()) return;
    event.preventDefault();
    win.hide();
  });

  win.once('ready-to-show', () => win.show());
  void win.loadURL(YTMUSIC_URL);
  return win;
}

function attachWindowStatePersistence(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;

  const save = (): void => {
    if (win.isDestroyed()) return;
    settings.set('windowState', {
      bounds: win.getNormalBounds(),
      isMaximized: win.isMaximized(),
    });
  };

  const scheduleSave = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, SAVE_DEBOUNCE_MS);
  };

  win.on('resize', scheduleSave);
  win.on('move', scheduleSave);
  win.on('maximize', scheduleSave);
  win.on('unmaximize', scheduleSave);
  win.on('close', save);
  app.on('before-quit', save);
}
```

- [ ] **Step 6: index.ts를 조립 코드로 교체**

`src/main/index.ts` 전체:
```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

app.on('before-quit', () => {
  quitting = true;
});

app.whenReady().then(() => {
  mainWindow = createMainWindow({ isQuitting: () => quitting });
});

app.on('activate', () => {
  mainWindow?.show();
});

app.on('window-all-closed', () => {
  // macOS는 창이 숨겨져도 앱을 유지한다. 다른 OS도 트레이 동작을 맞추므로 종료하지 않는다.
});
```

- [ ] **Step 7: preload 자리 만들기 (빈 파일, Task 8에서 채움)**

`src/preload/index.ts`:
```ts
// Task 8에서 media:command 리스너를 추가한다.
export {};
```

- [ ] **Step 8: 수동 확인**

Run: `npm run build && npm start`
1. 창을 옮기고 크기를 바꾼 뒤 Cmd+Q. 다시 `npm start` → 같은 위치·크기로 복원.
2. 로그인 상태에서 Cmd+Q 후 재실행 → 로그인 유지.
3. 창 닫기(빨간 버튼) → 창이 사라지지만 재생 중이면 소리가 계속 남. Dock 아이콘 클릭 → 창 복귀.
4. `cat ~/Library/Application\ Support/ytmusic/settings.json` → `windowState`에 bounds 저장됨.

- [ ] **Step 9: 커밋**

```bash
git add src/main/policy/window-bounds.ts src/main/policy/window-bounds.test.ts src/main/window.ts src/main/index.ts src/preload/index.ts
git commit -m "feat: persistent session, window state memory and hide-on-close

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: 단일 인스턴스 보장

**Files:**
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `createMainWindow` (Task 6)

- [ ] **Step 1: 단일 인스턴스 락 추가**

`src/main/index.ts` 전체:
```ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    mainWindow.show();
    mainWindow.focus();
  });

  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow({ isQuitting: () => quitting });
  });

  app.on('activate', () => {
    mainWindow?.show();
  });

  app.on('window-all-closed', () => {
    // 창이 숨겨져도 앱을 유지한다 (트레이/Dock에서 복원).
  });
}
```

- [ ] **Step 2: 수동 확인**

Run: 터미널 1에서 `npm start`, 터미널 2에서 `npx electron .`
Expected: 두 번째 프로세스는 즉시 종료되고 첫 창이 앞으로 옴. 창을 숨긴 상태에서 두 번째 실행하면 창이 다시 보임.

- [ ] **Step 3: 커밋**

```bash
git add src/main/index.ts
git commit -m "feat: enforce single instance

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: 미디어 명령 채널 (shared + preload)

**Files:**
- Create: `src/shared/media.ts`, `src/shared/media.test.ts`
- Modify: `src/preload/index.ts`

**Interfaces:**
- Produces (main 측):
  ```ts
  type MediaCommand = 'playpause' | 'next' | 'previous' | 'stop'
  const MEDIA_CHANNEL = 'media:command'
  const PLAYER_SELECTORS: Record<'next' | 'previous', string>
  function isMediaCommand(value: unknown): value is MediaCommand
  function sendMediaCommand(target: WebContents, cmd: MediaCommand): void
  ```
- preload는 같은 채널명·선택자를 리터럴로 가진다(샌드박스에서 상대 require 불가).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/shared/media.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isMediaCommand, MEDIA_CHANNEL, MEDIA_COMMANDS, PLAYER_SELECTORS } from './media';

describe('media command contract', () => {
  it('channel name is stable', () => {
    expect(MEDIA_CHANNEL).toBe('media:command');
  });

  it('lists exactly the four commands', () => {
    expect([...MEDIA_COMMANDS].sort()).toEqual(['next', 'playpause', 'previous', 'stop']);
  });

  it('isMediaCommand accepts only known commands', () => {
    expect(isMediaCommand('next')).toBe(true);
    expect(isMediaCommand('NEXT')).toBe(false);
    expect(isMediaCommand(42)).toBe(false);
    expect(isMediaCommand(undefined)).toBe(false);
  });

  it('has a selector for next and previous', () => {
    expect(PLAYER_SELECTORS.next).toContain('next-button');
    expect(PLAYER_SELECTORS.previous).toContain('previous-button');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './media'`

- [ ] **Step 3: shared/media.ts 구현**

```ts
import type { WebContents } from 'electron';

export const MEDIA_CHANNEL = 'media:command';

export const MEDIA_COMMANDS = ['playpause', 'next', 'previous', 'stop'] as const;
export type MediaCommand = (typeof MEDIA_COMMANDS)[number];

/** preload/index.ts의 리터럴과 반드시 동일하게 유지한다. */
export const PLAYER_SELECTORS = {
  next: 'ytmusic-player-bar .next-button',
  previous: 'ytmusic-player-bar .previous-button',
} as const;

export function isMediaCommand(value: unknown): value is MediaCommand {
  return typeof value === 'string' && (MEDIA_COMMANDS as readonly string[]).includes(value);
}

export function sendMediaCommand(target: WebContents, cmd: MediaCommand): void {
  if (target.isDestroyed()) return;
  target.send(MEDIA_CHANNEL, cmd);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: preload 작성 (자기완결, import 없음)**

`src/preload/index.ts`:
```ts
import { ipcRenderer } from 'electron';

// 샌드박스 preload는 상대 경로 require가 불가하므로 src/shared/media.ts의 값을 리터럴로 복제한다.
const MEDIA_CHANNEL = 'media:command';
type MediaCommand = 'playpause' | 'next' | 'previous' | 'stop';
const COMMANDS: readonly string[] = ['playpause', 'next', 'previous', 'stop'];
const PLAYER_SELECTORS = {
  next: 'ytmusic-player-bar .next-button',
  previous: 'ytmusic-player-bar .previous-button',
} as const;

function clickPlayerButton(selector: string): void {
  const el = document.querySelector<HTMLElement>(selector);
  el?.click();
}

function runMediaCommand(cmd: MediaCommand): void {
  const video = document.querySelector('video');
  switch (cmd) {
    case 'playpause':
      if (!video) return;
      if (video.paused) void video.play().catch(() => undefined);
      else video.pause();
      return;
    case 'stop':
      video?.pause();
      return;
    case 'next':
      clickPlayerButton(PLAYER_SELECTORS.next);
      return;
    case 'previous':
      clickPlayerButton(PLAYER_SELECTORS.previous);
      return;
  }
}

ipcRenderer.on(MEDIA_CHANNEL, (_event, cmd: unknown) => {
  if (typeof cmd === 'string' && COMMANDS.includes(cmd)) {
    runMediaCommand(cmd as MediaCommand);
  }
});
// 페이지(main world)에는 아무 API도 노출하지 않는다.
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build && ls dist/preload/index.js dist/shared/media.js`
Expected: 두 파일 존재.

- [ ] **Step 7: 수동 확인 (임시 DevTools)**

Run: `npm start` → 곡 재생 → 메뉴 View → Toggle Developer Tools → Console에서:
```js
// 메인 프로세스 콘솔이 아니라 렌더러이므로 직접 send는 못 한다. 대신 preload가 로드됐는지만 확인:
document.querySelector('ytmusic-player-bar .next-button') !== null
```
Expected: `true`. (실제 명령 전달은 Task 9 트레이 메뉴로 검증한다.)

- [ ] **Step 8: 커밋**

```bash
git add src/shared/ src/preload/index.ts
git commit -m "feat: add media command IPC contract and sandboxed preload handler

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: 트레이 아이콘·메뉴 + 플레이스홀더 아이콘 생성

**Files:**
- Create: `scripts/make-icons.js`, `build/icon.png`, `assets/trayTemplate.png`, `assets/trayTemplate@2x.png`, `src/main/tray.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `sendMediaCommand`, `MediaCommand` (Task 8)
- Produces: `createTray(handlers: TrayHandlers): Tray | null`
  ```ts
  interface TrayHandlers { onShow(): void; onCommand(cmd: MediaCommand): void; onQuit(): void }
  ```

- [ ] **Step 1: 의존성 없는 PNG 생성 스크립트 작성**

`scripts/make-icons.js`:
```js
// 플레이스홀더 아이콘 생성기. 외부 의존성 없음 (zlib만 사용).
// 나중에 디자인된 PNG로 덮어써도 된다.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** pixel(x, y) => [r, g, b, a] */
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inCircle(x, y, cx, cy, r) {
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= r * r;
}

// 앱 아이콘: 빨간 원 배경 + 흰 삼각형(재생) 느낌의 단순 도형
function appIcon(size) {
  return png(size, (x, y) => {
    const c = size / 2;
    if (!inCircle(x, y, c, c, size * 0.47)) return [0, 0, 0, 0];
    // 흰 삼각형: 좌변 x=0.38, 우끝 x=0.70, 세로 중심
    const nx = x / size, ny = y / size;
    const inTri = nx >= 0.38 && nx <= 0.70 && Math.abs(ny - 0.5) <= (0.70 - nx) * 0.62;
    return inTri ? [255, 255, 255, 255] : [255, 0, 0, 255];
  });
}

// 트레이 템플릿: 검은 삼각형만 (macOS가 색을 알아서 반전)
function trayIcon(size) {
  return png(size, (x, y) => {
    const nx = x / size, ny = y / size;
    const inTri = nx >= 0.25 && nx <= 0.80 && Math.abs(ny - 0.5) <= (0.80 - nx) * 0.7;
    return inTri ? [0, 0, 0, 255] : [0, 0, 0, 0];
  });
}

const root = path.join(__dirname, '..');
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), appIcon(1024));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate.png'), trayIcon(16));
fs.writeFileSync(path.join(root, 'assets', 'trayTemplate@2x.png'), trayIcon(32));
console.log('icons written: build/icon.png, assets/trayTemplate.png, assets/trayTemplate@2x.png');
```

- [ ] **Step 2: 아이콘 생성 및 확인**

Run: `npm run icons && file build/icon.png assets/trayTemplate.png assets/trayTemplate@2x.png`
Expected: 각각 `PNG image data, 1024 x 1024`, `16 x 16`, `32 x 32`, `8-bit/color RGBA`.

- [ ] **Step 3: tray.ts 작성**

```ts
import { app, Menu, nativeImage, Tray } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { MediaCommand } from '../shared/media';

export interface TrayHandlers {
  onShow(): void;
  onCommand(cmd: MediaCommand): void;
  onQuit(): void;
}

// GC로 트레이가 사라지지 않도록 모듈 스코프에 보관한다.
let tray: Tray | null = null;

function trayIconPath(): string {
  return path.join(app.getAppPath(), 'assets', 'trayTemplate.png');
}

/** 아이콘 파일이 없으면 null을 반환하고 트레이 없이 실행한다. */
export function createTray(handlers: TrayHandlers): Tray | null {
  const iconPath = trayIconPath();
  if (!fs.existsSync(iconPath)) {
    console.warn(`[tray] icon not found, running without tray: ${iconPath}`);
    return null;
  }

  const image = nativeImage.createFromPath(iconPath);
  image.setTemplateImage(true);

  tray = new Tray(image);
  tray.setToolTip('YTMusic');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '열기', click: () => handlers.onShow() },
      { type: 'separator' },
      { label: '재생 / 일시정지', click: () => handlers.onCommand('playpause') },
      { label: '다음 곡', click: () => handlers.onCommand('next') },
      { label: '이전 곡', click: () => handlers.onCommand('previous') },
      { type: 'separator' },
      { label: '종료', click: () => handlers.onQuit() },
    ]),
  );
  tray.on('click', () => handlers.onShow());
  return tray;
}
```

- [ ] **Step 4: index.ts에 트레이 연결**

`src/main/index.ts` 전체:
```ts
import { app, BrowserWindow } from 'electron';
import { sendMediaCommand } from '../shared/media';
import { createTray } from './tray';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function showMainWindow(): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.on('before-quit', () => {
    quitting = true;
  });

  app.whenReady().then(() => {
    mainWindow = createMainWindow({ isQuitting: () => quitting });

    createTray({
      onShow: showMainWindow,
      onCommand: (cmd) => {
        if (mainWindow) sendMediaCommand(mainWindow.webContents, cmd);
      },
      onQuit: () => app.quit(),
    });
  });

  app.on('activate', showMainWindow);

  app.on('window-all-closed', () => {
    // 창이 숨겨져도 앱을 유지한다 (트레이/Dock에서 복원).
  });
}
```

- [ ] **Step 5: 수동 확인**

Run: `npm run build && npm start`
1. 메뉴바에 삼각형 트레이 아이콘이 보임.
2. 곡 재생 후 트레이 → "재생 / 일시정지" → 멈춤. 다시 → 재생. "다음 곡" → 다음 트랙.
3. 창 닫기 → 트레이 "열기" → 창 복귀.
4. 트레이 "종료" → 앱 종료.

- [ ] **Step 6: 커밋**

```bash
git add scripts/make-icons.js build/icon.png assets/ src/main/tray.ts src/main/index.ts
git commit -m "feat: add tray with playback controls and placeholder icons

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: 앱 메뉴 + Settings 토글 + 미디어키 강제 점유 옵션

**Files:**
- Create: `src/main/media-keys.ts`, `src/main/menu.ts`
- Modify: `src/main/index.ts`

**Interfaces:**
- Consumes: `settings` (Task 5), `sendMediaCommand`, `MediaCommand` (Task 8)
- Produces:
  - `registerMediaKeys(send: (cmd: MediaCommand) => void): void`, `unregisterMediaKeys(): void`
  - `installApplicationMenu(opts: { onForceMediaKeysChange(enabled: boolean): void }): void`

- [ ] **Step 1: media-keys.ts 작성**

```ts
import { globalShortcut, systemPreferences } from 'electron';
import type { MediaCommand } from '../shared/media';

const ACCELERATORS: ReadonlyArray<readonly [string, MediaCommand]> = [
  ['MediaPlayPause', 'playpause'],
  ['MediaNextTrack', 'next'],
  ['MediaPreviousTrack', 'previous'],
  ['MediaStop', 'stop'],
];

/**
 * forceMediaKeys 옵션용. 기본 경로(Chromium MediaSession → macOS Now Playing)를 덮어쓰므로
 * 설정이 켜진 경우에만 호출한다. 실패는 경고 로그만 남긴다.
 */
export function registerMediaKeys(send: (cmd: MediaCommand) => void): void {
  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
    console.warn('[media-keys] accessibility permission not granted; media keys not registered');
    return;
  }
  for (const [accelerator, cmd] of ACCELERATORS) {
    const ok = globalShortcut.register(accelerator, () => send(cmd));
    if (!ok) console.warn(`[media-keys] failed to register ${accelerator} (taken by another app?)`);
  }
}

export function unregisterMediaKeys(): void {
  globalShortcut.unregisterAll();
}
```

- [ ] **Step 2: menu.ts 작성**

```ts
import { app, Menu, MenuItemConstructorOptions } from 'electron';
import { settings } from './settings';

export interface MenuOptions {
  onForceMediaKeysChange(enabled: boolean): void;
}

export function installApplicationMenu(opts: MenuOptions): void {
  const isMac = process.platform === 'darwin';

  const settingsSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Chrome User-Agent로 위장 (재시작 필요)',
      type: 'checkbox',
      checked: settings.get('overrideUserAgent'),
      click: (item) => settings.set('overrideUserAgent', item.checked),
    },
    {
      label: '미디어키 강제 점유 (다른 앱의 미디어키를 가로챔)',
      type: 'checkbox',
      checked: settings.get('forceMediaKeys'),
      click: (item) => {
        settings.set('forceMediaKeys', item.checked);
        opts.onForceMediaKeysChange(item.checked);
      },
    },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    { label: '설정', submenu: settingsSubmenu },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ role: 'quit' } as MenuItemConstructorOptions]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  app.setName('YTMusic');
}
```

- [ ] **Step 3: index.ts에 연결**

`src/main/index.ts` 전체:
```ts
import { app, BrowserWindow } from 'electron';
import { MediaCommand, sendMediaCommand } from '../shared/media';
import { registerMediaKeys, unregisterMediaKeys } from './media-keys';
import { installApplicationMenu } from './menu';
import { settings } from './settings';
import { createTray } from './tray';
import { createMainWindow } from './window';

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function showMainWindow(): void {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function dispatchMedia(cmd: MediaCommand): void {
  if (mainWindow) sendMediaCommand(mainWindow.webContents, cmd);
}

function applyForceMediaKeys(enabled: boolean): void {
  unregisterMediaKeys();
  if (enabled) registerMediaKeys(dispatchMedia);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showMainWindow);

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('will-quit', () => {
    unregisterMediaKeys();
  });

  app.whenReady().then(() => {
    installApplicationMenu({ onForceMediaKeysChange: applyForceMediaKeys });
    mainWindow = createMainWindow({ isQuitting: () => quitting });
    createTray({
      onShow: showMainWindow,
      onCommand: dispatchMedia,
      onQuit: () => app.quit(),
    });
    applyForceMediaKeys(settings.get('forceMediaKeys'));
  });

  app.on('activate', showMainWindow);

  app.on('window-all-closed', () => {
    // 창이 숨겨져도 앱을 유지한다 (트레이/Dock에서 복원).
  });
}
```

- [ ] **Step 4: 수동 확인**

Run: `npm run build && npm start`
1. 메뉴바에 "설정" 메뉴와 두 체크박스가 보임. UA 항목은 체크됨, 미디어키 항목은 해제됨.
2. 곡 재생 후 키보드 재생/일시정지 키 → 동작 (globalShortcut 없이, Now Playing 경로). 제어 센터 "지금 재생 중"에 곡 정보가 보임.
3. "미디어키 강제 점유" 체크 → macOS 접근성 권한 프롬프트. 허용 후 미디어키가 앱을 제어. 해제 → 등록 해제.
4. Cmd+Q → 종료.

- [ ] **Step 5: 커밋**

```bash
git add src/main/media-keys.ts src/main/menu.ts src/main/index.ts
git commit -m "feat: application menu with settings toggles and optional forced media keys

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: 오프라인 폴백 페이지

**Files:**
- Create: `assets/offline.html`, `src/main/offline.ts`
- Modify: `src/main/window.ts`

**Interfaces:**
- Consumes: `YTMUSIC_URL` (Task 6)
- Produces: `attachOfflineFallback(win: BrowserWindow): void`

- [ ] **Step 1: offline.html 작성**

`assets/offline.html`:
```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>YTMusic</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; height: 100vh; display: grid; place-items: center;
           background: #030303; color: #fff; font-family: -apple-system, system-ui, sans-serif; }
    main { text-align: center; padding: 24px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { color: #aaa; margin: 0 0 24px; }
    a { display: inline-block; padding: 10px 20px; border-radius: 999px;
        background: #f00; color: #fff; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <main>
    <h1>YouTube Music에 연결할 수 없습니다</h1>
    <p>네트워크 연결을 확인한 뒤 다시 시도하세요.</p>
    <a href="https://music.youtube.com">다시 시도</a>
  </main>
</body>
</html>
```

- [ ] **Step 2: offline.ts 작성**

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';

const ERR_ABORTED = -3;

/** 메인 프레임 로드 실패 시 오프라인 안내 페이지를 띄운다. 사용자 취소(-3)는 무시. */
export function attachOfflineFallback(win: BrowserWindow): void {
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, _validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === ERR_ABORTED) return;
    console.warn(`[offline] main frame failed to load: ${errorCode} ${errorDescription}`);
    void win.loadFile(path.join(app.getAppPath(), 'assets', 'offline.html'));
  });
}
```

- [ ] **Step 3: window.ts에 연결**

`createMainWindow` 안, `attachNavigationPolicy(win);` 다음 줄에:
```ts
import { attachOfflineFallback } from './offline';
// ...
  attachNavigationPolicy(win);
  attachOfflineFallback(win);
  attachWindowStatePersistence(win);
```

- [ ] **Step 4: 수동 확인**

Run: Wi-Fi를 끈 상태에서 `npm run build && npm start`
Expected: 오프라인 안내 페이지 표시. Wi-Fi를 켜고 "다시 시도" 클릭 → YouTube Music 로드. (file:// → https 이동은 Task 3의 will-navigate에서 file 출발을 허용하므로 통과한다.)

- [ ] **Step 5: 커밋**

```bash
git add assets/offline.html src/main/offline.ts src/main/window.ts
git commit -m "feat: show offline fallback page when main frame fails to load

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: electron-builder 설정과 로컬 macOS 빌드

**Files:**
- Create: `electron-builder.yml`
- Modify: `package.json` (없음, 스크립트는 Task 1에 이미 있음)

**Interfaces:**
- Produces: `npm run dist` → `release/YTMusic-<version>-arm64.dmg|zip`, `release/YTMusic-<version>-x64.dmg|zip`

- [ ] **Step 1: electron-builder.yml 작성**

```yaml
appId: com.brad.ytmusic
productName: YTMusic
copyright: Copyright © 2026 Brad
directories:
  output: release
  buildResources: build
files:
  - dist/**
  - assets/**
  - package.json
artifactName: ${productName}-${version}-${arch}.${ext}

mac:
  category: public.app-category.music
  icon: build/icon.png
  # Apple Developer 계정 없음: ad-hoc 서명. null은 서명 생략이며 Apple Silicon에서 실행 불가.
  identity: "-"
  notarize: false
  hardenedRuntime: false
  gatekeeperAssess: false
  target:
    - target: dmg
      arch: [arm64, x64]
    - target: zip
      arch: [arm64, x64]

dmg:
  sign: false

win:
  icon: build/icon.png
  target:
    - target: nsis
      arch: [x64]

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

- [ ] **Step 2: 로컬 빌드**

Run: `npm run dist`
Expected: 오류 없이 종료. `ls release/` 에 다음 4개 파일:
```
YTMusic-0.1.0-arm64.dmg
YTMusic-0.1.0-arm64.zip
YTMusic-0.1.0-x64.dmg
YTMusic-0.1.0-x64.zip
```

- [ ] **Step 3: 서명 상태와 실행 확인**

Run: `codesign -dv --verbose=2 release/mac-arm64/YTMusic.app 2>&1 | grep -E 'Signature|Identifier'`
Expected: `Signature=adhoc`, `Identifier=com.brad.ytmusic`

Run: `open release/mac-arm64/YTMusic.app` (Apple Silicon Mac인 경우; Intel이면 `release/mac/YTMusic.app`)
Expected: 앱이 실행되고 Dock에 빨간 원 아이콘 표시. 로컬 빌드는 격리 속성이 없어 Gatekeeper 경고 없음.

- [ ] **Step 4: 커밋**

```bash
git add electron-builder.yml
git commit -m "build: electron-builder config with ad-hoc signed mac dmg/zip targets

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: GitHub Actions (CI + Release)

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/release.yml`

**Interfaces:**
- Produces: `v*` 태그 푸시 시 GitHub Release에 DMG/ZIP 4개와 `SHA256SUMS.txt` 첨부.

- [ ] **Step 1: ci.yml 작성**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: release.yml 작성**

```yaml
name: Release
on:
  push:
    tags: ['v*']
permissions:
  contents: write
jobs:
  mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run dist
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
      - name: Write checksums
        run: |
          cd release
          shasum -a 256 *.zip *.dmg > SHA256SUMS.txt
          cat SHA256SUMS.txt
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            release/*.dmg
            release/*.zip
            release/SHA256SUMS.txt
          generate_release_notes: true
```

- [ ] **Step 3: 로컬에서 YAML 문법 확인**

Run: `node -e "const y=require('js-yaml')" 2>/dev/null || npx --yes js-yaml .github/workflows/ci.yml >/dev/null && npx --yes js-yaml .github/workflows/release.yml >/dev/null && echo OK`
Expected: `OK`

- [ ] **Step 4: 커밋**

```bash
git add .github/
git commit -m "ci: add test workflow and tag-triggered mac release workflow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: 라이선스, 출처 고지, README, Homebrew cask 템플릿

**Files:**
- Create: `LICENSE`, `THIRD_PARTY_NOTICES.md`, `README.md`, `homebrew/ytmusic.rb`

- [ ] **Step 1: LICENSE (MIT)**

```
MIT License

Copyright (c) 2026 Brad

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: THIRD_PARTY_NOTICES.md**

```markdown
# Third-party notices

## pear-desktop (formerly th-ch/youtube-music)

The Chrome user-agent spoofing approach and the `accounts.google.com` retry
exception in `src/main/user-agent.ts` and `src/main/policy/user-agent.ts`
follow the implementation in pear-desktop's `src/index.ts`.

https://github.com/pear-devs/pear-desktop

The MIT License (MIT)
Copyright (c) th-ch

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: homebrew/ytmusic.rb (tap 레포에 복사할 템플릿)**

```ruby
# 이 파일을 <github-user>/homebrew-tap 레포의 Casks/ytmusic.rb 로 복사한다.
# 릴리스마다 version 과 두 sha256 을 release/SHA256SUMS.txt 값으로 갱신한다.
cask "ytmusic" do
  arch arm: "arm64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "REPLACE_WITH_ARM64_ZIP_SHA256",
         intel: "REPLACE_WITH_X64_ZIP_SHA256"

  url "https://github.com/GITHUB_USER/ytmusicApp/releases/download/v#{version}/YTMusic-#{version}-#{arch}.zip"
  name "YTMusic"
  desc "YouTube Music desktop wrapper"
  homepage "https://github.com/GITHUB_USER/ytmusicApp"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "YTMusic.app"

  # 미서명(ad-hoc) 앱: Gatekeeper 격리 속성을 제거해 macOS 15+ 에서도 바로 실행되게 한다.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-r", "-d", "com.apple.quarantine", "#{appdir}/YTMusic.app"],
                   must_succeed: false
  end

  zap trash: [
    "~/Library/Application Support/ytmusic",
    "~/Library/Application Support/YTMusic",
    "~/Library/Preferences/com.brad.ytmusic.plist",
    "~/Library/Saved Application State/com.brad.ytmusic.savedState",
  ]
end
```

- [ ] **Step 4: README.md**

```markdown
# YTMusic

YouTube Music 웹을 그대로 감싼 macOS(1순위) / Windows 데스크톱 앱입니다.
광고 차단이나 다운로드 기능은 없습니다. 웹과 동일하게 동작하며, 데스크톱 앱으로서
필요한 최소 기능만 더했습니다.

- Google 로그인 및 세션 유지
- 창 크기·위치 기억
- 창을 닫아도 재생 유지, 트레이/Dock에서 복원
- 하드웨어 미디어키 및 macOS "지금 재생 중" 연동
- 외부 링크는 기본 브라우저로

## 설치 (macOS, Homebrew)

```sh
brew tap GITHUB_USER/tap
brew install --cask ytmusic
```

DMG를 직접 받아 설치한 경우, 이 앱은 Apple 개발자 서명이 없으므로 처음 한 번
격리 속성을 제거해야 합니다:

```sh
xattr -cr /Applications/YTMusic.app
```

지원 OS: macOS 13 Ventura 이상 (Apple Silicon / Intel), Windows 10 이상.

## 설정

메뉴바 **설정**에서 두 옵션을 켜고 끌 수 있습니다.

- **Chrome User-Agent로 위장**: Google 로그인이 "안전하지 않은 브라우저"로 막힐 때 필요합니다. 기본 켜짐. 변경 후 재시작.
- **미디어키 강제 점유**: 기본은 macOS 지금 재생 중 경로를 사용합니다. 이 옵션을 켜면 다른 앱의 미디어키를 가로채며 접근성 권한이 필요합니다.

## 개발

```sh
npm install
npm start        # 빌드 후 실행
npm test         # vitest
npm run dist     # macOS DMG/ZIP → release/
```

## 릴리스

1. `package.json`의 `version`을 올리고 커밋합니다.
2. `git tag vX.Y.Z && git push --tags` → GitHub Actions가 빌드해 Release에 첨부합니다.
3. Release의 `SHA256SUMS.txt`에서 두 zip 해시를 복사해 tap 레포의 `Casks/ytmusic.rb`에서 `version`과 `sha256`을 갱신합니다.

## 라이선스

MIT. 제3자 고지는 `THIRD_PARTY_NOTICES.md`를 참고하세요.
```

- [ ] **Step 5: cask 문법 검사**

Run: `brew style homebrew/ytmusic.rb`
Expected: 오류 없음 (경고는 허용). `brew` 미설치면 이 단계는 건너뛰고 기록한다.

- [ ] **Step 6: 커밋**

```bash
git add LICENSE THIRD_PARTY_NOTICES.md README.md homebrew/
git commit -m "docs: add license, third-party notices, README and Homebrew cask template

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: 스펙 수동 검증 체크리스트 완주

**Files:**
- Create: `docs/superpowers/verification/2026-09-18-manual-checklist.md`

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npm test && npm run dist`
Expected: 모든 테스트 PASS, `release/`에 4개 산출물.

- [ ] **Step 2: 빌드된 앱으로 스펙 9장 체크리스트 수행**

`open release/mac-arm64/YTMusic.app`(또는 `release/mac/`)으로 실행한 뒤 각 항목을 확인하고 결과를 기록한다:

```markdown
# 수동 검증 결과 (2026-09-18)

빌드: release/YTMusic-0.1.0-arm64.zip, macOS <버전 기입>

| # | 항목 | 결과 | 비고 |
|---|---|---|---|
| 1 | 실행 → 로그인 → Google 로그인 성공 → YouTube Music 진입 | | |
| 2 | 종료 후 재실행 시 로그인 유지 | | |
| 3 | 외부 링크가 기본 브라우저에서 열림, 앱 내 새 창 없음 | | |
| 4 | 창 크기·위치 변경 후 재실행 시 복원 | | |
| 5 | 하드웨어 미디어키 동작 + 지금 재생 중 위젯 표시 (강제 점유 OFF) | | |
| 6 | 창 닫기 후 재생 유지, Dock 클릭 복원, Cmd+Q 종료 | | |
| 7 | 두 번 실행 시 기존 창 포커스 | | |
| 8 | brew 설치 후 Gatekeeper 경고 없이 실행 | | tap 레포 생성 후 확인, 미완이면 "보류" 기록 |
| 9 | Wi-Fi 끊고 실행 → 오프라인 페이지 → 다시 시도 | | |
| 10 | 트레이 메뉴 재생/다음/이전/종료 | | |
```

각 행의 결과를 `PASS` / `FAIL(원인)` / `보류(이유)`로 채운다. FAIL이 있으면 해당 태스크로 돌아가 수정하고 다시 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add docs/superpowers/verification/
git commit -m "docs: record manual verification results

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage**
- 5.1 창·세션: Task 6 ✓ (persist 파티션, webPreferences, 상태 저장·복원, 1280×800)
- 5.2 UA 위장: Task 4, 5 ✓ (기본 켜짐, 메뉴에서 끄기는 Task 10)
- 5.3 내비게이션: Task 2, 3 ✓ (허용 호스트 목록 전부 포함)
- 5.4 미디어키: Task 8, 10 ✓ (기본 미등록, 강제 점유 옵션, 접근성 확인, video play/pause 우선)
- 5.5 hide-on-close·트레이·메뉴: Task 6, 9, 10 ✓
- 5.6 단일 인스턴스: Task 7 ✓
- 5.7 아이콘: Task 9 ✓ (플레이스홀더, 16/32 트레이 템플릿, GC 방지)
- 6 보안: Task 6 webPreferences, Task 8 preload 무노출 ✓
- 7.1 electron-builder: Task 12 ✓ (`identity: "-"`, dmg+zip, arm64+x64, nsis, artifactName)
- 7.2 Homebrew: Task 14 cask 템플릿 + README 절차 ✓ (tap 레포 생성은 사용자 수동)
- 7.3 미서명 안내: Task 14 README ✓
- 8 에러 처리: Task 11 (offline), Task 10 (미디어키 실패 로그), Task 9 (트레이 아이콘 누락) ✓
- 9 테스트: 단위 4종(url, user-agent ×2, window-bounds, media) Task 2/4/6/8, 수동 Task 15 ✓

**Deviations from spec (의도적, 기록)**
- preload는 `contextBridge`로 API를 노출하지 않고 `ipcRenderer.on` 리스너만 둔다. 페이지에 노출할 것이 없으므로 더 안전하다.
- 순수 함수는 `src/main/policy/`로 분리했다. Electron 모듈 import 없이 vitest로 돌리기 위함.
- `src/shared/media.ts`는 main만 import한다. 샌드박스 preload는 상대 require가 안 되어 리터럴을 복제한다.

**Type consistency**
- `MediaCommand`, `sendMediaCommand`, `MEDIA_CHANNEL`은 Task 8 정의를 Task 9, 10이 그대로 사용 ✓
- `settings.get('windowState')` 타입 `WindowState | null`과 `fitBoundsToDisplays(saved: Rect | null, …)` 호출부 `saved?.bounds ?? null` 일치 ✓
- `createMainWindow({ isQuitting })` 시그니처가 Task 6/7/9/10 index.ts에서 동일 ✓
- `policy/window-bounds.ts`의 `Rect`와 `settings.ts`의 `Rect`는 구조가 같아 호환 ✓
