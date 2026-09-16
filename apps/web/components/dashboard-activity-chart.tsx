import type { TeamActivityPoint } from "@david/domain/delivery";

export function DashboardActivityChart({
  points,
  onSelect,
}: {
  points: TeamActivityPoint[];
  onSelect: (agentId: string) => void;
}) {
  const width = 720;
  const height = 280;
  const pad = { top: 18, right: 16, bottom: 58, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.map((point) => point.total));
  const ticks = [0, Math.ceil(max / 2), max];
  const groupWidth = points.length ? plotWidth / points.length : plotWidth;
  const barWidth = Math.min(36, Math.max(14, groupWidth - 24));

  return (
    <figure className="dashboard-chart">
      <div className="dashboard-chart-legend">
        <span>
          <i style={{ background: "#8fa67a" }} aria-hidden="true" />
          Volume
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="dashboard-chart-title dashboard-chart-desc">
        <title id="dashboard-chart-title">Volume by specialist</title>
        <desc id="dashboard-chart-desc">
          {points.map((point) => `${point.name}: ${point.total}`).join(". ")}
        </desc>
        <text className="dashboard-chart-axis-label" x={14} y={pad.top + plotHeight / 2} transform={`rotate(-90 14 ${pad.top + plotHeight / 2})`}>
          Volume
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
          const barHeight = Math.max(point.total ? 4 : 0, (point.total / max) * plotHeight);
          return (
            <g key={point.agentId}>
              <rect
                className="dashboard-chart-bar"
                x={groupX - barWidth / 2}
                y={pad.top + plotHeight - barHeight}
                width={barWidth}
                height={barHeight}
                rx="3"
                fill="#8fa67a"
              />
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
          <button key={point.agentId} type="button" onClick={() => onSelect(point.agentId)} aria-label={`Volume for ${point.name}`}>
            <strong>{point.shortLabel}</strong>
            <span>{point.total} volume</span>
          </button>
        ))}
      </div>
    </figure>
  );
}
