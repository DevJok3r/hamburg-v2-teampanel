import { UserRole } from '@/types';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/permissions';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'xs' | 'sm' | 'md';
}

export default function RoleBadge({ role, size = 'sm' }: RoleBadgeProps) {
  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5',
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
  };

  return (
    <span className={`inline-flex items-center rounded-md border font-medium
                      ${ROLE_COLORS[role]} ${sizeClasses[size]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}