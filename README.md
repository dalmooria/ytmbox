# YTMusic

YouTube Music 웹을 그대로 감싼 macOS(1순위) / Windows 데스크톱 앱입니다.
광고 차단, 다운로드, 자동 업데이트, 플러그인, 테마 기능은 없습니다. 웹과 동일하게
동작하며, 데스크톱 앱으로서 필요한 최소 기능만 더했습니다.

- Google 로그인 및 세션 유지
- 창 크기·위치 기억
- 창을 닫아도 재생 유지, 트레이/Dock에서 복원
- 하드웨어 미디어키 및 macOS "지금 재생 중" 연동
- 외부 링크는 기본 브라우저로

## 설치 (macOS, Homebrew)

**참고:** 아래 명령은 `<github-user>/homebrew-tap` 저장소를 먼저 만들어 cask를
올린 뒤에만 동작합니다. 아직 tap을 만들지 않았다면 아래 "설치 (macOS, DMG 직접
다운로드)" 방법을 쓰거나, "Homebrew tap 준비" 절을 먼저 따르세요.

```sh
brew tap <github-user>/tap
brew install --cask ytmusic
```

(`brew tap <github-user>/tap`은 Homebrew가 `homebrew-` 접두사를 자동으로 붙이므로
실제로는 `<github-user>/homebrew-tap` 저장소를 가리킵니다.)

이 앱은 Apple 개발자 서명이 없는(ad-hoc 서명) 앱입니다. Homebrew cask는
`postflight`에서 Gatekeeper 격리 속성을 자동으로 제거하므로 위 방법으로 설치하면
추가 조치가 필요 없습니다.

## 설치 (macOS, DMG 직접 다운로드)

[Releases](https://github.com/<github-user>/ytmusicApp/releases)에서 DMG를 받아
직접 설치한 경우, 서명이 없어 Gatekeeper가 실행을 막습니다. macOS 버전에 따라
증상과 해결 방법이 다릅니다.

- **macOS 14 이하**: "확인되지 않은 개발자" 경고가 뜹니다. Finder에서
  YTMusic.app을 **마우스 우클릭 → 열기**로 우회할 수 있습니다.
- **macOS 15 이상**: "손상되었기 때문에 열 수 없습니다" 오류가 뜨고, 우클릭 열기로는
  우회되지 않습니다. 격리 속성을 직접 제거해야 합니다.

```sh
xattr -cr /Applications/YTMusic.app
```

지원 OS: macOS 13 Ventura 이상 (Apple Silicon / Intel), Windows 10 이상(2순위).

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
npm run dist:win # Windows nsis 인스톨러 → release/
```

## 릴리스

1. `package.json`의 `version`을 올리고 커밋합니다.
2. `git tag vX.Y.Z && git push --tags` → GitHub Actions가 빌드해 Release에 첨부합니다.
   macOS 빌드(`dmg`/`zip`)와 Windows 빌드(`exe`)는 서로 다른 러너에서 각각 실행됩니다.
3. `SHA256SUMS.txt`는 macOS 작업(`release.yml`의 `mac` job)에서만 생성되며
   macOS 산출물(dmg, zip)의 체크섬만 담고 있습니다. Windows `.exe`는 여기 포함되지
   않습니다.
4. Release의 `SHA256SUMS.txt`에서 두 zip 해시를 복사해 tap 레포의
   `Casks/ytmusic.rb`에서 `version`과 `sha256`을 갱신합니다.

### Homebrew tap 준비

`homebrew/ytmusic.rb`는 이 저장소에 있는 **템플릿**일 뿐, 그대로 설치되는 cask가
아닙니다. Homebrew로 배포하려면:

1. `<github-user>/homebrew-tap`이라는 별도 GitHub 저장소를 만듭니다.
2. 이 저장소의 `homebrew/ytmusic.rb`를 그 저장소의 `Casks/ytmusic.rb`로 복사합니다.
3. 릴리스마다 `version`과 두 `sha256` 값을 갱신해 커밋합니다.

## 라이선스

MIT. 제3자 고지는 `THIRD_PARTY_NOTICES.md`를 참고하세요.

## 첫 릴리스 전에 채워야 할 값

아래 자리표시자는 실제 GitHub 사용자명으로 바뀌어야 합니다.

- 이 파일(`README.md`)의 `<github-user>` (tap 안내, Releases 링크)
- `homebrew/ytmusic.rb`의 `<github-user>` (`url`, `homepage`)
- `homebrew/ytmusic.rb`의 `REPLACE_WITH_ARM64_ZIP_SHA256`, `REPLACE_WITH_X64_ZIP_SHA256`
  (첫 릴리스의 `SHA256SUMS.txt` 값으로 교체)
