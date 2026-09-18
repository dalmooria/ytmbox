# 이 파일을 <github-user>/homebrew-tap 레포의 Casks/ytmbox.rb 로 복사한다.
# 이 저장소의 homebrew/ytmbox.rb 자체는 배포되는 실제 cask가 아니라 템플릿이다.
# 릴리스마다 version 과 두 sha256 을 release/SHA256SUMS.txt 값으로 갱신한다.
cask "ytmbox" do
  arch arm: "arm64", intel: "x64"

  version "0.1.0"
  sha256 arm:   "REPLACE_WITH_ARM64_ZIP_SHA256",
         intel: "REPLACE_WITH_X64_ZIP_SHA256"

  url "https://github.com/<github-user>/ytmbox/releases/download/v#{version}/YTMBox-#{version}-#{arch}.zip"
  name "YTMBox"
  desc "YouTube Music desktop wrapper"
  homepage "https://github.com/<github-user>/ytmbox"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "YTMBox.app"

  # 미서명(ad-hoc) 앱: Gatekeeper 격리 속성을 제거해 macOS 15+ 에서도 바로 실행되게 한다.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-r", "-d", "com.apple.quarantine", "#{appdir}/YTMBox.app"],
                   must_succeed: false
  end

  zap trash: [
    "~/Library/Application Support/YTMBox",
    "~/Library/Preferences/com.brad.ytmbox.plist",
    "~/Library/Saved Application State/com.brad.ytmbox.savedState",
  ]
end
