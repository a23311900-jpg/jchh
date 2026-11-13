// ===== ECO: un laberinto oscuro donde el sonido te guía... y te delata =====
const canvas = document.getElementById("juego");
const ctx = canvas.getContext("2d");
const T = 30;                                // tamaño del mosaico
let COLS = 27, ROWS = 19;                    // tamaño del mapa (crece con el nivel)
let esc = 1, offX = 0, offY = 0;             // zoom y centrado del mapa en el lienzo
const W = canvas.width, H = canvas.height;
const VEL_JUG = 120, VEL_ONDA = 240, MAX_R = 380;
let PULSOS_NIVEL = 10, RECARGA = 4;       // cambian con el nivel
const RADIO_PASOS = 65, RADIO_OIR = 280;
const VEL_CARRERA = 190, ALIENTO_MAX = 2;   // correr: velocidad y segundos de aliento     // segundos por pulso nuevo / distancia a la que el ente oye tus pasos

let estado = "inicio";                        // "inicio" | "jugando" | "fin"
let mapa, libres, jugador, ente, pulsos, vistas, suelos, salida, salidaVista, previa = 0;
let aliento = ALIENTO_MAX, agotado = false, corriendo = false, senuelos = 2, senueloAnim = null;
let alertaRoja = { tiles: [], a: 0 };         // camino por donde viene el ente
let nivel = 1, pulsosRestantes = 0, latido = 0, ultimo = 0, flash = 0, tRecarga = 0, rafId = 0;
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
// Pasos del ente: más fuertes y rápidos al acercarse; el paneo indica de qué lado vienen
let pasoAlterno = false;
function paso(cerca, pan) {
  try {
    iniciarAudio();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gan = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = pasoAlterno ? 110 : 85;
    pasoAlterno = !pasoAlterno;
    gan.gain.setValueAtTime(0.04 + 0.3 * cerca, t0);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
    osc.connect(gan);
    if (audioCtx.createStereoPanner) {
      const p = audioCtx.createStereoPanner();
      p.pan.value = pan;
      gan.connect(p).connect(audioCtx.destination);
    } else gan.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.14);
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

// Dificultad incremental: laberinto más grande, menos pulsos y señuelos, ente más rápido
function ajustarDificultad() {
  COLS = Math.min(27, 15 + 2 * (nivel - 1));
  ROWS = Math.min(19, 11 + 2 * (nivel - 1));
  esc = Math.min(W / (COLS * T), H / (ROWS * T));
  offX = (W - COLS * T * esc) / 2;
  offY = (H - ROWS * T * esc) / 2;
  PULSOS_NIVEL = Math.max(6, 12 - nivel);
  RECARGA = Math.min(6, 3 + 0.4 * nivel);
  senuelos = nivel <= 2 ? 3 : nivel <= 5 ? 2 : 1;
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
  const huecos = Math.max(2, Math.round((COLS * ROWS) / 14 - nivel * 3));
  for (let i = 0; i < huecos; i++) {              // huecos extra: hay varios caminos
    const x = 1 + Math.floor(Math.random() * (COLS - 2));
    const y = 1 + Math.floor(Math.random() * (ROWS - 2));
    if ((x % 2) + (y % 2) === 1) m[y][x] = 0;
  }
  return m;
}

function nuevoNivel() {
  ajustarDificultad();
  mapa = generarMapa();
  libres = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!mapa[y][x]) libres.push({ x, y });
  jugador = { x: 1.5 * T, y: 1.5 * T };
  salida = { x: COLS - 2, y: ROWS - 2 };
  vistas = new Float32Array(COLS * ROWS).fill(-99);
  suelos = new Float32Array(COLS * ROWS).fill(-99);
  alertaRoja = { tiles: [], a: 0 };
  aliento = ALIENTO_MAX; agotado = false; corriendo = false;
  senueloAnim = null;
  previa = 7;                              // segundos viendo todo el mapa al inicio
  salidaVista = -99;
  pulsos = [];
  pulsosRestantes = PULSOS_NIVEL;
  tRecarga = 0;
  const lejos = libres.filter((c) => Math.abs(c.x - 1) + Math.abs(c.y - 1) >= Math.floor((COLS + ROWS) * 0.55) && !(c.x === salida.x && c.y === salida.y));
  const c = lejos[Math.floor(Math.random() * lejos.length)];
  ente = { x: c.x * T + T / 2, y: c.y * T + T / 2, alerta: null, objetivo: null, visto: -99, pausa: 0, rastro: 0, sinPausa: 3 };
}

