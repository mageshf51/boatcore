'use client';
import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Maximize2, Minimize2, ChartNoAxesCombined, ChevronDown } from 'lucide-react';
import { Decimal } from 'decimal.js';
import { inr } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function RevenueChart({ summaries }: { summaries: any[] }) {
  const t = useT(),
    [collapsed, setCollapsed] = useState(false),
    [expanded, setExpanded] = useState(false),
    [period, setPeriod] = useState('ALL'),
    [hover, setHover] = useState<any>(null);
  const grouped: Record<string, Decimal> = {};
  summaries.forEach(
    (s) => (grouped[s.departure] = (grouped[s.departure] || new Decimal(0)).plus(s.revenue)),
  );
  const all = Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value: value.toNumber() }));
  const latest = all.at(-1);
  const cutoff = latest ? new Date(latest.date) : new Date();
  if (period !== 'ALL') cutoff.setMonth(cutoff.getMonth() - Number(period));
  const points = period === 'ALL' ? all : all.filter((p) => new Date(p.date) >= cutoff);
  const visible = hover || latest;
  return (
    <section className={`revenue-chart ${expanded ? 'expanded-chart' : ''}`}>
      {collapsed ? (
        <button className="chart-open" onClick={() => setCollapsed(false)}>
          <ChartNoAxesCombined size={21} />
          {t('Open revenue chart')}
        </button>
      ) : (
        <>
          <div className="chart-header">
            <div>
              <span>{t('Business performance')}</span>
              <div className="chart-total">
                {inr(visible?.value || 0)}
                <span className="chart-currency">INR</span>
              </div>
              <small>
                {hover ? hover.date : t('Latest trip revenue')}
                {!hover && latest ? ` · ${latest.date}` : ''}
              </small>
            </div>
            <div className="button-row">
              <button
                className="icon-button"
                aria-label={t('Expand chart')}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
              <button
                className="icon-button"
                aria-label={t('Collapse chart')}
                onClick={() => setCollapsed(true)}
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
          <div className="chart-periods">
            {[
              ['1', '1M'],
              ['3', '3M'],
              ['6', '6M'],
              ['12', '1Y'],
              ['ALL', 'ALL'],
            ].map(([v, label]) => (
              <button
                key={v}
                className={period === v ? 'active' : ''}
                onClick={() => {
                  setPeriod(v);
                  setHover(null);
                }}
              >
                {label}
              </button>
            ))}
            <span>{t('Trip Revenue')}</span>
          </div>
          <div className="chart-canvas">
            {points.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={points}
                  margin={{ top: 15, right: 10, left: 0, bottom: 5 }}
                  onMouseMove={(state: any) => {
                    if (state.activeIndex !== undefined && points[Number(state.activeIndex)])
                      setHover(points[Number(state.activeIndex)]);
                  }}
                  onMouseLeave={() => setHover(null)}
                  onTouchEnd={() => setHover(null)}
                >
                  <defs>
                    <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#81c995" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#81c995" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#3c4043" strokeDasharray="3 5" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
                    }
                    stroke="#9aa0a6"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={35}
                    fontSize={11}
                  />
                  <YAxis
                    orientation="right"
                    tickFormatter={(v) => `${v / 1000}k`}
                    stroke="#9aa0a6"
                    axisLine={false}
                    tickLine={false}
                    fontSize={11}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#292c2b',
                      border: '1px solid #424743',
                      borderRadius: 10,
                      color: '#fff',
                    }}
                    formatter={(v: any) => [inr(v), t('Revenue')]}
                    cursor={{ stroke: '#9aa0a6', strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="linear"
                    dataKey="value"
                    stroke="#81c995"
                    strokeWidth={2}
                    fill="url(#revenue-fill)"
                    dot={points.length === 1 ? { r: 4 } : false}
                    activeDot={{ r: 5, stroke: '#202124', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">{t('No records yet')}</div>
            )}
          </div>
          <div className="chart-bottom">
            <span className="mint-dot" />
            {t('Trip Revenue')}
            <span>{t('Departure')}</span>
          </div>
        </>
      )}
    </section>
  );
}
