import type { Particulas } from "@/contenido";

/**
 * El clima que rodea al libro: lluvia, pétalos, polen o papel dorado.
 * Cubre toda la pantalla, así en escritorio la lluvia también cae a los lados
 * de la página. Cada tipo sube y baja de a poco, para que un poema con lluvia
 * pueda dar paso a uno con sol sin un corte.
 */

type Tipo = Particulas["tipo"];

type Gota = { x: number; y: number; largo: number; vel: number; capa: number };
type Mota = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  giro: number;
  vGiro: number;
  fase: number;
  color: string;
};

const CAPAS_LLUVIA = [0.08, 0.14, 0.22];
const COLORES_PETALOS = ["#8e1420", "#a81a28", "#6e0f18"];
const COLORES_CONFETI = ["#e8bd60", "#d9a441", "#f3d58b", "#c8283a"];
const COLOR_POLEN = "#ffcf8a";

export class Clima {
  private readonly ctx: CanvasRenderingContext2D;
  private raf = 0;
  private corriendo = false;
  private ultimo = 0;
  private ancho = 0;
  private alto = 0;
  private viento = 0;
  private vientoObjetivo = 0;

  private gotas: Gota[] = [];
  private petalos: Mota[] = [];
  private polen: Mota[] = [];
  private confeti: Mota[] = [];

  private peso: Record<Tipo, number> = { lluvia: 0, petalos: 0, polen: 0, confeti: 0 };
  private objetivo: Record<Tipo, number> = { lluvia: 0, petalos: 0, polen: 0, confeti: 0 };
  private tinta = "205,218,230";

  constructor(private readonly lienzo: HTMLCanvasElement) {
    const ctx = lienzo.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D no disponible");
    this.ctx = ctx;
    this.redimensionar();
  }

  redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.ancho = window.innerWidth;
    this.alto = window.innerHeight;
    this.lienzo.width = Math.round(this.ancho * dpr);
    this.lienzo.height = Math.round(this.alto * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.sembrar();
  }

  /** Cuántas partículas caben sin molestar, según el tamaño de la pantalla. */
  private sembrar() {
    const area = (this.ancho * this.alto) / (390 * 844);
    const raiz = Math.sqrt(area);

    this.gotas = Array.from({ length: Math.min(300, Math.round(72 * area)) }, () => this.nuevaGota(true));
    this.petalos = Array.from({ length: Math.round(7 * raiz) }, () => this.nuevaMota("petalos", true));
    this.polen = Array.from({ length: Math.min(90, Math.round(28 * area)) }, () => this.nuevaMota("polen", true));
    this.confeti = Array.from({ length: Math.min(70, Math.round(20 * area)) }, () => this.nuevaMota("confeti", true));
  }

  private nuevaGota(sembrando: boolean): Gota {
    const capa = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;
    return {
      x: Math.random() * (this.ancho + 200) - 100,
      y: sembrando ? Math.random() * this.alto : -40 - Math.random() * 120,
      largo: 12 + capa * 7 + Math.random() * 9,
      vel: 760 + capa * 280 + Math.random() * 220,
      capa,
    };
  }

  private nuevaMota(tipo: "petalos" | "polen" | "confeti", sembrando: boolean): Mota {
    const azar = Math.random;
    const base = {
      x: azar() * this.ancho,
      y: sembrando ? azar() * this.alto : -20,
      giro: azar() * Math.PI * 2,
      fase: azar() * Math.PI * 2,
    };
    if (tipo === "petalos") {
      return {
        ...base,
        vx: 18 + azar() * 22,
        vy: 26 + azar() * 28,
        r: 1.5 + azar() * 1.7,
        vGiro: (azar() - 0.5) * 2.4,
        color: COLORES_PETALOS[Math.floor(azar() * COLORES_PETALOS.length)],
      };
    }
    if (tipo === "polen") {
      return {
        ...base,
        y: sembrando ? azar() * this.alto : this.alto + 10,
        vx: 3 + azar() * 7,
        vy: -(3 + azar() * 9),
        r: 0.5 + azar() * 1.1,
        vGiro: 0,
        color: COLOR_POLEN,
      };
    }
    return {
      ...base,
      vx: (azar() - 0.5) * 16,
      vy: 34 + azar() * 46,
      r: 1.6 + azar() * 2.2,
      vGiro: 1.2 + azar() * 3,
      color: COLORES_CONFETI[Math.floor(azar() * COLORES_CONFETI.length)],
    };
  }

