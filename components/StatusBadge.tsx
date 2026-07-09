import clsx from 'clsx';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-navy-100 text-navy-800',
  checked_in: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-200 text-gray-600',
  no_show: 'bg-crimson-100 text-crimson-800',
  paid: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-amber-100 text-amber-800',
  unpaid: 'bg-crimson-100 text-crimson-800'
};

export default function StatusBadge({ value }: { value: string }) {
  const label = value.replace('_', ' ');
  return (
    <span className={clsx('kmc-badge', STATUS_STYLES[value] || 'bg-gray-100 text-gray-700')}>{label}</span>
  );
}
