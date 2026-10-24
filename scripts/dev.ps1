<#
GhanaCropGuard AI - local development runner (Windows PowerShell 5+).
  powershell -ExecutionPolicy Bypass -File scripts\dev.ps1 -Stage <stage>
The API is FullBackendd (separate repo, Express + MongoDB, routes under /api/v1/cropguard).
Set $env:FULLBACKEND_DIR if it is not at ..\FullBackendd-master\FullBackendd-master.
Stages:
  api-setup     npm install for FullBackendd (needs its .env with MONGO_URI and JWT_SECRET)
  api-model     copy the trained bundle (artifacts\models\active) into FullBackendd data\cropguard\model
  api-admin     create/promote a CropGuard administrator (prompts for the password)
  api           start FullBackendd on http://0.0.0.0:7004
  api-test      CropGuard tests in FullBackendd (needs CROPGUARD_TEST_MONGO_URI: a local *_test database)
  web-setup     npm ci for the web app
  web           start the web app on http://localhost:3000 (Vite dev server)
  web-prod      production build + preview on http://localhost:3000
  web-e2e       Playwright end-to-end tests against the running API + web (prod)
  mobile-setup  npm ci for the Expo app
  mobile        start Expo (scan the QR code with a development build / Expo Go)
  mobile-test   lint and unit tests for the mobile app
  mobile-apk    signed release APK -> mobile\dist\GhanaCropGuard.apk (calls the live API; see docs\MOBILE.md)
#>
param([Parameter(Mandatory = $true)][string]$Stage)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Web = Join-Path $Root "web"
$Mobile = Join-Path $Root "mobile"
$Api = if ($env:FULLBACKEND_DIR) { $env:FULLBACKEND_DIR } else { Join-Path $Root "..\FullBackendd-master\FullBackendd-master" }
$ApiUrl = "http://localhost:7004"

function Get-LanIp {
  try {
    (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object {
      $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" } |
      Select-Object -First 1).IPAddress
  } catch { "your-laptop-ip" }
}

function Assert-Api {
  if (-not (Test-Path (Join-Path $Api "app.js"))) { throw "FullBackendd not found at $Api. Set `$env:FULLBACKEND_DIR." }
}

switch ($Stage) {
  "api-setup" { Assert-Api; Push-Location $Api; try { npm install --legacy-peer-deps } finally { Pop-Location } }
  "api-model" {
    Assert-Api
    $src = Join-Path $Root "artifacts\models\active"
    if (-not (Test-Path (Join-Path $src "model.onnx"))) { throw "No trained bundle at $src. Run scripts\ml.ps1 -Stage pipeline first." }
    $dest = Join-Path $Api "data\cropguard\model"
    New-Item -ItemType Directory -Force $dest | Out-Null
    Copy-Item (Join-Path $src "model.onnx"), (Join-Path $src "meta.json") $dest -Force
    Write-Host "Model bundle copied to $dest. Restart the API to load it." -ForegroundColor Green
  }
  "api-admin" {
    Assert-Api
    $email = Read-Host "Admin email"
    Push-Location $Api; try { node scripts/cropguardCreateAdmin.js $email } finally { Pop-Location }
  }
  "api" {
    Assert-Api
    $ip = Get-LanIp
    Write-Host "API: $ApiUrl/api/v1/cropguard/health   docs: $ApiUrl/api-docs   phone on Wi-Fi: http://${ip}:7004" -ForegroundColor Green
    Push-Location $Api; try { node app.js } finally { Pop-Location }
  }
  "api-test" { Assert-Api; Push-Location $Api; try { npm run test:cropguard } finally { Pop-Location } }
  "web-setup" { Push-Location $Web; try { npm ci } finally { Pop-Location } }
  "web" { Push-Location $Web; try { $env:VITE_API_URL = $ApiUrl; npm run dev } finally { Pop-Location } }
  "web-prod" { Push-Location $Web; try { $env:VITE_API_URL = $ApiUrl; npm run build; npm run preview } finally { Pop-Location } }
  "web-e2e" { Push-Location $Web; try { npx playwright install chromium; npx playwright test } finally { Pop-Location } }
  "mobile-setup" { Push-Location $Mobile; try { npm ci --legacy-peer-deps } finally { Pop-Location } }
  "mobile" {
    Push-Location $Mobile
    try {
      $ip = Get-LanIp
      $env:EXPO_PUBLIC_API_URL = "http://${ip}:7004"
      Write-Host "Mobile app will call the API at $env:EXPO_PUBLIC_API_URL (change it in the app under Server)." -ForegroundColor Green
      npx expo start
    } finally { Pop-Location }
  }
  "mobile-test" { Push-Location $Mobile; try { npx eslint .; npx jest } finally { Pop-Location } }
  "mobile-apk" {
    # Release key lives outside the repo; create it once with keytool (docs\MOBILE.md). Back it up.
    $keyProps = Join-Path $env:USERPROFILE ".android-keys\ghanacropguard-release.properties"
    if (-not (Test-Path $keyProps)) { throw "Release key not found: $keyProps (see docs\MOBILE.md)" }
    $key = @{}
    Get-Content $keyProps | ForEach-Object { $k, $v = $_ -split "=", 2; if ($k) { $key[$k.Trim()] = $v.Trim() } }
    $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA "Android\Sdk" }
    $env:EXPO_PUBLIC_API_URL = "https://fullbackendd.onrender.com"
    $env:NODE_ENV = "production"
    Remove-Item Env:ALLOW_HTTP -ErrorAction SilentlyContinue
    Push-Location $Mobile
    try {
      $env:CI = "1"; npx expo prebuild -p android --clean --no-install; Remove-Item Env:CI
      if ($LASTEXITCODE -ne 0) { throw "expo prebuild failed" }
      Push-Location android
      # Some modules ask for a Java 17 toolchain; use installed JDKs instead of a slow auto-download.
      $jdks = Join-Path $env:APPDATA "Code\User\globalStorage\pleiades.java-extension-pack-jdk\java"
      $toolchains = @("17", "21") | ForEach-Object { Join-Path $jdks $_ } | Where-Object { Test-Path $_ }
      $tc = if ($toolchains) { @("-Porg.gradle.java.installations.paths=$($toolchains -join ',')") } else { @() }
      try { .\gradlew.bat assembleRelease "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a,x86_64" @tc --no-daemon }
      finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }
      $tools = Get-ChildItem (Join-Path $env:ANDROID_HOME "build-tools") | Sort-Object Name | Select-Object -Last 1
      New-Item -ItemType Directory -Force dist | Out-Null
      $apk = Join-Path $Mobile "dist\GhanaCropGuard.apk"
      & (Join-Path $tools.FullName "apksigner.bat") sign --ks $key.storeFile --ks-key-alias $key.alias `
        --ks-pass "pass:$($key.password)" --key-pass "pass:$($key.password)" --out $apk `
        "android\app\build\outputs\apk\release\app-release.apk"
      if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }
      & (Join-Path $tools.FullName "apksigner.bat") verify --print-certs $apk | Select-Object -First 2
      Write-Host "APK: $apk ($([math]::Round((Get-Item $apk).Length / 1MB, 1)) MB)" -ForegroundColor Green
    } finally { Pop-Location }
  }
  default { throw "Unknown stage '$Stage'" }
}
