import type { Zona } from "@/contenido";

/**
 * Capa viva sobre la imagen de cada página.
 *
 * En reposo el lienzo es transparente salvo en las zonas declaradas en el clima
 * de la página: el texto sigue viniendo del <img> de abajo, siempre nítido, y si
 * WebGL falla el libro se ve igual, solo que quieto.
 *
 * Al pasar de página el lienzo se vuelve opaco un momento y la lluvia lava una
 * imagen para revelar la siguiente.
 */

const MAX_ZONAS = 10;
const MAX_TEXTURAS = 6;

const VERTICES = `
attribute vec2 p;
varying vec2 vUv;
void main(){
  vUv = vec2(p.x * .5 + .5, .5 - p.y * .5);
  gl_Position = vec4(p, 0., 1.);
}`;

const COMUN = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x),
             mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(11., 7.);
    a *= .5;
  }
  return v;
}`;

const FRAGMENTO_VIVO = `${COMUN}
uniform sampler2D uA;
uniform float uT;
uniform int uN;
uniform vec4 uZ[${MAX_ZONAS}];
uniform vec4 uP[${MAX_ZONAS}];
uniform vec3 uC[${MAX_ZONAS}];

void main(){
  vec2 uv = vUv;
  vec2 d = vec2(0.);
  float aD = 0.;

  for (int i = 0; i < ${MAX_ZONAS}; i++) {
    if (i >= uN) break;
    vec4 p = uP[i];
    if (p.x > .5 && p.x < 2.5) continue;
    if (p.x > 3.5 && p.x < 5.5) continue;
    vec2 q = (uv - uZ[i].xy) / uZ[i].zw;
    float r = dot(q, q);
    if (r >= 1.) continue;
    float m = smoothstep(1., .25, r);
    float t = uT * p.z + p.w;
    if (p.x < .5) {
      // agua: reflejos que tiemblan en horizontal
      float a = (noise(vec2(uv.y * 150., t * 1.2)) - .5) * .014
              + (noise(vec2(uv.x * 35., uv.y * 70. + t * 1.6)) - .5) * .008;
      float b = (noise(vec2(uv.x * 50., uv.y * 110. - t * 1.1)) - .5) * .006;
      d += vec2(a, b) * m * p.y;
      aD = max(aD, m);
    } else if (p.x < 3.5) {
      // viento: pastos, hojas, tela
      float g = noise(vec2(uv.x * 5. + t * .35, uv.y * 4.));
      float w = sin(uv.y * 34. + uv.x * 10. + t * 1.4 + g * 5.) * .0042;
      d += vec2(w, w * .25) * m * p.y;
      aD = max(aD, m);
    } else {
      // nube: el cielo respira muy despacio
      float n1 = noise(uv * vec2(4., 6.) + vec2(t * .05, 0.));
      float n2 = noise(uv * vec2(5., 7.) + vec2(7., -t * .04));
      d += vec2(n1 - .5, n2 - .5) * .032 * m * p.y;
      aD = max(aD, m);
    }
  }

  vec3 base = texture2D(uA, uv + d).rgb;
  float luma = dot(base, vec3(.299, .587, .114));
  vec3 suma = vec3(0.);
  vec3 velo = vec3(0.);
  float fa = 0.;

  for (int i = 0; i < ${MAX_ZONAS}; i++) {
    if (i >= uN) break;
    vec4 p = uP[i];
    if (p.x < .5 || (p.x > 2.5 && p.x < 3.5) || p.x > 5.5) continue;
    vec2 q = (uv - uZ[i].xy) / uZ[i].zw;
    float r = dot(q, q);
    if (r >= 1.) continue;
    float m = smoothstep(1., .1, r);
    float t = uT * p.z + p.w;
    if (p.x < 1.5) {
      // niebla: solo donde la imagen ya es clara, para no tapar las figuras
      float n = fbm(vec2(uv.x * 3.2 + t * .05, uv.y * 9. - t * .012));
      float a = smoothstep(.36, .8, n) * m * p.y * smoothstep(.05, .28, luma);
      velo = velo * (1. - a) + uC[i] * a;
      fa = fa + a - fa * a;
    } else if (p.x < 2.5) {
      // luz: pulso con un temblor irregular
      float f = .62 + .28 * sin(t) + .35 * (noise(vec2(t * 2.3, p.w)) - .5);
      suma += uC[i] * m * m * p.y * f;
    } else if (p.x < 4.5) {
      // humo: una columna que sube y se abre
      float h = clamp((uZ[i].y + uZ[i].w - uv.y) / (2. * uZ[i].w), 0., 1.);
      float cx = uZ[i].x + (noise(vec2(h * 3. - t * .25, p.w)) - .5) * .09 * h;
      float ancho = mix(.006, .05, h);
      float dd = (uv.x - cx) / ancho;
      float a = exp(-dd * dd) * smoothstep(0., .12, h) * (1. - h);
      a *= .55 + .45 * noise(vec2(uv.x * 40., uv.y * 30. + t * .8));
      suma += uC[i] * a * p.y * .55;
    } else {
      // centelleo: las luces encendidas de la imagen titilan
      vec2 celda = floor(uv * vec2(170., 300.));
      float paso = floor(t);
      float v = mix(hash(celda + paso * .37), hash(celda + (paso + 1.) * .37), fract(t));
      suma += base * m * p.y * smoothstep(.35, .85, luma) * v * v * 1.2;
    }
  }

  vec3 color = base * aD * (1. - fa) + velo;
  float alfa = aD + fa - aD * fa;
  gl_FragColor = vec4(color + suma, alfa);
}`;

const FRAGMENTO_LAVADO = `${COMUN}
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uP;
uniform float uDir;
uniform float uS;

