<#
GhanaCropGuard AI - ML pipeline runner for Windows (PowerShell 5+).

Usage (from the repo root, or via VS Code: Terminal > Run Task):
  powershell -ExecutionPolicy Bypass -File scripts\ml.ps1 -Stage setup
Stages:
  setup      create ml\.venv, install CPU PyTorch + requirements
  test       run ML unit tests
  download   fetch raw CCMT images from Mendeley Data (CC BY 4.0) into ml\data\raw
  prepare    integrity checks, de-duplication, leakage-free split, resized cache
  benchmark  measure CPU training speed per architecture
  results    write docs\RESULTS.md from the measured metrics
  smoke      2-epoch tiny run to prove the pipeline works (not for reporting)
  train      -Model mobilenetv3|efficientnet_b0|convnext_tiny
  evaluate   -Model ...   held-out TEST evaluation (after training)
  export     -Model ... -Version 1.0.0   ONNX bundle into artifacts\models
  activate   -Bundle <folder name>   point artifacts\models\active at a bundle
  compare    comparison table across evaluated runs
  pipeline   everything above in order; resumable (skips finished steps)
Every stage writes logs\<stage>[-model].log (UTF-8).
#>
param(
  [Parameter(Mandatory = $true)][string]$Stage,
  [string]$Model = "mobilenetv3",
  [string]$Version = "1.0.0",
  [string]$Bundle = ""
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Ml = Join-Path $Root "ml"
$Logs = Join-Path $Root "logs"
New-Item -ItemType Directory -Force -Path $Logs | Out-Null
$Venv = Join-Path $Ml ".venv"
$Py = Join-Path $Venv "Scripts\python.exe"
$env:PYTHONUTF8 = "1"
$env:PYTHONUNBUFFERED = "1"
# numpy/OpenBLAS in each worker process otherwise reserves per-thread buffers for all 16 threads.
$env:OPENBLAS_NUM_THREADS = "1"

$RunName = @{ "mobilenetv3" = "mobilenetv3_large"; "efficientnet_b0" = "efficientnet_b0"; "convnext_tiny" = "convnext_tiny" }

function Get-BasePython {
  foreach ($v in @("3.12", "3.11")) {
    try { $p = (& py "-$v" -c "import sys; print(sys.executable)" 2>$null); if ($LASTEXITCODE -eq 0 -and $p) { return $p.Trim() } } catch {}
  }
  foreach ($c in @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe")) {
    if (Test-Path $c) { return $c }
  }
  throw "Python 3.11 or 3.12 not found (PyTorch does not support 3.14 yet)."
}

function Invoke-Logged([string]$LogName, [string]$Exe, [string[]]$ArgList) {
  $log = Join-Path $Logs "$LogName.log"
  "=== $(Get-Date -Format s) :: $Exe $($ArgList -join ' ')" | Out-File -FilePath $log -Encoding utf8
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $Exe @ArgList 2>&1 | ForEach-Object {
    $line = "$_"
    Write-Host $line
    Add-Content -Path $log -Value $line -Encoding utf8
  }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $prev
  Add-Content -Path $log -Value "=== EXIT $code $(Get-Date -Format s)" -Encoding utf8
  if ($code -ne 0) { throw "Stage failed with exit code $code (see $log)" }
}

Push-Location $Ml
try {
  switch ($Stage) {
    "setup" {
      $base = Get-BasePython
      Write-Host "Using base Python: $base"
      if (-not (Test-Path $Py)) { Invoke-Logged "setup" $base @("-m", "venv", $Venv) }
      Invoke-Logged "setup" $Py @("-m", "pip", "install", "--upgrade", "pip")
      Invoke-Logged "setup" $Py @("-m", "pip", "install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cpu")
      Invoke-Logged "setup" $Py @("-m", "pip", "install", "-r", "requirements.txt", "--extra-index-url", "https://download.pytorch.org/whl/cpu")
      Invoke-Logged "setup" $Py @("-m", "pip", "install", "-e", ".")
      Invoke-Logged "setup" $Py @("-c", "import torch, timm, os; print('torch', torch.__version__, 'timm', timm.__version__, 'threads', torch.get_num_threads(), 'cpus', os.cpu_count())")
    }
    "test" { Invoke-Logged "test" $Py @("-m", "pytest", "-q") }
    "download" { Invoke-Logged "download" $Py @("-m", "cropguard_ml.download", "--out", "data/raw") }
    "download-zip" { Invoke-Logged "download-zip" $Py @("-m", "cropguard_ml.download_zip", "--raw", "data/raw") }
    "probe" { Invoke-Logged "probe" $Py @("-m", "cropguard_ml.probe_source") }
    "prepare" { Invoke-Logged "prepare" $Py @("-m", "cropguard_ml.prepare", "--raw", "data/raw", "--out", "data/prepared") }
    "benchmark" { Invoke-Logged "benchmark" $Py @("-m", "cropguard_ml.benchmark") }
    "smoke" { Invoke-Logged "smoke" $Py @("-m", "cropguard_ml.train", "--config", "configs/smoke.yaml") }
    "train" { Invoke-Logged "train-$Model" $Py @("-m", "cropguard_ml.train", "--config", "configs/$Model.yaml") }
    "evaluate" { Invoke-Logged "evaluate-$Model" $Py @("-m", "cropguard_ml.evaluate", "--run", "runs/$($RunName[$Model])") }
    "export" { Invoke-Logged "export-$Model" $Py @("-m", "cropguard_ml.export", "--run", "runs/$($RunName[$Model])", "--version", $Version, "--out", "../artifacts/models", "--quantize") }
    "pipeline" {
      # One-click, resumable: each step is skipped if its output already exists.
      $models = @(
        @{ key = "mobilenetv3"; run = "mobilenetv3_large"; arch = "mobilenetv3_large_100" },
        @{ key = "efficientnet_b0"; run = "efficientnet_b0"; arch = "efficientnet_b0" },
        @{ key = "convnext_tiny"; run = "convnext_tiny"; arch = "convnext_tiny" }
      )
      Invoke-Logged "download" $Py @("-m", "cropguard_ml.download", "--out", "data/raw")
      Invoke-Logged "download-zip" $Py @("-m", "cropguard_ml.download_zip", "--raw", "data/raw")
      $splits = "data/prepared/splits.csv"
      if (-not (Test-Path $splits)) {  # run the "prepare" task on its own to rebuild after new downloads
        Invoke-Logged "prepare" $Py @("-m", "cropguard_ml.prepare", "--raw", "data/raw", "--out", "data/prepared")
      }
      Invoke-Logged "web-data" $Py @("-m", "cropguard_ml.web_data", "--raw", "data/raw", "--web", "../web")
      $benchLog = Join-Path $Logs "benchmark.log"
      if (-not ((Test-Path $benchLog) -and (Select-String -Path $benchLog -Pattern "EXIT 0" -Quiet))) {
        Invoke-Logged "benchmark" $Py @("-m", "cropguard_ml.benchmark")
      }
      foreach ($m in $models) {
        if (-not (Test-Path "runs/$($m.run)/train_summary.json")) {
          Invoke-Logged "train-$($m.key)" $Py @("-m", "cropguard_ml.train", "--config", "configs/$($m.key).yaml")
        }
        if (-not (Test-Path "runs/$($m.run)/test_metrics.json")) {
          Invoke-Logged "evaluate-$($m.key)" $Py @("-m", "cropguard_ml.evaluate", "--run", "runs/$($m.run)")
        }
        if (-not (Test-Path "../artifacts/models/$($m.arch)-$Version/meta.json")) {
          Invoke-Logged "export-$($m.key)" $Py @("-m", "cropguard_ml.export", "--run", "runs/$($m.run)", "--version", $Version, "--out", "../artifacts/models", "--quantize")
        }
        # Activate the best model so far (validation-based) so the API can serve a real model early.
        Invoke-Logged "select" $Py @("-m", "cropguard_ml.select_model", "--runs", "runs", "--models", "../artifacts/models")
        Invoke-Logged "demo-samples" $Py @("-m", "cropguard_ml.demo_samples", "--bundle", "../artifacts/models/active", "--web", "../web")
      }
      Invoke-Logged "compare" $Py @("-m", "cropguard_ml.compare", "runs/mobilenetv3_large", "runs/efficientnet_b0", "runs/convnext_tiny")
      Invoke-Logged "results" $Py @("-m", "cropguard_ml.results_doc", "--out", "../docs/RESULTS.md")
    }
    "results" { Invoke-Logged "results" $Py @("-m", "cropguard_ml.results_doc", "--out", "../docs/RESULTS.md") }
    "compare" { Invoke-Logged "compare" $Py @("-m", "cropguard_ml.compare", "runs/mobilenetv3_large", "runs/efficientnet_b0", "runs/convnext_tiny") }
    "activate" {
      if (-not $Bundle) { throw "-Bundle is required" }
      $src = Join-Path $Root "artifacts\models\$Bundle"
      $dst = Join-Path $Root "artifacts\models\active"
      if (-not (Test-Path (Join-Path $src "model.onnx"))) { throw "No model.onnx in $src" }
      if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
      Copy-Item -Recurse $src $dst
      "active -> $Bundle" | Tee-Object -FilePath (Join-Path $Logs "activate.log")
    }
    default { throw "Unknown stage '$Stage'" }
  }
  Write-Host "`nStage '$Stage' finished OK." -ForegroundColor Green
}
catch {
  $msg = "$(Get-Date -Format s) stage '$Stage' failed: $($_ | Out-String)`n$($_.ScriptStackTrace)"
  Add-Content -Path (Join-Path $Logs "errors.log") -Value $msg -Encoding utf8
  Write-Host $msg -ForegroundColor Red
  exit 1
}
finally { Pop-Location }
