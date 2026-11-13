# jchh
# Void Dodger

> Un juego minimalista de esquivar obstáculos hecho con JavaScript puro.

**Autor:** Jose Carlos Hernandez Hernandez
**Materia:** Creacion de videojuegos · UTH
**Matrícula:** 23311900

## Concepto
Controlas un cuadrado en un espacio oscuro. Caen figuras desde arriba y
debes esquivarlas el mayor tiempo posible. La velocidad aumenta con el tiempo.

##  Mecánicas
- Movimiento izquierda/derecha con flechas (o A/D); en móvil, toque en pantalla.
- Los obstáculos aparecen al azar y cada vez más rápido.
- Puntaje = segundos sobrevividos. Se guarda el récord con `localStorage`.
- Al chocar: Game Over y botón para reiniciar.

##  Estilo visual
Minimalista: fondo oscuro, formas geométricas y 2–3 colores.

##  Audio
Efectos simples generados con la Web Audio API (sin archivos externos):
- Sonido al esquivar / sumar punto
- Sonido de choque
- Música de fondo opcional en loop

##  Tecnologías
- HTML5 Canvas
- JavaScript (vanilla)
- CSS
- GitHub Pages para publicarlo

##  Plan de desarrollo
1. Canvas y bucle del juego (`requestAnimationFrame`)
2. Movimiento del jugador
3. Obstáculos y colisiones
4. Puntaje y récord
5. Audio
6. Pulido y publicación en GitHub Pages
7. Video explicativo del código

##  Jugar en línea
https://a23311900-jpg.github.io/jchh/ 

##  Licencia
MIT. Código libre y liberado.
