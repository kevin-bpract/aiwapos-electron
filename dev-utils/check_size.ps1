Add-Type -AssemblyName System.Drawing
$path = "c:\Users\kevin\Desktop\kenzerp\assets\icon.png"
if (Test-Path $path) {
    $img = [System.Drawing.Image]::FromFile($path)
    Write-Host "Width: $($img.Width)"
    Write-Host "Height: $($img.Height)"
    $img.Dispose()
} else {
    Write-Host "File not found"
}
