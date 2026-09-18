# 오픈소스 배포 준비

YTMBox를 공개 저장소로 올리고 Homebrew tap으로 배포하기까지 남은 일. 위쪽일수록 막고 있는
것이고, 아래로 갈수록 선택이다. 각 항목은 **왜 필요한지**와 **어디를 고치는지**를 같이 적었다.

## 0. 공개 전에 반드시 판단할 것

### 커밋에 담긴 이메일 주소 — 해결됨

39개 커밋 전부가 회사 이메일로 서명돼 있었다. 공개 후에는 포크·캐시 때문에
사실상 회수가 안 되므로, 원격이 없는 지금 `git filter-branch --env-filter`로 작성자·커미터
이메일을 **`dalmooria@naver.com`으로 재작성했다.** 트리 내용과 커밋 제목은 재작성 전후가
완전히 동일함을 확인했다 (`git diff backup/pre-email-rewrite HEAD` 결과 없음).

앞으로의 커밋을 위해 저장소 로컬 설정도 같이 바꿨다 (`git config user.email`). 전역 설정은
건드리지 않았으므로 **다른 저장소는 그대로 회사 이메일을 쓴다.**

**아직 남은 것:** 재작성 전 히스토리가 두 곳에 그대로 남아 있고, 둘 다 옛 이메일을 담고 있다.

- 태그 `backup/pre-email-rewrite` — 되돌릴 수 있는 유일한 수단이라 일부러 남겼다.
  `git push --tags`로 **같이 올라가면 재작성이 무의미해진다.**
- `refs/original/refs/heads/main` — filter-branch가 남긴 백업. push 되지는 않는다.

원격을 만들기 **전에** 정리한다:

```sh
git tag -d backup/pre-email-rewrite
git update-ref -d refs/original/refs/heads/main
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

### 상표 고지 — 해결됨

README에 두 군데 넣었다. 기능 목록 바로 아래에 한 줄 요약(인용문)을 두어 저장소 첫 화면에서
바로 보이게 하고, 라이선스 절 앞에 `## 고지` 절을 두어 상표·콘텐츠 출처·약관 우회 기능
부재를 밝혔다.

아이콘 도안이 Google 상표나 로고를 쓰지 않는다는 점은 `build/icon.png`를 직접 열어
확인했다 (턴테이블과 붉은 레코드판). 다만 **이 도안의 출처는 확인하지 않았다** — 직접
만든 것이 아니라면 라이선스를 확인해 `THIRD_PARTY_NOTICES.md`에 고지가 필요할 수 있다.

## 1. 채워야 하는 값 (이게 없으면 설치가 실패한다)

| 위치 | 무엇 |
|---|---|
| `README.md` | `<github-user>` (tap 안내, Releases 링크) |
| `homebrew/ytmbox.rb` | `<github-user>` (`url`, `homepage`) |
| `homebrew/ytmbox.rb` | `REPLACE_WITH_ARM64_ZIP_SHA256`, `REPLACE_WITH_X64_ZIP_SHA256` |
| `LICENSE` | 저작권 줄이 `Copyright (c) 2026 Brad`다. 실명이나 법적 주체로 쓸지 결정 |

sha256 두 개는 릴리스를 만든 뒤에야 나온다 — 릴리스 워크플로가 `SHA256SUMS.txt`를 함께
올리므로 그 값을 옮겨 적으면 된다.

## 2. 저장소 준비

- [ ] GitHub 저장소 생성. **이름은 `ytmbox`** — README와 cask의 URL이 이미 그렇게 가리킨다.
- [ ] `git remote add origin` 후 `git push -u origin main`
- [ ] `<github-user>/homebrew-tap` 저장소 생성, `homebrew/ytmbox.rb`를 그쪽 `Casks/ytmbox.rb`로 복사
- [ ] 로컬 폴더명이 아직 `ytmusicApp`이다. git은 경로에 의존하지 않으므로 `mv`로 바꿔도 안전하다.

## 3. 자산

