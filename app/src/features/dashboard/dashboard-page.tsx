'use client';
import Link from 'next/link';
import { Decimal } from 'decimal.js';
import {
  ArrowUpRight,
  ArrowRight,
  Ship,
  Receipt,
  Wallet,
  Calculator,
  TrendingUp,
  Coins,
  CalendarDays,
} from 'lucide-react';
import { useWorkspace } from '../../components/providers/workspace-provider';
import { PageHeader } from '../../components/ui/page-header';
import { RevenueChart } from './revenue-chart';
import { inr } from '../../lib/api-client';
import { useT } from '../../lib/translations';
export function DashboardPage() {
  const { data } = useWorkspace(),
    t = useT();
  if (!data) return null;
  const total = (key: string) => data.summaries.reduce((n, s) => n.plus(s[key]), new Decimal(0));
  const profit = new Decimal(data.ownerTotals.profit),
    active = data.entities.trips.filter((v) => !v.completed).length;
  return (
    <>
      <PageHeader
        eyebrow="AT A GLANCE"
        title="Dashboard"
        description="Manage your fishing business with clarity."
        action={
          data.user.role !== 'guest' ? (
            <Link className="button" href="/trips/new">
              <Ship size={16} />
              {t('Add New Trip')}
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            <span className="review-pill">{t('Read-only employer review')}</span>
          )
        }
      />
      <div className="metric-grid">
        {[
          ['Revenue', total('revenue'), Coins],
          ['Profit / Loss', profit, TrendingUp],
          ['Expenses', total('expenses'), Wallet],
        ].map(([label, value, Icon]: any, i) => (
          <section className="metric-card" key={label}>
            <div className="metric-top">
              <span>{t(label)}</span>
              <Icon size={17} />
            </div>
            <strong
              className={
                i === 1 ? (profit.gt(0) ? 'positive' : profit.lt(0) ? 'negative' : '') : ''
              }
            >
              {i === 1 && profit.gt(0) ? '+' : ''}
              {inr(value.toString())}
            </strong>
            <div className="metric-foot">
              <span className={`metric-marker marker-${i}`} />
              {t('All trips')}
              <ArrowUpRight size={14} />
            </div>
          </section>
        ))}
      </div>
      {Number(data.ownerTotals.landWages) > 0 && (
        <p className="notice">
          {t('Land wages')}: {inr(data.ownerTotals.landWages)} · {t('Included in owner profit')}
        </p>
      )}
      <RevenueChart summaries={data.summaries} />
      <div className="section-heading">
        <h2>{t('Connected operations')}</h2>
        <span>
          {active} {t('Active')} · {data.entities.trips.length} {t('Trips')}
        </span>
      </div>
      <div className="module-grid">
        {[
          ['Trips', '/trips', Ship, '01'],
          ['Quick Sales', '/sales', Receipt, '02'],
          ['Expenses', '/expenses', Wallet, '03'],
          ['Trip Settlement', '/settlement', Calculator, '04'],
        ].map(([label, href, Icon, n]: any) => (
          <Link key={href} href={href} className="module-card">
            <div>
              <span className="module-icon">
                <Icon size={22} />
              </span>
              <span className="module-number">{n}</span>
            </div>
            <strong>{t(label)}</strong>
            <div>
              <small>BoatCore workspace</small>
              <ArrowUpRight size={20} />
            </div>
          </Link>
        ))}
      </div>
      <div className="section-heading">
        <h2>{t('Latest saved records')}</h2>
        <Link href="/trip-details">
          {t('All trips')} <ArrowRight size={14} />
        </Link>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              {['Trip', 'Departure', 'Status', 'Trip Revenue', 'Actions'].map((x) => (
                <th key={x}>{t(x)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data.entities.trips]
              .reverse()
              .slice(0, 4)
              .map((trip) => (
                <tr key={trip.id}>
                  <td className="strong">{trip.name}</td>
                  <td>{trip.departure}</td>
                  <td>
                    <span className={`badge ${trip.completed ? '' : 'active'}`}>
                      {t(trip.completed ? 'Completed' : 'Active')}
                    </span>
                  </td>
                  <td className="number">
                    {inr(data.summaries.find((s) => s.tripId === trip.id)?.revenue)}
                  </td>
                  <td>
                    <Link className="text-button" href={`/trip-details/${trip.id}`}>
                      {t('View')}
                      <ArrowUpRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            {!data.entities.trips.length && (
              <tr>
                <td colSpan={5} className="empty">
                  {t('No records yet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
