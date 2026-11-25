import type { BarDatum } from "@/lib/project-metrics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Gráficos dos relatórios em HTML e CSS, sem biblioteca: uma série por gráfico, um só tom
 * (--chart-1, validado nos dois temas), valor escrito ao lado de cada barra e a lista inteira
 * legível por leitor de tela. Passar o mouse mostra o valor e a porcentagem.
 */

const pct = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="gap-1 px-5 py-4">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Card>
  );
}

export function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Barras horizontais: uma linha por item, nome, barra e número alinhados. */
export function BarList({ data, unit, empty }: { data: BarDatum[]; unit: [string, string]; empty: string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => {
        const text = `${d.label}: ${d.value} ${d.value === 1 ? unit[0] : unit[1]} (${pct(d.value, total)}%)`;
        return (
          <li
            key={d.label}
            className="group grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 text-sm"
          >
            <span className="truncate text-text-secondary" title={d.label}>
              {d.label}
            </span>
            <span className="h-2.5 rounded-r-sm bg-muted" title={text}>
              <span
                className="block h-full rounded-r-sm bg-chart-1 transition-opacity group-hover:opacity-80"
                style={{ width: `${max ? (d.value / max) * 100 : 0}%` }}
              />
            </span>
            <span className="text-right font-medium tabular-nums">
              <span className="sr-only">{text}</span>
              <span aria-hidden="true">{d.value}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Colunas verticais (velocidade por sprint), com o valor em cima de cada coluna. */
export function ColumnChart({ data, unit, empty }: { data: BarDatum[]; unit: string; empty: string }) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (data.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol
      className="flex h-48 items-end gap-3 border-b border-border pt-6"
      aria-label="Pontos concluídos por sprint"
    >
      {data.map((d) => (
        <li
          key={d.label}
          className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
        >
          <span className="text-xs font-medium tabular-nums">
            <span className="sr-only">
              {d.label}: {d.value} {unit}
            </span>
            <span aria-hidden="true">{d.value}</span>
          </span>
          <span
            title={`${d.label}: ${d.value} ${unit}`}
            className="w-full max-w-12 rounded-t-sm bg-chart-1 transition-opacity group-hover:opacity-80"
            style={{ height: `${max ? Math.max((d.value / max) * 100, 2) : 2}%` }}
          />
          <span aria-hidden="true" className="w-full truncate text-center text-xs text-muted-foreground">
            {d.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Uma razão contra o total (progresso da sprint). */
export function Meter({ value, total, label }: { value: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium tabular-nums">
          {value} de {total} ({pct(value, total)}%)
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        className="h-2.5 overflow-hidden rounded-sm bg-muted"
      >
        <div className="h-full rounded-r-sm bg-chart-1" style={{ width: `${pct(value, total)}%` }} />
      </div>
    </div>
  );
}