void main(){
  vec2 uv = vUv;
  float sentido = uDir > 0. ? 1. : -1.;
  float y = uDir > 0. ? uv.y : 1. - uv.y;

  float gruesa = fbm(vec2(uv.x * 5. + uS, uS * .7));
  float fina = noise(vec2(uv.x * 46. + uS * 3., uS));
  float hilos = pow(noise(vec2(uv.x * 120. + uS * 5., uS * 2.)), 3.);
  float retraso = gruesa * .42 + fina * .14 + hilos * .24;

  float frente = uP * 1.9 - .1;
  float dist = frente - (y + retraso);
  float m = smoothstep(0., .05, dist);
  float borde = exp(-abs(dist) * 24.);

  vec2 refr = vec2((noise(vec2(uv.x * 30., uv.y * 22. + uP * 6.)) - .5) * .04, -.06 * sentido) * borde;
  vec2 arrastre = vec2(0., -.05 * sentido * smoothstep(0., .9, uP));

  vec3 a = texture2D(uA, uv + refr + arrastre * (1. - m)).rgb;
  vec3 b = texture2D(uB, uv + refr * .7).rgb;
  vec3 c = mix(a, b, m);

  c += borde * borde * .14 * vec3(.88, .94, 1.);
  c *= 1. - .24 * sin(3.14159 * uP);
  gl_FragColor = vec4(c, 1.);
}`;

const TIPOS: Record<Zona["tipo"], number> = {
  agua: 0,
  niebla: 1,
  luz: 2,
  viento: 3,
  humo: 4,
  centelleo: 5,
  nube: 6,
};

function aRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type Programa = { programa: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

function compilar(gl: WebGLRenderingContext, fragmento: string, uniformes: string[]): Programa {
  const crear = (tipo: number, fuente: string) => {
    const s = gl.createShader(tipo);
    if (!s) throw new Error("No se pudo crear el shader");
    gl.shaderSource(s, fuente);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s) ?? "Error al compilar el shader");
    }
    return s;
  };
  const programa = gl.createProgram();
  if (!programa) throw new Error("No se pudo crear el programa");
  gl.attachShader(programa, crear(gl.VERTEX_SHADER, VERTICES));
  gl.attachShader(programa, crear(gl.FRAGMENT_SHADER, fragmento));
  gl.bindAttribLocation(programa, 0, "p");
  gl.linkProgram(programa);
  if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(programa) ?? "Error al enlazar el programa");
  }
  const u: Programa["u"] = {};
  for (const nombre of uniformes) u[nombre] = gl.getUniformLocation(programa, nombre);
  return { programa, u };
}

const facilitar = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

type Lavado = {
  a: WebGLTexture;
  b: WebGLTexture;
  dir: number;
  inicio: number;
  duracion: number;
  semilla: number;
  alTerminar?: () => void;
};

export class Vivo {
  private readonly gl: WebGLRenderingContext;
  private vivo!: Programa;
  private lavado!: Programa;
  private perdido = false;
  private imagenEscena: HTMLImageElement | null = null;
  private zonasEscena: Zona[] = [];
  private readonly texturas = new Map<HTMLImageElement, WebGLTexture>();
  private raf = 0;
  private corriendo = false;
  private inicio = performance.now();
  private ultimo = 0;
  private lavadoActual: Lavado | null = null;

  private texturaEscena: WebGLTexture | null = null;
  private zonas = new Float32Array(MAX_ZONAS * 4);
  private params = new Float32Array(MAX_ZONAS * 4);
  private colores = new Float32Array(MAX_ZONAS * 3);
  private cantidad = 0;
  private limpio = false;

  private escala: number;
  private ancho = 0;
  private alto = 0;
  private lentos = 0;
  private cuadros = 0;
  private zonasApagadas = false;

  constructor(private readonly lienzo: HTMLCanvasElement) {
    const gl = lienzo.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL no disponible");
    this.gl = gl;
    this.escala = Math.min(window.devicePixelRatio || 1, 1.5);
    this.prepararContexto();
    lienzo.addEventListener("webglcontextlost", this.alPerder);
    lienzo.addEventListener("webglcontextrestored", this.alRestaurar);
  }

  private prepararContexto() {
    const { gl } = this;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.viewport(0, 0, this.lienzo.width, this.lienzo.height);
    this.vivo = compilar(gl, FRAGMENTO_VIVO, ["uA", "uT", "uN", "uZ", "uP", "uC"]);
    this.lavado = compilar(gl, FRAGMENTO_LAVADO, ["uA", "uB", "uP", "uDir", "uS"]);
  }

  // Los celulares pueden quitarle el contexto a una pestaña en segundo plano. Mientras
  // tanto el lienzo queda transparente y se ve la imagen de abajo, con fundidos.
  private alPerder = (e: Event) => {
    e.preventDefault();
    this.perdido = true;
    const lavado = this.lavadoActual;
    this.lavadoActual = null;
    lavado?.alTerminar?.();
    this.texturas.clear();
    this.texturaEscena = null;
  };

  private alRestaurar = () => {
    this.perdido = false;
    this.limpio = false;
    try {
      this.prepararContexto();
      this.escena(this.imagenEscena, this.zonasEscena);
    } catch {
      this.perdido = true;
    }
  };

  /** Sube una imagen a la placa de video antes de que haga falta. */
  preparar(img: HTMLImageElement) {
    if (!this.perdido && img.complete && img.naturalWidth > 0) this.textura(img);
  }

  redimensionar(ancho: number, alto: number) {
    this.ancho = ancho;
    this.alto = alto;
    this.aplicarTamano();
  }

  private aplicarTamano() {
    const w = Math.max(1, Math.round(this.ancho * this.escala));
    const h = Math.max(1, Math.round(this.alto * this.escala));
    if (this.lienzo.width !== w || this.lienzo.height !== h) {
      this.lienzo.width = w;
      this.lienzo.height = h;
      this.gl.viewport(0, 0, w, h);
      this.limpio = false;
    }
  }

  private textura(img: HTMLImageElement) {
    const existente = this.texturas.get(img);
    if (existente) {
      // Se reinserta para que el Map quede ordenado de la menos a la más usada.
      this.texturas.delete(img);
      this.texturas.set(img, existente);
      return existente;
    }
    const { gl } = this;
    const t = gl.createTexture();
    if (!t) return null;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    this.texturas.set(img, t);
    this.recortarTexturas();
    return t;
  }

  /** Conserva solo las imágenes usadas hace poco, sin tocar las que están en pantalla. */
  private recortarTexturas() {
    if (this.texturas.size <= MAX_TEXTURAS) return;
    const lavado = this.lavadoActual;
    for (const [img, t] of this.texturas) {
      if (t === this.texturaEscena || t === lavado?.a || t === lavado?.b) continue;
      this.gl.deleteTexture(t);
      this.texturas.delete(img);
      return;
    }
  }

  /** Define qué imagen y qué zonas están vivas. */
  escena(img: HTMLImageElement | null, zonas: Zona[] = []) {
    this.imagenEscena = img;
    this.zonasEscena = zonas;
    if (this.perdido) return;
    this.limpio = false;
    this.texturaEscena = img ? this.textura(img) : null;
    const lista = this.zonasApagadas ? [] : zonas.slice(0, MAX_ZONAS);
    this.cantidad = lista.length;
    lista.forEach((z, i) => {
      this.zonas.set([z.x, z.y, z.rx, z.ry], i * 4);
      this.params.set([TIPOS[z.tipo], z.fuerza ?? 1, z.velocidad ?? 1, i * 1.7], i * 4);
      this.colores.set(aRgb(z.color ?? "#ffffff"), i * 3);
    });
  }

  /** Lava la imagen `a` para revelar la `b`. Devuelve false si no pudo. */
  lavar(a: HTMLImageElement, b: HTMLImageElement, dir: number, duracion: number, alTerminar?: () => void) {
    if (this.perdido) return false;
    const ta = this.textura(a);
    const tb = this.textura(b);
    if (!ta || !tb) return false;
    // Si ya había un lavado en curso, termina ahora: la orden nueva manda.
    this.lavadoActual?.alTerminar?.();
    this.lavadoActual = {
      a: ta,
      b: tb,
      dir,
      duracion,
      alTerminar,
      inicio: performance.now(),
      semilla: Math.random() * 40,
    };
    // Primer cuadro en el mismo instante, antes de que cambie la imagen de abajo.
    this.dibujarLavado(performance.now());
    if (!this.corriendo) this.iniciar();
    return true;
  }

  iniciar() {
    if (this.corriendo) return;
    this.corriendo = true;
    this.ultimo = 0;
    this.raf = requestAnimationFrame(this.cuadro);
  }

  detener() {
    this.corriendo = false;
    cancelAnimationFrame(this.raf);
  }

  destruir() {
    this.detener();
    this.lienzo.removeEventListener("webglcontextlost", this.alPerder);
    this.lienzo.removeEventListener("webglcontextrestored", this.alRestaurar);
    for (const t of this.texturas.values()) this.gl.deleteTexture(t);
    this.texturas.clear();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private cuadro = (ahora: number) => {
    if (!this.corriendo) return;
    this.raf = requestAnimationFrame(this.cuadro);
    if (this.perdido) return;

    if (this.lavadoActual) {
      this.dibujarLavado(ahora);
      return;
    }

    // En reposo alcanza con unos 30 cuadros por segundo: ahorra batería.
    const delta = ahora - this.ultimo;
    if (this.ultimo && delta < 30) return;
    this.medir(delta);
    this.ultimo = ahora;
    this.dibujarVivo(ahora);
  };

  /** Si el equipo no da abasto, baja la resolución y, si no alcanza, apaga las zonas. */
  private medir(delta: number) {
    if (!this.ultimo || delta > 400) return;
    this.cuadros += 1;
    if (delta > 60) this.lentos += 1;
    if (this.cuadros < 60) return;
    if (this.lentos > 30) {
      if (this.escala > 0.75) {
        this.escala = 0.75;
        this.aplicarTamano();
      } else {
        this.zonasApagadas = true;
        this.cantidad = 0;
      }
    }
    this.cuadros = 0;
    this.lentos = 0;
  }

  private dibujarLavado(ahora: number) {
    const l = this.lavadoActual;
    if (!l) return;
    const { gl, lavado } = this;
    const t = Math.min(1, (ahora - l.inicio) / l.duracion);
    gl.useProgram(lavado.programa);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, l.a);
    gl.uniform1i(lavado.u.uA, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, l.b);
    gl.uniform1i(lavado.u.uB, 1);
    gl.uniform1f(lavado.u.uP, facilitar(t));
    gl.uniform1f(lavado.u.uDir, l.dir);
    gl.uniform1f(lavado.u.uS, l.semilla);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.limpio = false;
    if (t >= 1) {
      this.lavadoActual = null;
      l.alTerminar?.();
    }
  }

  private dibujarVivo(ahora: number) {
    const { gl, vivo } = this;
    if (!this.texturaEscena || this.cantidad === 0) {
      if (!this.limpio) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        this.limpio = true;
      }
      return;
    }
    gl.useProgram(vivo.programa);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texturaEscena);
    gl.uniform1i(vivo.u.uA, 0);
    gl.uniform1f(vivo.u.uT, (ahora - this.inicio) / 1000);
    gl.uniform1i(vivo.u.uN, this.cantidad);
    gl.uniform4fv(vivo.u.uZ, this.zonas);
    gl.uniform4fv(vivo.u.uP, this.params);
    gl.uniform3fv(vivo.u.uC, this.colores);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.limpio = false;
  }
}
