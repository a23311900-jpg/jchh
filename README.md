🔊 Eco

Un juego de sigilo en la oscuridad donde lo que te salva es lo mismo que te delata.

Autor: Jose Carlos Hernandez Hernandez Materia: Creación de videojuegos · UTH Matrícula: 23311900
 Concepto

Estás atrapado en un laberinto totalmente oscuro. Para ver, lanzas pulsos de sonido (ecos) que iluminan las paredes por un instante, como un murciélago. Tu objetivo es llegar a la salida con los pocos pulsos que tienes.

Pero en el laberinto hay un ente que no ve, solo escucha: cada pulso que lanzas lo alcanza, lo alerta y lo manda directo hacia donde sonó. El mismo eco que te ayuda a escapar es el que te puede matar.

Mecánicas
Al empezar cada nivel ves todo el mapa y al ente durante 7 segundos; después todo se oscurece. A partir de ahí el mapa se apaga 10 segundos y se ilumina 4 (con la salida y el ente visibles), una y otra vez.
Moverte: flechas o WASD (en móvil, mantén el dedo para caminar).
Pulso de sonido: clic o barra espaciadora (en móvil, toque rápido). Empiezas con 11 y cada nivel tienes menos (mínimo 6); se recargan solos, cada vez más lento.
Cada pulso ilumina las paredes (brillantes) y el camino (tenue) que tienes a la vista, y se desvanece.
Cuando la onda alcanza al ente, este se alerta y corre al punto del pulso; si el eco lo toca con línea de vista, lo ves un instante en rojo.
Si te acercas demasiado, también oye tus pasos y te persigue, pero duda: a veces se detiene un momento y actualiza tu posición con retraso, así que puedes huir si te mueves rápido.
Cuando el ente se acerca oyes sus pasos (más fuertes y rápidos mientras más cerca, y con dirección izquierda/derecha) y el camino por donde viene se ilumina en rojo.
Correr (Shift): mucho más rápido que el ente, con aliento limitado (se ve la barra). Si ganas distancia, el ente ya no oye tus pasos y pierde tu rastro.
Señuelo (E): lanza un ruido falso lejos de ti que desvía al ente y le hace ignorar tus pasos unos segundos. Tienes 3 en los primeros niveles y 1 en los últimos.
Al abrir el juego aparece una pantalla de instrucciones.
R o el botón "Reiniciar" empiezan de nuevo en cualquier momento.
El ente aparece siempre lejos de ti y de la salida.
Si te alcanza, pierdes.
Dificultad incremental: el nivel 1 es un laberinto pequeño (15×11) con ente lento y muchos pulsos y señuelos. Cada nivel el laberinto crece hasta 27×19, el ente es más rápido (en persecución y merodeando) y tienes menos pulsos y señuelos.
Se guarda tu récord (nivel máximo) con localStorage.
Audio (parte de la jugabilidad)

Todo se genera con la Web Audio API, sin archivos externos:

El tono del eco es más agudo mientras más cerca está una pared.
Un gruñido grave te avisa cuando el ente escuchó tu pulso.
Pasos del ente que se aceleran y suenan más fuerte al acercarse, con dirección izquierda/derecha.
Un sonido de aviso cuando lanzas un señuelo.
🛠️ Tecnologías

HTML5 Canvas · JavaScript (vanilla) · CSS · Web Audio API · GitHub Pages
 Plan de desarrollo
Generación del laberinto (backtracking) y movimiento con colisiones
Pulso de sonido y revelado de paredes con línea de vista
El ente: merodeo, alerta por el sonido y persecución (búsqueda en anchura)
Audio, niveles y récord
Publicación en GitHub Pages y video explicativo
 Jugar en línea

https://a23311900-jpg.github.io/jchh/
 Licencia

MIT. Código libre y liberado.
