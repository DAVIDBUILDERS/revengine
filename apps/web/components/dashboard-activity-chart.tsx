import type { TeamActivityPoint } from "@david/domain/delivery";

const SERIES = [
  { key: "artifacts" as const, label: "Drafts saved", color: "#d7e2c0" },
  { key: "actions" as const, label: "Actions recorded", color: "#8fa67a" },
  { key: "findings" as const, label: "Recommendations", color: "#5f7354" },
];

export function DashboardActivityChart({
  points,
  onSelect,
}: {
  points: TeamActivityPoint[];
  onSelect: (agentId: string) => void;
}) {
  const width = 720;
  const height = 300;
  const pad = { top: 18, right: 16, bottom: 58, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.flatMap((point) => [point.artifacts, point.actions, point.findings]));
  const ticks = [0, Math.ceil(max / 2), max];
  const groupWidth = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.min(16, Math.max(8, (groupWidth - 20) / SERIES.length));

  return (
    <figure className="dashboard-chart">
      <div className="dashboard-chart-legend">
        {SERIES.map((series) => (
          <span key={series.key}>
            <i style={{ background: series.color }} aria-hidden="true" />
            {series.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="dashboard-chart-title dashboard-chart-desc">
        <title id="dashboard-chart-title">Work already produced by each specialist</title>
        <desc id="dashboard-chart-desc">
          {points
            .map((point) => `${point.name}: ${point.artifacts} drafts, ${point.actions} actions, ${point.findings} recommendations`)
            .join(". ")}
        </desc>
        <text className="dashboard-chart-axis-label" x={14} y={pad.top + plotHeight / 2} transform={`rotate(-90 14 ${pad.top + plotHeight / 2})`}>
          Work recorded
        </text>
        {ticks.map((tick) => {
          const y = pad.top + plotHeight - (tick / max) * plotHeight;
          return (
            <g key={tick}>
              <line className="dashboard-chart-grid" x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text className="dashboard-chart-tick" x={pad.left - 8} y={y + 4} textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        <line className="dashboard-chart-axis" x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotHeight} />
        <line
          className="dashboard-chart-axis"
          x1={pad.left}
          x2={width - pad.right}
          y1={pad.top + plotHeight}
          y2={pad.top + plotHeight}
        />
        {points.map((point, index) => {
          const groupX = pad.left + index * groupWidth + groupWidth / 2;
          return (
            <g key={point.agentId}>
              {SERIES.map((series, bar) => {
                const value = point[series.key];
                const barHeight = Math.max(value ? 4 : 0, (value / max) * plotHeight);
                const x = groupX - (SERIES.length * barWidth + 6) / 2 + bar * (barWidth + 3);
                const y = pad.top + plotHeight - barHeight;
                return (
                  <rect
                    key={series.key}
                    className="dashboard-chart-bar"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="2"
                    fill={series.color}
                  />
                );
              })}
              <text className="dashboard-chart-x" x={groupX} y={height - 28} textAnchor="middle">
                {point.shortLabel}
              </text>
            </g>
          );
        })}
        <text className="dashboard-chart-axis-label" x={pad.left + plotWidth / 2} y={height - 8} textAnchor="middle">
          Specialists on the active team
        </text>
      </svg>
      <div className="dashboard-chart-points">
        {points.map((point) => (
          <button key={point.agentId} type="button" onClick={() => onSelect(point.agentId)} aria-label={`Open ${point.name} work`}>
            <strong>{point.shortLabel}</strong>
            <span>
              {point.artifacts} drafts · {point.actions} actions · {point.findings} recs
            </span>
          </button>
        ))}
      </div>
    </figure>
  );
}
