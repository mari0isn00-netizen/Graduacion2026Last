LA ÚLTIMA TARDE — TV EXTERIOR (v2 estética + zapping mejorado)

Esta versión sigue centrada SOLO en la televisión exterior.
Se ha recuperado una sensación de zapping más sucia y más televisiva,
pero con más pausa, más capas CRT y una estética general más elaborada.

ARCHIVOS PRINCIPALES
- tv-exterior.html
- exterior.css
- exterior.js

CARPETAS
- assets/audio/
  - dtmf-bad-bunny.mp3   (incluido)
- assets/videos/
  - mete aquí clips cortos del zapping: clip01.mp4, clip02.mp4, clip03.mp4...

CÓMO ABRIRLO
1. Extrae el zip.
2. Abre PowerShell en esa carpeta.
3. Ejecuta:
   python -m http.server 8011
4. Entra en:
   http://localhost:8011/tv-exterior.html

ATAJOS
- 1 → standby
- 2 → intro completa (zapping + DTMF + textos + flash + título + speech)
- 3 → speech
- 4 → horario
- 5 → vista de juegos
- 6 → irrupción del primer juego
- 7 → pantalla de “primer juego listo”

CAMBIOS DE ESTA VERSIÓN
- zapping más pausado entre saltos de canal
- blackout breve entre cambios para que se sienta más real
- más capas CRT: ghosting, reflexión, máscara, flicker y bandas analógicas
- estética general más rica en la TV exterior
- la canción sigue arrancando solo al encontrar el canal correcto

NOTAS
- Si metes vídeos en assets/videos/, los canales intermedios intentarán usarlos.
- Si no hay clips, seguirá funcionando con ruido/interferencias.
- El punto de flash sigue preparado para ~0:50 del MP3 incluido.


NUEVO
- 4 o g → secuestro del sistema / EL INFORMANTE integrado tras el speech
