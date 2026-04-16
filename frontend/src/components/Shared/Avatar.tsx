interface Props {
  name: string;
  color?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

const SIZES = { sm: 22, md: 28, lg: 36 };
const FONT  = { sm: 10, md: 11, lg: 14 };

export function AvatarGroup({ users, max = 3, size: _size }: { users: Array<{ id: string; name: string; color?: string; avatarUrl?: string }>; max?: number; size?: string }) {
  const visible = users.slice(0, max);
  const extra = users.length - max;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {visible.map((u, i) => (
        <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: visible.length - i }}>
          <Avatar name={u.name} color={u.color} avatarUrl={u.avatarUrl} size="sm" />
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -6, width: 22, height: 22, borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text2)' }}>
          +{extra}
        </div>
      )}
    </div>
  );
}

export function Avatar({ name, color = '#6366f1', avatarUrl, size = 'md', title }: Props) {
  const px = SIZES[size];
  const fs = FONT[size];
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div style={{ width: px, height: px, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: fs, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }} title={title ?? name}>
      {avatarUrl ? <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  );
}
