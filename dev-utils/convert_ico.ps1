Add-Type -AssemblyName System.Drawing
$source = "c:\Users\kevin\Desktop\kenzerp\assets\icon.png"
$dest = "c:\Users\kevin\Desktop\kenzerp\assets\icon.ico"
if (Test-Path $source) {
    try {
        $bmp = [System.Drawing.Bitmap]::FromFile($source)
        # Handle transparency if possible, but simple conversion:
        $hicon = $bmp.GetHicon()
        $icon = [System.Drawing.Icon]::FromHandle($hicon)
        $fs = New-Object System.IO.FileStream($dest, [System.IO.FileMode]::Create)
        $icon.Save($fs)
        $fs.Close()
        $icon.Dispose()
        $bmp.Dispose()
        # Note: DestroyIcon shouldn't be needed for managed Icon, but Hicon might leak in unmanaged?
        # PowerShell handles cleanup usually on process exit.
        Write-Host "Success: Converted icon.png to icon.ico"
    } catch {
        Write-Error "Error converting to ICO: $_"
        exit 1
    }
} else {
    Write-Error "Source file not found: $source"
    exit 1
}
