export type LightState = "green" | "yellow" | "red";

type ControllerConfig = {
  minGreenMs: number;
  maxGreenMs: number;
  yellowMs: number;
};

const DEFAULT_CONFIG: ControllerConfig = {
  minGreenMs: 5000,
  maxGreenMs: 20000,
  yellowMs: 2000,
};

export class TrafficController {
  private zones: number;
  private cfg: ControllerConfig;
  private current = 0; // zona que tiene (o tenía) el verde
  private next = 0;    // zona que sigue después del amarillo
  private phase: "green" | "yellow" = "green";
  private phaseStart: number | null = null;

  constructor(zones: number, cfg: Partial<ControllerConfig> = {}) {
    this.zones = zones;
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
  }

  /** Llamar cada vez que haya un conteo nuevo. `now` en milisegundos. */
  update(counts: number[], now: number): LightState[] {
    if (this.zones === 0) return [];
    if (this.phaseStart === null) this.phaseStart = now;
    const elapsed = now - this.phaseStart;

    if (this.phase === "green") {
      // Zona con más vehículos esperando (distinta a la que tiene el verde)
      let best = -1;
      let bestCount = 0;
      counts.forEach((c, i) => {
        if (i !== this.current && i < this.zones && c > bestCount) {
          best = i;
          bestCount = c;
        }
      });
      const mine = counts[this.current] ?? 0;
      const someoneWaiting = best !== -1;

      const switchNow =
        someoneWaiting &&
        elapsed >= this.cfg.minGreenMs &&
        (mine === 0 || elapsed >= this.cfg.maxGreenMs || bestCount > mine * 1.5);

      if (switchNow) {
        this.phase = "yellow";
        this.next = best;
        this.phaseStart = now;
      }
    } else if (elapsed >= this.cfg.yellowMs) {
      this.current = this.next;
      this.phase = "green";
      this.phaseStart = now;
    }

    return Array.from({ length: this.zones }, (_, i): LightState =>
      i === this.current ? this.phase : "red"
    );
  }
}
