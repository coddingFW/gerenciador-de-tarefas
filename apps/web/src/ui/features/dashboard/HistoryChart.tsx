import type { HistoryPoint } from "@habit/core";

/**
 * Gráfico de barras em SVG puro (sem dependência de libs de chart — coerente com
 * o bundle mínimo do projeto). Escala pelo maior valor da série; rótulos esparsos
 * para caber no mobile. `metric` escolhe execuções (volume) ou minutos (tempo).
 */
export function HistoryChart({
  data,
  metric,
}: {
  data: HistoryPoint[];
  metric: "executions" | "minutes";
}) {
  const W = 320;
  const H = 120;
  const pad = { top: 8, bottom: 18, left: 4, right: 4 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const values = data.map((d) => (metric === "executions" ? d.executions : d.minutes));
  const max = Math.max(1, ...values);
  const n = data.length;
  const slot = chartW / n;
  const barW = Math.max(2, slot * 0.6);
  // Rótulos: ~6 marcações no eixo X, independentemente da janela.
  const labelEvery = Math.max(1, Math.round(n / 6));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      class="h-32 w-full"
      role="img"
      aria-label={`Histórico de ${metric === "executions" ? "execuções" : "minutos"} por dia`}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const v = values[i]!;
        const h = (v / max) * chartH;
        const x = pad.left + i * slot + (slot - barW) / 2;
        const y = pad.top + (chartH - h);
        const showLabel = i % labelEvery === 0 || i === n - 1;
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={1.5}
              class={v > 0 ? "fill-brand" : "fill-slate-200 dark:fill-slate-700"}
            >
              <title>{`${d.day}: ${d.executions} execuç${d.executions === 1 ? "ão" : "ões"}, ${d.minutes} min`}</title>
            </rect>
            {showLabel && (
              <text
                x={pad.left + i * slot + slot / 2}
                y={H - 6}
                text-anchor="middle"
                class="fill-slate-400 dark:fill-slate-500"
                style={{ fontSize: "7px" }}
              >
                {d.day.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
