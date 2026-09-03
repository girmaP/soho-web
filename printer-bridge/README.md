# Conector de impresora de cocina

Preparado para la impresora Approx `appPOS80WIFI+LAN` de 80 mm. El conector se ejecuta en el ordenador de SOHO, consulta una cola autenticada y envía cada pedido por TCP a la impresora dentro de la red local.

## Pendiente en el local

1. Averiguar la IP fija o reserva DHCP de la impresora.
2. Confirmar que acepta ESC/POS por TCP, normalmente en el puerto `9100`.
3. Crear un token aleatorio de 64 caracteres y guardar el mismo valor como `PRINT_BRIDGE_TOKEN` en Vercel y en el ordenador.
4. Copiar `.env.example` como `.env` y completar IP y token.
5. Cargar las variables en PowerShell y ejecutar con Node.js 20 o posterior:

```powershell
Get-Content .env | ForEach-Object {
  if ($_ -match '^[^#].*=') {
    $name, $value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
  }
}
node .\soho-printer-bridge.mjs
```

El archivo local `.printed-jobs.json` evita reimpresiones si el ticket salió pero la confirmación a la web se interrumpió. No debe borrarse durante el funcionamiento normal.
