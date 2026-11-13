// ===== ECO: un laberinto oscuro donde el sonido te guía... y te delata =====
const canvas = document.getElementById("juego");
const ctx = canvas.getContext("2d");
const T = 30, COLS = 21, ROWS = 15;          // tamaño del mosaico y del mapa
const W = COLS * T, H = ROWS * T;
const VEL_JUG = 120, VEL_ONDA = 240, MAX_R = 320, PULSOS_NIVEL = 10;

let estado = "inicio";                        // "inicio" | "jugando" | "fin"
let mapa, libres, jugador, ente, pulsos, vistas, salida, salidaVista;
let nivel = 1, pulsosRestantes = 0, latido = 0, ultimo = 0, flash = 0;
let record = Number(localStorage.getItem("ecoRecord")) || 1;
const teclas = {};
let toque = null, objetivoToque = null;

// ---------- Audio (Web Audio API, sin archivos) ----------
let audioCtx;
function iniciarAudio() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function tono(freq, dur, tipo = "sine", vol = 0.1, retraso = 0) {
  try {
    iniciarAudio();
    const t0 = audioCtx.currentTime + retraso;
    const osc = audioCtx.createOscillator();
    const gan = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.value = freq;
    gan.gain.setValueAtTime(vol, t0);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gan).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch (e) { /* sin audio, el juego sigue */ }
}
// Más agudo = pared más cerca
const sonidoEco = (cerca) => tono(300 + 900 * (1 - Math.min(cerca, 200) / 200), 0.6, "sine", 0.15);
const sonidoAlerta = () => { tono(70, 0.8, "sawtooth", 0.14); tono(95, 0.8, "sawtooth", 0.1); };
const sonidoMuerte = () => { tono(50, 1.2, "sawtooth", 0.22); tono(35, 1.4, "square", 0.15); };
const sonidoNivel = () => [523, 659, 784].forEach((f, i) => tono(f, 0.3, "triangle", 0.1, i * 0.12));

// ---------- Mapa ----------
function esMuro(tx, ty) {
  return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || mapa[ty][tx] === 1;
}

function generarMapa() {
  const m = Array.from({ length: ROWS }, () => Array(COLS).fill(1));
  const pila = [[1, 1]];
  m[1][1] = 0;
  while (pila.length) {                       // laberinto por "backtracking"
    const [x, y] = pila[pila.length - 1];
    const op = [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && m[ny][nx] === 1;
    });
    if (!op.length) { pila.pop(); continue; }
    const [dx, dy] = op[Math.floor(Math.random() * op.length)];
    m[y + dy / 2][x + dx / 2] = 0;
    m[y + dy][x + dx] = 0;
    pila.push([x + dx, y + dy]);
  }
  for (let i = 0; i < 25; i++) {              // huecos extra: hay varios caminos
    const x = 1 + Math.floor(Math.random() * (COLS - 2));
    const y = 1 + Math.floor(Math.random() * (ROWS - 2));
    if ((x % 2) + (y % 2) === 1) m[y][x] = 0;
  }
  return m;
}

function nuevoNivel() {
  mapa = generarMapa();
  libres = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!mapa[y][x]) libres.push({ x, y });
  jugador = { x: 1.5 * T, y: 1.5 * T };
  salida = { x: COLS - 2, y: ROWS - 2 };
  vistas = new Float32Array(COLS * ROWS).fill(-99);
  salidaVista = -99;
  pulsos = [];
  pulsosRestantes = PULSOS_NIVEL;
  const lejos = libres.filter((c) => Math.abs(c.x - 1) + Math.abs(c.y - 1) >= 18 && !(c.x === salida.x && c.y === salida.y));
  const c = lejos[Math.floor(Math.random() * lejos.length)];
  ente = { x: c.x * T + T / 2, y: c.y * T + T / 2, alerta: null, objetivo: null, visto: -99 };
}

function reiniciar() {
  iniciarAudio();
  nivel = 1;
  nuevoNivel();
  estado = "jugando";
  ultimo = performance.now();
  requestAnimationFrame(bucle);
}

// ---------- Visibilidad y rutas ----------
// ¿hay línea libre entre dos puntos? (el mosaico destino cuenta como visible)
function lineaLibre(ox, oy, cx, cy, mx = -1, my = -1) {
  const n = Math.max(1, Math.floor(Math.hypot(cx - ox, cy - oy) / 4));
  for (let k = 1; k <= n; k++) {
    const tx = Math.floor(ox + ((cx - ox) * k) / n) / T | 0;
    const ty = Math.floor(oy + ((cy - oy) * k) / n) / T | 0;
    if (esMuro(tx, ty)) return tx === mx && ty === my;
  }
  return true;
}

// Siguiente mosaico para ir de a hacia b (búsqueda en anchura)
function siguientePaso(a, b) {
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const ini = b.y * COLS + b.x;
  prev[ini] = ini;
  const cola = [ini];
  for (let h = 0; h < cola.length; h++) {
    const c = cola[h];
    if (c === a.y * COLS + a.x) break;
    const cx = c % COLS, cy = (c / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (esMuro(nx, ny)) continue;
      const n = ny * COLS + nx;
      if (prev[n] !== -1) continue;
      prev[n] = c;
      cola.push(n);
    }
  }
  const p = prev[a.y * COLS + a.x];
  return p === -1 ? null : { x: p % COLS, y: (p / COLS) | 0 };
}