  /** Cambia de clima. Lo que no esté en la lista se apaga de a poco. */
  definir(particulas: Particulas[] = [], tono = "#cdd8e0") {
    this.objetivo = { lluvia: 0, petalos: 0, polen: 0, confeti: 0 };
    for (const p of particulas) this.objetivo[p.tipo] = p.cantidad ?? 1;
    // La lluvia toma un poco del color de cada poema, sin dejar de ser lluvia.
    const n = parseInt(tono.replace("#", ""), 16);
    const mezclar = (c: number) => Math.round(205 * 0.78 + c * 0.22);
    this.tinta = `${mezclar((n >> 16) & 255)},${mezclar((n >> 8) & 255)},${mezclar(n & 255)}`;
    if (!this.corriendo) this.iniciar();
  }

  /** La lluvia se inclina apenas hacia donde se mueve el puntero: -1 a 1. */
  inclinar(valor: number) {
    this.vientoObjetivo = valor;
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
    this.ctx.clearRect(0, 0, this.ancho, this.alto);
  }

  private cuadro = (ahora: number) => {
    if (!this.corriendo) return;
    this.raf = requestAnimationFrame(this.cuadro);
    const dt = this.ultimo ? Math.min(0.05, (ahora - this.ultimo) / 1000) : 0.016;
    this.ultimo = ahora;

    for (const tipo of Object.keys(this.peso) as Tipo[]) {
      this.peso[tipo] += (this.objetivo[tipo] - this.peso[tipo]) * Math.min(1, dt * 1.6);
    }
    this.viento += (this.vientoObjetivo - this.viento) * Math.min(1, dt * 0.9);

    this.ctx.clearRect(0, 0, this.ancho, this.alto);
    this.lluvia(dt);
    this.motas(this.petalos, this.peso.petalos, dt, "petalos", ahora);
    this.motas(this.polen, this.peso.polen, dt, "polen", ahora);
    this.motas(this.confeti, this.peso.confeti, dt, "confeti", ahora);
  };

  private lluvia(dt: number) {
    const { ctx, gotas, ancho, alto } = this;
    if (this.peso.lluvia < 0.01) return;
    const activas = Math.floor(gotas.length * Math.min(1, this.peso.lluvia));
    const inclinacion = 0.09 + this.viento * 0.07;
    const refuerzo = Math.min(1, this.peso.lluvia);

    ctx.lineCap = "round";
    for (let capa = 0; capa < CAPAS_LLUVIA.length; capa++) {
      ctx.beginPath();
      for (let i = 0; i < activas; i++) {
        const g = gotas[i];
        if (g.capa !== capa) continue;
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x - g.largo * inclinacion, g.y - g.largo);
      }
      ctx.strokeStyle = `rgba(${this.tinta},${CAPAS_LLUVIA[capa] * refuerzo})`;
      ctx.lineWidth = 0.65 + capa * 0.25;
      ctx.stroke();
    }

    for (let i = 0; i < gotas.length; i++) {
      const g = gotas[i];
      g.y += g.vel * dt;
      g.x += g.vel * dt * inclinacion;
      if (g.y - g.largo > alto || g.x > ancho + 120) gotas[i] = this.nuevaGota(false);
    }
  }

  private motas(lista: Mota[], peso: number, dt: number, tipo: "petalos" | "polen" | "confeti", ahora: number) {
    if (peso < 0.01) return;
    const { ctx, ancho, alto } = this;
    const activas = Math.floor(lista.length * Math.min(1, peso));
    const alfaBase = Math.min(1, peso);

    for (let i = 0; i < lista.length; i++) {
      const m = lista[i];
      const vaiven = Math.sin(ahora / 900 + m.fase);
      m.x += (m.vx + vaiven * 10 + this.viento * 14) * dt;
      m.y += m.vy * dt;
      m.giro += m.vGiro * dt;

      const afuera = tipo === "polen" ? m.y < -10 : m.y > alto + 20;
      if (afuera || m.x > ancho + 30 || m.x < -30) {
        lista[i] = this.nuevaMota(tipo, false);
        if (m.x > ancho + 30) lista[i].x = -20;
        continue;
      }
      if (i >= activas) continue;

      ctx.fillStyle = m.color;
      if (tipo === "polen") {
        ctx.globalAlpha = alfaBase * (0.28 + 0.42 * (0.5 + 0.5 * Math.sin(ahora / 600 + m.fase)));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (tipo === "petalos") {
        ctx.globalAlpha = alfaBase * 0.85;
        ctx.beginPath();
        ctx.ellipse(m.x, m.y, m.r * 1.35, m.r * (0.35 + 0.45 * Math.abs(Math.cos(m.giro))), m.giro, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = alfaBase * 0.62;
        const voltear = Math.cos(m.giro);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(m.fase + m.giro * 0.25);
        ctx.fillRect(-m.r, (-m.r * 1.5 * Math.abs(voltear)) / 1, m.r * 2, m.r * 3 * Math.abs(voltear));
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
