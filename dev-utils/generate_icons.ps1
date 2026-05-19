Add-Type -AssemblyName System.Drawing
$source = "c:\Users\kevin\Desktop\kenzerp\assets\icons\logo.jpg"
$destPng = "c:\Users\kevin\Desktop\kenzerp\assets\icon.png"
$destIco = "c:\Users\kevin\Desktop\kenzerp\assets\icon.ico"

# 1. Resize and Save as PNG (256x256)
if (Test-Path $source) {
    try {
        $img = [System.Drawing.Image]::FromFile($source)
        $newImg = new-object System.Drawing.Bitmap(256, 256)
        $graph = [System.Drawing.Graphics]::FromImage($newImg)
        $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graph.DrawImage($img, 0, 0, 256, 256)
        $newImg.Save($destPng, [System.Drawing.Imaging.ImageFormat]::Png)
        
        Write-Host "Success: Resized and saved icon.png (256x256)"
        
        # 2. Convert PNG to ICO (PNG-encoded ICO)
        # We need byte array of the PNG
        $ms = New-Object System.IO.MemoryStream
        $newImg.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytes = $ms.ToArray()
        $ms.Dispose()
        
        $fs = New-Object System.IO.FileStream($destIco, [System.IO.FileMode]::Create)
        $bw = New-Object System.IO.BinaryWriter($fs)
        
        # ICO Header
        $bw.Write([int16]0)   # Reserved
        $bw.Write([int16]1)   # Type (1=ICO)
        $bw.Write([int16]1)   # Count (1 image)
        
        # Image Entry
        $bw.Write([byte]0)    # Width (0 = 256)
        $bw.Write([byte]0)    # Height (0 = 256)
        $bw.Write([byte]0)    # Colors (0 = 256 or more)
        $bw.Write([byte]0)    # Reserved
        $bw.Write([int16]1)   # Planes
        $bw.Write([int16]32)  # BitCount
        $bw.Write([int32]$pngBytes.Length) # Size
        $bw.Write([int32]22)  # Offset (6 header + 16 entry)
        
        # Image Data
        $bw.Write($pngBytes)
        
        $bw.Close()
        $fs.Close()
        
        $img.Dispose()
        $newImg.Dispose()
        $graph.Dispose()
        
        Write-Host "Success: Generated icon.ico (256x256 PNG-encoded)"
        
    } catch {
        Write-Error "Error: $_"
        exit 1
    }
} else {
    Write-Error "Source not found"
    exit 1
}