// ---------- Pulso de sonido ----------
function emitir() {
  if (estado !== "jugando" || pulsosRestantes <= 0) return;
  pulsosRestantes--;
  const ox = jugador.x, oy = jugador.y;
  const muros = [];
  let cerca = 999;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!mapa[y][x]) continue;
      const cx = x * T + T / 2, cy = y * T + T / 2;
      const d = Math.hypot(cx - ox, cy - oy);
      if (d < MAX_R && lineaLibre(ox, oy, cx, cy, x, y)) {
        muros.push({ i: y * COLS + x, d, hecho: false });
        cerca = Math.min(cerca, d);
      }
    }
  }
  const sx = salida.x * T + T / 2, sy = salida.y * T + T / 2;
  const dSal = Math.hypot(sx - ox, sy - oy);
  pulsos.push({
    x: ox, y: oy, r: 0, muros, oido: false, salHecha: false,
    dSal: dSal < MAX_R && lineaLibre(ox, oy, sx, sy) ? dSal : null,
    tile: { x: Math.floor(ox / T), y: Math.floor(oy / T) },
  });
  sonidoEco(cerca);
}

// ---------- Lógica ----------
function libre(x, y) {
  const r = 6;
  return ![[-r, -r], [r, -r], [-r, r], [r, r]].some(([ax, ay]) => esMuro(Math.floor((x + ax) / T), Math.floor((y + ay) / T)));
}

function actualizarEnte(dt) {
  const t = { x: Math.floor(ente.x / T), y: Math.floor(ente.y / T) };
  let meta = ente.alerta || ente.objetivo;
  const llego = meta && t.x === meta.x && t.y === meta.y &&
    Math.hypot(ente.x - (t.x * T + T / 2), ente.y - (t.y * T + T / 2)) < 3;
  if (!meta || llego) {                       // terminó de buscar: vuelve a merodear
    ente.alerta = null;
    ente.objetivo = libres[Math.floor(Math.random() * libres.length)];
    meta = ente.objetivo;
  }
  const paso = siguientePaso(t, meta) || meta;
  const px = paso.x * T + T / 2, py = paso.y * T + T / 2;
  const d = Math.hypot(px - ente.x, py - ente.y);
  const v = (ente.alerta ? Math.min(125, 95 + nivel * 8) : 45) * dt;
  if (d > 0.01) {
    const k = Math.min(1, v / d);
    ente.x += (px - ente.x) * k;
    ente.y += (py - ente.y) * k;
  }
}

function actualizar(dt, ahora) {
  // Movimiento del jugador
  let dx = 0, dy = 0;
  if (teclas.ArrowLeft || teclas.a || teclas.A) dx--;
  if (teclas.ArrowRight || teclas.d || teclas.D) dx++;
  if (teclas.ArrowUp || teclas.w || teclas.W) dy--;
  if (teclas.ArrowDown || teclas.s || teclas.S) dy++;
  const n = Math.hypot(dx, dy);
  if (n) { dx /= n; dy /= n; }
  if (toque && toque.moved && objetivoToque) {
    const vx = objetivoToque.x - jugador.x, vy = objetivoToque.y - jugador.y;
    const d = Math.hypot(vx, vy);
    if (d > 10) { dx = vx / d; dy = vy / d; }
  }
  const nx = jugador.x + dx * VEL_JUG * dt;
  if (libre(nx, jugador.y)) jugador.x = nx;
  const ny = jugador.y + dy * VEL_JUG * dt;
  if (libre(jugador.x, ny)) jugador.y = ny;

  // Ondas: revelan paredes y... despiertan al ente
  for (const p of pulsos) {
    p.r += VEL_ONDA * dt;
    for (const m of p.muros) if (!m.hecho && p.r >= m.d) { m.hecho = true; vistas[m.i] = ahora; }
    if (p.dSal !== null && !p.salHecha && p.r >= p.dSal) { p.salHecha = true; salidaVista = ahora; }
    if (!p.oido && p.r >= Math.hypot(ente.x - p.x, ente.y - p.y)) {
      p.oido = true;
      ente.alerta = { ...p.tile };            // va hacia donde sonó el pulso
      if (lineaLibre(p.x, p.y, ente.x, ente.y)) ente.visto = ahora;
      sonidoAlerta();
    }
  }
  pulsos = pulsos.filter((p) => p.r < MAX_R + 40);

  actualizarEnte(dt);

  // Latido: más rápido mientras más cerca está el ente
  const dEnte = Math.hypot(ente.x - jugador.x, ente.y - jugador.y);
  if (dEnte < 200) {
    latido -= dt;
    if (latido <= 0) { tono(55, 0.15, "sine", 0.3); latido = 0.25 + (0.8 * dEnte) / 200; }
  }
  if (dEnte < 14) return morir();

  if (Math.floor(jugador.x / T) === salida.x && Math.floor(jugador.y / T) === salida.y) {
    nivel++;
    if (nivel > record) { record = nivel; localStorage.setItem("ecoRecord", record); }
    sonidoNivel();
    nuevoNivel();
  }
}