function reiniciar() {
  iniciarAudio();
  nivel = 1;
  nuevoNivel();
  estado = "jugando";
  panel.classList.add("oculto");
  ultimo = performance.now();
  cancelAnimationFrame(rafId);            // evita dos bucles si reinicias en pleno juego
  rafId = requestAnimationFrame(bucle);
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

// Los siguientes mosaicos que recorrerá el ente de a hacia b
function rutaEnte(a, b, max) {
  const prev = new Int16Array(COLS * ROWS).fill(-1);
  const ini = b.y * COLS + b.x;
  prev[ini] = ini;
  const cola = [ini];
  for (let h = 0; h < cola.length; h++) {
    const c = cola[h];
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
  const tiles = [];
  let c = a.y * COLS + a.x;
  while (prev[c] !== -1 && c !== ini && tiles.length < max) { c = prev[c]; tiles.push(c); }
  return tiles;
}

// ---------- Pulso de sonido ----------
function emitir() {
  if (estado !== "jugando" || pulsosRestantes <= 0 || previa > 0) return;
  pulsosRestantes--;
  const ox = jugador.x, oy = jugador.y;
  const muros = [];
  let cerca = 999;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cx = x * T + T / 2, cy = y * T + T / 2;
      const d = Math.hypot(cx - ox, cy - oy);
      if (d >= MAX_R) continue;
      const i = y * COLS + x;
      if (mapa[y][x]) {
        // Pared: se revela si ves el centro o cualquiera de sus esquinas
        const pts = [[cx, cy], [x * T + 3, y * T + 3], [x * T + T - 3, y * T + 3],
                     [x * T + 3, y * T + T - 3], [x * T + T - 3, y * T + T - 3]];
        if (pts.some(([px, py]) => lineaLibre(ox, oy, px, py, x, y))) {
          muros.push({ i, d, suelo: false, hecho: false });
          cerca = Math.min(cerca, d);
        }
      } else if (lineaLibre(ox, oy, cx, cy)) {
        muros.push({ i, d, suelo: true, hecho: false });   // el camino también se ilumina
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

// ---------- Señuelo: un ruido falso que desvía al ente ----------
function tonoPan(freq, dur, vol, pan, retraso = 0) {
  try {
    iniciarAudio();
    const t0 = audioCtx.currentTime + retraso;
    const osc = audioCtx.createOscillator();
    const gan = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gan.gain.setValueAtTime(vol, t0);
    gan.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gan);
    if (audioCtx.createStereoPanner) {
      const p = audioCtx.createStereoPanner();
      p.pan.value = pan;
      gan.connect(p).connect(audioCtx.destination);
    } else gan.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch (e) { /* sin audio, el juego sigue */ }
}

function lanzarSenuelo() {
  if (estado !== "jugando" || previa > 0 || senuelos <= 0) return;
  const dJ = (c) => Math.hypot(c.x * T + T / 2 - jugador.x, c.y * T + T / 2 - jugador.y);
  const dE = (c) => Math.hypot(c.x * T + T / 2 - ente.x, c.y * T + T / 2 - ente.y);
  // Lugares lejos de ti pero más cerca del ente que de ti: así se aleja de tu posición
  const cand = libres.filter((c) => dJ(c) >= 150 && dJ(c) <= 380 && dE(c) < dJ(c))
    .sort((a, b) => (dJ(b) - dE(b)) - (dJ(a) - dE(a)))
    .slice(0, 5);
  if (!cand.length) return;
  const c = cand[Math.floor(Math.random() * cand.length)];
  senuelos--;
  const x = c.x * T + T / 2, y = c.y * T + T / 2;
  senueloAnim = { x, y, t0: performance.now() / 1000 };
  ente.alerta = { x: c.x, y: c.y };
  ente.rastro = 3.5;                          // ignora tus pasos un rato
  ente.pausa = 0;
  const pan = Math.max(-1, Math.min(1, (x - jugador.x) / 200));
  tonoPan(660, 0.25, 0.15, pan);
  tonoPan(990, 0.35, 0.12, pan, 0.12);
  sonidoAlerta();
}

// ---------- Lógica ----------
function libre(x, y) {
  const r = 6;
  return ![[-r, -r], [r, -r], [-r, r], [r, r]].some(([ax, ay]) => esMuro(Math.floor((x + ax) / T), Math.floor((y + ay) / T)));
}

function actualizarEnte(dt) {
  // El ente duda: de vez en cuando se detiene un momento y te da chance de huir
  if (ente.pausa > 0) { ente.pausa -= dt; return; }
  if (ente.alerta) {
    ente.sinPausa -= dt;
    if (ente.sinPausa <= 0) { ente.pausa = 0.8; ente.sinPausa = 2.5 + Math.random() * 2.5; return; }
  }
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
  let px = paso.x * T + T / 2, py = paso.y * T + T / 2;
  // Al final de la persecución va directo hacia ti (no hacia el centro del mosaico)
  const dJ = Math.hypot(jugador.x - ente.x, jugador.y - ente.y);
  if (ente.alerta && dJ < 45 && lineaLibre(ente.x, ente.y, jugador.x, jugador.y)) { px = jugador.x; py = jugador.y; }
  const d = Math.hypot(px - ente.x, py - ente.y);
  const v = (ente.alerta ? Math.min(115, 80 + nivel * 5) : 30 + nivel * 3) * dt;
  if (d > 0.01) {
    const k = Math.min(1, v / d);
    ente.x += (px - ente.x) * k;
    ente.y += (py - ente.y) * k;
  }
}

function actualizar(dt, ahora) {
  if (previa > 0) { previa -= dt; return; }   // fase de memorizar: todo congelado

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
  // Correr (Shift): mucho más rápido, pero con aliento limitado
  let vel = VEL_JUG;
  corriendo = false;
  if (teclas.Shift && (dx || dy) && !agotado && aliento > 0) {
    vel = VEL_CARRERA;
    corriendo = true;
    aliento -= dt;
    if (aliento <= 0) { aliento = 0; agotado = true; }
  } else {
    aliento = Math.min(ALIENTO_MAX, aliento + 0.4 * dt);
    if (agotado && aliento >= 0.8) agotado = false;
  }
  const nx = jugador.x + dx * vel * dt;
  if (libre(nx, jugador.y)) jugador.x = nx;
  const ny = jugador.y + dy * vel * dt;
  if (libre(jugador.x, ny)) jugador.y = ny;

  // Ondas: revelan paredes y... despiertan al ente
  for (const p of pulsos) {
    p.r += VEL_ONDA * dt;
    for (const m of p.muros) if (!m.hecho && p.r >= m.d) { m.hecho = true; (m.suelo ? suelos : vistas)[m.i] = ahora; }
    if (p.dSal !== null && !p.salHecha && p.r >= p.dSal) { p.salHecha = true; salidaVista = ahora; }
    if (!p.oido && p.r >= Math.hypot(ente.x - p.x, ente.y - p.y)) {
      p.oido = true;
      ente.alerta = { ...p.tile };            // va hacia donde sonó el pulso
      if (lineaLibre(p.x, p.y, ente.x, ente.y)) ente.visto = ahora;
      sonidoAlerta();
    }
  }
  pulsos = pulsos.filter((p) => p.r < MAX_R + 40);

  // Los pulsos se recargan con el tiempo (1 cada RECARGA segundos)
  if (pulsosRestantes < PULSOS_NIVEL) {
    tRecarga += dt;
    if (tRecarga >= RECARGA) { pulsosRestantes++; tRecarga = 0; }
  }

  // Si estás muy cerca, el ente oye tus pasos y te persigue; si te alejas más del radio, pierde tu rastro
  // (y solo actualiza tu posición cada 1.3 s, así que no te sigue con exactitud)
  ente.rastro -= dt;
  if (ente.rastro <= 0 && Math.hypot(ente.x - jugador.x, ente.y - jugador.y) < RADIO_PASOS) {
    ente.alerta = { x: Math.floor(jugador.x / T), y: Math.floor(jugador.y / T) };
    ente.rastro = 1.3;
  }

  actualizarEnte(dt);

  // Pasos del ente (con dirección) y camino rojo por donde viene
  const dEnte = Math.hypot(ente.x - jugador.x, ente.y - jugador.y);
  const meta = ente.alerta || ente.objetivo;
  if (dEnte < RADIO_OIR) {
    latido -= dt;
    if (latido <= 0) {
      paso(1 - dEnte / RADIO_OIR, Math.max(-1, Math.min(1, (ente.x - jugador.x) / 150)));
      latido = 0.3 + (0.9 * dEnte) / RADIO_OIR;
    }
    const tEnte = { x: Math.floor(ente.x / T), y: Math.floor(ente.y / T) };
    alertaRoja = { tiles: meta ? rutaEnte(tEnte, meta, 5) : [], a: 0.1 + 0.3 * (1 - dEnte / RADIO_OIR) };
  } else alertaRoja.tiles = [];
  if (dEnte < 18) return morir();

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

  ctx.save();
  ctx.translate(offX, offY);
  ctx.scale(esc, esc);

  // Mapa revelado (paredes brillantes, camino tenue); todo se desvanece
  const mem = previa > 0;
  const FADE = 3;
  for (let i = 0; i < vistas.length; i++) {
    const cx = i % COLS, cy = (i / COLS) | 0;
    let a;
    if (mapa[cy][cx]) a = (mem ? 1 : 1 - (ahora - vistas[i]) / FADE) * 0.9;
    else a = mem ? 0.1 : (1 - (ahora - suelos[i]) / FADE) * 0.12;
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(120,220,255,${a})`;
    ctx.fillRect(cx * T, cy * T, T, T);
  }
  // Salida
  const aS = mem ? 1 : 1 - (ahora - salidaVista) / 3;
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
  // Señuelo: anillo ámbar donde sonó el ruido falso
  if (senueloAnim) {
    const k = ahora - senueloAnim.t0;
    if (k < 1) {
      ctx.strokeStyle = `rgba(255,224,138,${1 - k})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(senueloAnim.x, senueloAnim.y, 8 + k * 60, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Camino por donde viene el ente
  // (más intenso cerca del ente: por ahí llegará primero)
  alertaRoja.tiles.forEach((i, k) => {
    ctx.fillStyle = `rgba(255,70,70,${alertaRoja.a * (1 - k / 6)})`;
    ctx.fillRect((i % COLS) * T, ((i / COLS) | 0) * T, T, T);
  });
  // Ente (solo se ve un instante cuando el eco lo toca, o al morir)
  const aE = estado === "fin" || mem ? 1 : 1 - (ahora - ente.visto) / 1.5;
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

  ctx.restore();

  texto(`Nivel ${nivel}`, 10, 18, 14, "#6f7f95", "left");
  texto(`Pulsos: ${pulsosRestantes}`, W / 2, 18, 14, pulsosRestantes ? "#78dcff" : "#ff6b6b");
  texto(`Récord: nivel ${record}`, W - 10, 18, 14, "#6f7f95", "right");
  texto(`Señuelos (E): ${senuelos}`, W - 10, 38, 14, senuelos ? "#ffe08a" : "#6f7f95", "right");
  ctx.fillStyle = "#1a2a36";                  // barra de aliento
  ctx.fillRect(10, 28, 100, 6);
  ctx.fillStyle = agotado ? "#ff6b6b" : "#ffe08a";
  ctx.fillRect(10, 28, 100 * (aliento / ALIENTO_MAX), 6);
  texto("Aliento (Shift)", 10, 48, 12, "#6f7f95", "left");

  if (mem) texto(`Memoriza el mapa y al ente: ${Math.ceil(previa)}`, W / 2, H - 10, 16, "#ffe08a");

  if (estado === "fin") {
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, W, H);
    texto("Te encontró", W / 2, H / 2 - 20, 44, "#ff6b6b");
    texto(`Llegaste al nivel ${nivel}  ·  Récord: nivel ${record}`, W / 2, H / 2 + 18, 17);
    texto("Espacio, R o el botón para intentarlo de nuevo", W / 2, H / 2 + 52, 15, "#6f7f95");
  }
}

function bucle(t) {
  const dt = Math.min((t - ultimo) / 1000, 0.05);
  ultimo = t;
  const ahora = t / 1000;
  if (estado === "jugando") actualizar(dt, ahora);
  dibujar(ahora);
  if (estado === "jugando") rafId = requestAnimationFrame(bucle);
}

// ---------- Controles ----------
window.addEventListener("keydown", (e) => {
  teclas[e.key] = true;
  teclas[e.key.toLowerCase()] = true;      // evita teclas pegadas al usar Shift
  if (e.code === "Space") {
    e.preventDefault();
    if (estado !== "jugando") reiniciar(); else emitir();
  }
  if (e.code === "KeyE") lanzarSenuelo();
  if (e.code === "KeyR") reiniciar();     // R: reiniciar en cualquier momento
  if (e.key.startsWith("Arrow")) e.preventDefault();
});
window.addEventListener("keyup", (e) => { teclas[e.key] = false; teclas[e.key.toLowerCase()] = false; });

canvas.addEventListener("mousedown", () => {
  if (estado !== "jugando") reiniciar(); else emitir();
});

function posToque(e) {
  const r = canvas.getBoundingClientRect();
  const t = e.targetTouches[0] || e.changedTouches[0];
  const cx = ((t.clientX - r.left) * W) / r.width, cy = ((t.clientY - r.top) * H) / r.height;
  return { x: (cx - offX) / esc, y: (cy - offY) / esc };   // a coordenadas del mapa
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

const panel = document.getElementById("instrucciones");
document.getElementById("comenzar").addEventListener("click", () => reiniciar());
const botonReiniciar = document.getElementById("reiniciar");
botonReiniciar.addEventListener("click", () => { reiniciar(); botonReiniciar.blur(); });

// Botones para móvil: Correr (mantener presionado) y Señuelo
const botonCorrer = document.getElementById("correr");
botonCorrer.addEventListener("pointerdown", (e) => { e.preventDefault(); teclas.Shift = true; });
["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
  botonCorrer.addEventListener(ev, () => { teclas.Shift = false; }));
const botonSenuelo = document.getElementById("senuelo");
botonSenuelo.addEventListener("click", () => { lanzarSenuelo(); botonSenuelo.blur(); });

dibujar(0);