- [ ] **트레이 아이콘이 아직 플레이스홀더다.** `assets/trayTemplate.png`(+`@2x`)가 검은 삼각형이다.
      메뉴 막대용이라 단색 실루엣이어야 하고 16×16에서 알아볼 수 있어야 한다. 앱 아이콘의
      레코드판 모티프를 단색으로 옮기는 것이 자연스럽다.
- [ ] README에 스크린샷. 메뉴 막대 곡 표시와 플레이어 바가 이 앱의 차별점이라 보여주는 편이 낫다.
- [x] 앱 아이콘 — 적용 완료

## 4. 검증 (남은 것)

`docs/superpowers/verification/2026-09-18-manual-checklist.md`에 상세가 있다. 공개 전에 최소한
이 정도는 확인하는 것이 좋다.

**직접 써봐야 알 수 있는 것**

- [ ] 하드웨어 미디어키 — 강제 점유 OFF/ON 각각
- [ ] 제어센터 "지금 재생 중"에 곡이 뜨는지
- [ ] 실제 소리가 나는지 (지금까지 재생 상태는 코드로만 확인했다)
- [ ] 로그아웃 / 계정 전환 — `will-navigate` 분기가 이것도 가로챌 수 있다 (개발 기록 참고)

**환경이 필요한 것**

- [ ] 다운로드한 DMG의 Gatekeeper 동작. 로컬 빌드에는 quarantine 속성이 없어 검증이 안 됐다.
      릴리스에서 실제로 받아 열어봐야 README의 `xattr -cr` 안내가 맞는지 확인된다.
- [ ] Intel 실기기
- [ ] Homebrew tap 설치 (`brew tap` → `brew install --cask ytmbox`)
- [ ] **Windows 빌드** — `electron-builder.yml`과 릴리스 워크플로에 설정만 있고 한 번도 빌드되거나
      실행된 적이 없다. macOS 전용 코드(`setTitle`, hide-on-close)는 분기해뒀지만 검증되지 않았다.
      공개 시 Windows를 지원한다고 쓸지, "실험적"으로 표시할지 정해야 한다.

## 5. 릴리스 절차

워크플로는 있지만 **한 번도 실행된 적이 없다.** 첫 실행은 실패를 예상하고 지켜보는 게 좋다.

1. `package.json`의 `version` 확정
2. `git tag v0.1.0 && git push --tags`
3. `.github/workflows/release.yml`이 태그에 반응해 macOS에서 테스트 → `npm run dist` →
   `SHA256SUMS.txt` 생성 → Release에 업로드. 이어서 Windows 잡이 `.exe`를 올린다.
4. `SHA256SUMS.txt`의 두 zip 해시를 tap의 `Casks/ytmbox.rb`에 옮겨 적고 `version` 갱신
5. `brew install --cask ytmbox`로 실제 설치 확인

CI(`ci.yml`)는 push/PR에서 테스트와 빌드를 돌린다. 첫 push에서 초록이 뜨는지 확인한다.

## 6. 있으면 좋은 것

- [ ] `CHANGELOG.md` — 릴리스마다 무엇이 바뀌었는지. 지금은 개발 기록이 그 역할을 겸하고 있다.
- [ ] README에 "왜 이걸 만들었나" 한 문단. 비슷한 프로젝트가 여럿 있어서 차이를 적어두면 좋다.
- [ ] 이슈 템플릿 / `CONTRIBUTING.md` — 기여를 받을 생각이면.
- [ ] `docs/superpowers/` 아래 사양·계획서도 함께 공개된다. 설계 의도가 드러나 유용하지만,
      공개하고 싶지 않다면 지금 정리해야 한다.

## 7. 공개 전 마지막 점검

- [ ] `git log -p`로 자격증명·토큰이 섞이지 않았는지 훑기 (현재 소스에는 없다)
- [x] `release/`가 `.gitignore`에 있다 (확인함) — 100MB 넘는 산출물이 커밋되면 되돌리기 번거롭다
- [ ] `npm ci`가 깨끗한 클론에서 통과하는지 — CI 첫 실행이 이걸 확인해준다
