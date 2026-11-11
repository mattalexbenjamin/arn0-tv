param(
    [string]$SourceDir,
    [string]$OutputFile
)

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $OutputFile) { Remove-Item $OutputFile -Force }

$fullSource = (Resolve-Path $SourceDir).Path
$zip = [System.IO.Compression.ZipFile]::Open($OutputFile, [System.IO.Compression.ZipArchiveMode]::Create)

Get-ChildItem -Path $fullSource -Recurse | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $relPath = $_.FullName.Substring($fullSource.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $relPath, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
}

$zip.Dispose()
Write-Host "Created $OutputFile with POSIX forward slashes"

