$ErrorActionPreference='Stop'
python -m pip install -r (Join-Path $PSScriptRoot requirements.txt)
if ($LASTEXITCODE) { throw 'Python dependency installation failed' }
$target=Join-Path $env:APPDATA 'Adobe/CEP/extensions/local.smartvector.panel'
New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach($name in 'CSXS','index.html','panel.js','host.jsx','engine.py'){
 Copy-Item -Recurse -Force -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $target
}
$key='HKCU:\Software\Adobe\CSXS.12'
New-Item -Force $key | Out-Null
New-ItemProperty -Force -Path $key -Name PlayerDebugMode -Value '1' -PropertyType String | Out-Null
Write-Output 'Restart Illustrator. Open Window > Extensions > Smart Local Vectorizer.'

