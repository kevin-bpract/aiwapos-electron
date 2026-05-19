Add-Type -AssemblyName System.Drawing
$source = "c:\Users\kevin\Desktop\kenzerp\assets\icons\logo.jpg"
$dest = "c:\Users\kevin\Desktop\kenzerp\assets\icon.png"
if (Test-Path $source) {
    try {
        $img = [System.Drawing.Image]::FromFile($source)
        $img.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
        $img.Dispose()
        Write-Host "Success: Converted logo.jpg to icon.png"
    } catch {
        Write-Error "Error converting image: $_"
        exit 1
    }
} else {
    Write-Error "Source file not found: $source"
    exit 1
}
