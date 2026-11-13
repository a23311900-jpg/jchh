// ===== Void Dodger: esquiva los bloques que caen =====
const canvas = document.getElementById("juego");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

// ---- Estado del juego ----
let estado = "inicio";            // "inicio" | "jugando" | "fin"
let jugador, obstaculos, puntos, record, tiempoSpawn, velocidad, ultimo;
const teclas = {};
record = Number(localStorage.getItem("voidDodgerRecord")) || 0;

// ---- Audio con Web Audio API (sin archivos externos) ----
let audioCtx;
function tono(freq, dur, tipo = "square", vol = 0.08) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gan = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    gan.gain.setValueAtTime(vol, audioCtx.currentTime);
    gan.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gan).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) { /* si no hay audio, el juego sigue */ }
}
const sonidoPunto = () => tono(880, 0.08, "triangle");
const sonidoChoque = () => { tono(120, 0.4, "sawtooth", 0.12); tono(80, 0.5, "square", 0.1); };

// ---- Inicio / reinicio ----
function reiniciar() {
  jugador = { x: W / 2 - 18, y: H - 60, w: 36, h: 36, vel: 360 };
  obstaculos = [];
  puntos = 0;
  tiempoSpawn = 0;
  velocidad = 160;
  estado = "jugando";
  ultimo = performance.now();
  requestAnimationFrame(bucle);
}

// ---- Obstáculos ----
function crearObstaculo() {
  const w = 24 + Math.random() * 46;
  obstaculos.push({
    x: Math.random() * (W - w),
    y: -30,
    w,
    h: 24 + Math.random() * 20,
    vy: velocidad * (0.8 + Math.random() * 0.6),
    contado: false,
  });
}

function hayChoque(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---- Actualizar lógica ----
function actualizar(dt) {
  // Movimiento del jugador
  let dir = 0;
  if (teclas["ArrowLeft"] || teclas["a"] || teclas["A"]) dir -= 1;
  if (teclas["ArrowRight"] || teclas["d"] || teclas["D"]) dir += 1;
  jugador.x += dir * jugador.vel * dt;
  jugador.x = Math.max(0, Math.min(W - jugador.w, jugador.x));

  // Dificultad creciente
  velocidad += 6 * dt;
  tiempoSpawn -= dt;
  if (tiempoSpawn <= 0) {
    crearObstaculo();
    tiempoSpawn = Math.max(0.25, 0.9 - puntos / 120);
  }

  // Mover obstáculos y detectar colisiones
  for (const o of obstaculos) {
    o.y += o.vy * dt;
    if (hayChoque(jugador, o)) return terminar();
    if (!o.contado && o.y > jugador.y + jugador.h) {
      o.contado = true;
      puntos += 1;
      sonidoPunto();
    }
  }
  obstaculos = obstaculos.filter((o) => o.y < H + 50);
}

function terminar() {
  estado = "fin";
  sonidoChoque();
  if (puntos > record) {
    record = puntos;
    localStorage.setItem("voidDodgerRecord", record);
  }
}

// ---- Dibujar ----
function texto(t, x, y, tam, color = "#e8e6f0") {
  ctx.fillStyle = color;
  ctx.font = `${tam}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText(t, x, y);
}

function dibujar() {
  ctx.clearRect(0, 0, W, H);
  if (estado !== "inicio") {
    ctx.fillStyle = "#ffb703";
    ctx.fillRect(jugador.x, jugador.y, jugador.w, jugador.h);
    ctx.fillStyle = "#7b6cf6";
    for (const o of obstaculos) ctx.fillRect(o.x, o.y, o.w, o.h);
    ctx.textAlign = "left";
    ctx.fillStyle = "#e8e6f0";
    ctx.font = "18px Georgia, serif";
    ctx.fillText(`Puntos: ${puntos}`, 12, 26);
    ctx.textAlign = "right";
    ctx.fillText(`Récord: ${record}`, W - 12, 26);
  }
  if (estado === "inicio") {
    texto("Void Dodger", W / 2, H / 2 - 30, 40, "#ffb703");
    texto("Esquiva los bloques que caen", W / 2, H / 2 + 10, 18);
    texto("Presiona espacio o toca para jugar", W / 2, H / 2 + 45, 16);
  }
  if (estado === "fin") {
    ctx.fillStyle = "rgba(20,22,31,0.75)";
    ctx.fillRect(0, 0, W, H);
    texto("Game Over", W / 2, H / 2 - 30, 40, "#ffb703");
    texto(`Puntos: ${puntos}  ·  Récord: ${record}`, W / 2, H / 2 + 10, 18);
    texto("Espacio o toca para reiniciar", W / 2, H / 2 + 45, 16);
  }
}

// ---- Bucle principal ----
function bucle(ahora) {
  const dt = Math.min((ahora - ultimo) / 1000, 0.05);
  ultimo = ahora;
  if (estado === "jugando") actualizar(dt);
  dibujar();
  if (estado === "jugando") requestAnimationFrame(bucle);
}

// ---- Controles ----
window.addEventListener("keydown", (e) => {
  teclas[e.key] = true;
  if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    if (estado !== "jugando") reiniciar();
  }
  if (e.key.startsWith("Arrow")) e.preventDefault();
});
window.addEventListener("keyup", (e) => { teclas[e.key] = false; });

// Táctil / mouse: mitad izquierda o derecha del canvas
function mover(e) {
  const r = canvas.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  teclas["ArrowLeft"] = x < r.width / 2;
  teclas["ArrowRight"] = x >= r.width / 2;
}
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (estado !== "jugando") return reiniciar();
  mover(e);
}, { passive: false });
canvas.addEventListener("touchmove", (e) => { e.preventDefault(); mover(e); }, { passive: false });
canvas.addEventListener("touchend", () => { teclas["ArrowLeft"] = false; teclas["ArrowRight"] = false; });
canvas.addEventListener("click", () => { if (estado !== "jugando") reiniciar(); });

dibujar(); // pantalla de inicio
