$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$texto = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($texto)) { throw "El ticket está vacío." }

$documento = New-Object System.Drawing.Printing.PrintDocument
$documento.PrinterSettings.PrinterName = "COCINA"
if (-not $documento.PrinterSettings.IsValid) { throw "No se encuentra la impresora COCINA." }

$documento.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(5,5,5,5)
$documento.PrintController = New-Object System.Drawing.Printing.StandardPrintController
$documento.add_PrintPage({
    param($sender, $evento)
    $fuente = New-Object System.Drawing.Font("Consolas", 8)
    $area = New-Object System.Drawing.RectangleF(5,5,290,1500)
    $evento.Graphics.DrawString($texto, $fuente, [System.Drawing.Brushes]::Black, $area)
    $fuente.Dispose()
})

try { $documento.Print() }
finally { $documento.Dispose() }