function morir() {
  estado = "fin";
  flash = performance.now();
  sonidoMuerte();
}

// ---------- Dibujo ----------
function texto(t, x, y, tam, color = "#b9c4d6", alin = "center") {
  ctx.fillStyle = color;
  ctx.font = `${tam}px Georgia, serif`;
  ctx.textAlign = alin;
  ctx.fillText(t, x, y);
}

function dibujar(ahora) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  if (estado === "inicio") {
    texto("ECO", W / 2, H / 2 - 40, 56, "#78dcff");
    texto("Todo está a oscuras. Lanza pulsos de sonido para ver las paredes.", W / 2, H / 2 + 5, 17);
    texto("Pero algo escucha cada pulso... y viene hacia ti.", W / 2, H / 2 + 32, 17, "#ff6b6b");
    texto("Presiona espacio o toca para empezar", W / 2, H / 2 + 75, 15, "#6f7f95");
    return;
  }

  // Paredes reveladas (se desvanecen)
  for (let i = 0; i < vistas.length; i++) {
    const a = 1 - (ahora - vistas[i]) / 2.2;
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(120,220,255,${a * 0.9})`;
    ctx.fillRect((i % COLS) * T, ((i / COLS) | 0) * T, T, T);
  }
  // Salida
  const aS = 1 - (ahora - salidaVista) / 3;
  if (aS > 0) {
    ctx.fillStyle = `rgba(120,255,160,${aS})`;
    ctx.fillRect(salida.x * T + 5, salida.y * T + 5, T - 10, T - 10);
  }
  // Ondas
  for (const p of pulsos) {
    ctx.strokeStyle = `rgba(120,220,255,${0.5 * (1 - p.r / MAX_R)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Ente (solo se ve un instante cuando el eco lo toca, o al morir)
  const aE = estado === "fin" ? 1 : 1 - (ahora - ente.visto) / 1.5;
  if (aE > 0) {
    const g = ctx.createRadialGradient(ente.x, ente.y, 2, ente.x, ente.y, 22);
    g.addColorStop(0, `rgba(255,60,60,${aE})`);
    g.addColorStop(1, "rgba(255,60,60,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ente.x, ente.y, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  // Jugador
  ctx.fillStyle = "rgba(255,224,138,0.85)";
  ctx.beginPath();
  ctx.arc(jugador.x, jugador.y, 5, 0, Math.PI * 2);
  ctx.fill();

  texto(`Nivel ${nivel}`, 10, 18, 14, "#6f7f95", "left");
  texto(`Pulsos: ${pulsosRestantes}`, W / 2, 18, 14, pulsosRestantes ? "#78dcff" : "#ff6b6b");
  texto(`Récord: nivel ${record}`, W - 10, 18, 14, "#6f7f95", "right");

  if (estado === "fin") {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    texto("Te encontró", W / 2, H / 2 - 20, 44, "#ff6b6b");
    texto(`Llegaste al nivel ${nivel}  ·  Récord: nivel ${record}`, W / 2, H / 2 + 18, 17);
    texto("Espacio o toca para intentarlo de nuevo", W / 2, H / 2 + 52, 15, "#6f7f95");
  }
}

function bucle(t) {
  const dt = Math.min((t - ultimo) / 1000, 0.05);
  ultimo = t;
  const ahora = t / 1000;
  if (estado === "jugando") actualizar(dt, ahora);
  dibujar(ahora);
  if (estado === "jugando") requestAnimationFrame(bucle);
}

// ---------- Controles ----------
window.addEventListener("keydown", (e) => {
  teclas[e.key] = true;
  if (e.code === "Space") {
    e.preventDefault();
    if (estado !== "jugando") reiniciar(); else emitir();
  }
  if (e.key.startsWith("Arrow")) e.preventDefault();
});
window.addEventListener("keyup", (e) => { teclas[e.key] = false; });

canvas.addEventListener("mousedown", () => {
  if (estado !== "jugando") reiniciar(); else emitir();
});

function posToque(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.touches[0].clientX - r.left) * W) / r.width, y: ((e.touches[0].clientY - r.top) * H) / r.height };
}
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (estado !== "jugando") return reiniciar();
  objetivoToque = posToque(e);
  toque = { t: performance.now(), x: objetivoToque.x, y: objetivoToque.y, moved: false };
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (!toque) return;
  objetivoToque = posToque(e);
  if (Math.hypot(objetivoToque.x - toque.x, objetivoToque.y - toque.y) > 12) toque.moved = true;
}, { passive: false });
canvas.addEventListener("touchend", () => {
  if (toque && !toque.moved && performance.now() - toque.t < 250) emitir();
  toque = null;
  objetivoToque = null;
});

dibujar(0);
