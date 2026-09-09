# Conector de impresora de cocina

El conector consulta la cola autenticada de SOHO y envía cada ticket a la impresora de Windows llamada `COCINA`. El archivo `.printed-jobs.json` evita duplicados si se interrumpe la confirmación con la web.

## Pendiente en el local

1. Instalar la impresora con el nombre `COCINA` en Windows.
2. Crear un token aleatorio de 64 caracteres y guardar el mismo valor como `PRINT_BRIDGE_TOKEN` en Vercel y en el ordenador.
3. Copiar `soho-printer-bridge.mjs`, `print-ticket.ps1` y `.env` a `C:\SOHO-Printer`.
4. Cargar las variables en PowerShell y ejecutar con Node.js 20 o posterior:

```powershell
Get-Content "C:\SOHO-Printer\.env" | ForEach-Object {
  if ($_ -match "^[^#].*=") {
    $nombre, $valor = $_ -split "=", 2
    Set-Item -Path "Env:$($nombre.Trim())" -Value $valor.Trim()
  }
}
Set-Location "C:\SOHO-Printer"
node .\soho-printer-bridge.mjs
```

El ticket incluye datos fiscales de SOHO, datos de facturación cuando el cliente los facilita, artículos, extras, base imponible, IVA, total y estado del pago.
