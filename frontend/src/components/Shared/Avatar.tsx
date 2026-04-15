interface Props {
  name: string;
  color?: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
}

const SIZES = { sm: 22, md: 28, lg: 36 };
const FONT  = { sm: 10, md: 11, lg: 14 };

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
