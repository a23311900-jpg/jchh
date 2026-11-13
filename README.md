# 🔊 Eco

> Un juego de sigilo en la oscuridad donde lo que te salva es lo mismo que te delata.

**Autor:** Jose Carlos Hernandez Hernandez
**Materia:** Creación de videojuegos · UTH
**Matrícula:** 23311900

## Concepto
Estás atrapado en un laberinto totalmente oscuro. Para ver, lanzas **pulsos de sonido**
(ecos) que iluminan las paredes por un instante, como un murciélago. Tu objetivo es
llegar a la salida con los pocos pulsos que tienes.

Pero en el laberinto hay un **ente** que no ve, solo escucha: cada pulso que lanzas lo
alcanza, lo alerta y lo manda directo hacia donde sonó. **El mismo eco que te ayuda a
escapar es el que te puede matar.**

##  Mecánicas
- Moverte: flechas o WASD (en móvil, mantén el dedo para caminar).
- Pulso de sonido: clic o barra espaciadora (en móvil, toque rápido). Solo tienes 10 por nivel.
- Las paredes y la salida aparecen un momento y se desvanecen.
- Cuando la onda alcanza al ente, este se alerta y corre al punto del pulso; si el eco
  lo toca con línea de vista, lo ves un instante en rojo.
- Si te alcanza, pierdes. Cada nivel nuevo genera otro laberinto y el ente es más rápido.
- Se guarda tu récord (nivel máximo) con `localStorage`.

##  Audio (parte de la jugabilidad)
Todo se genera con la Web Audio API, sin archivos externos:
- El tono del eco es más agudo mientras más cerca está una pared.
- Un gruñido grave te avisa cuando el ente escuchó tu pulso.
- Un latido que se acelera cuando el ente está cerca.

##  Tecnologías
HTML5 Canvas · JavaScript (vanilla) · CSS · Web Audio API · GitHub Pages

##  Plan de desarrollo
1. Generación del laberinto (backtracking) y movimiento con colisiones
2. Pulso de sonido y revelado de paredes con línea de vista
3. El ente: merodeo, alerta por el sonido y persecución (búsqueda en anchura)
4. Audio, niveles y récord
5. Publicación en GitHub Pages y video explicativo

##  Jugar en línea
https://a23311900-jpg.github.io/jchh/

##  Licencia
MIT. Código libre y liberado.
