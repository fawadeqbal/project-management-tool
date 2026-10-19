import { type ReactNode } from 'react';
import { cx } from '../internal/cx';
import { Card, type CardProps } from './Card';
import { Icon, type IconName } from './Icon';

export type KpiTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface KpiTileProps extends Omit<CardProps, 'children'> {
  label: ReactNode;
  value: ReactNode;
  /** Change indicator, e.g. "+8%". */
  delta?: ReactNode;
  deltaTone?: KpiTone;
  /** Supporting line, e.g. "vs. previous 6 weeks". */
  sub?: ReactNode;
  /** Colors the value (Workload "Over capacity" uses warning). */
  valueTone?: KpiTone;
  icon?: IconName;
}

/** Metric tile used on Dashboard, Workload and Billing. */
export function KpiTile({ label, value, delta, deltaTone = 'neutral', sub, valueTone = 'neutral', icon, className, ...rest }: KpiTileProps) {
  return (
    <Card {...rest} className={cx('ht-kpi', className)}>
      <span className="ht-kpi-label">
        {icon ? <Icon name={icon} /> : null}
        {label}
      </span>
      <span className={cx('ht-kpi-value', valueTone !== 'neutral' && `ht-kpi-value-${valueTone}`)}>{value}</span>
      {delta || sub ? (
        <span className="ht-kpi-foot">
          {delta ? <span className={cx('ht-kpi-delta', deltaTone !== 'neutral' && `ht-kpi-delta-${deltaTone}`)}>{delta}</span> : null}
          {sub ? <span>{sub}</span> : null}
        </span>
      ) : null}
    </Card>
  );
}
