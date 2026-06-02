export const USER_COLORS = ['#f97316', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#6366f1', '#ef4444', '#14b8a6'];

export function getUserColor(user: any) {
  return user?.color || USER_COLORS[Math.abs(Number(user?.id || 0)) % USER_COLORS.length];
}

export const USER_GRADIENTS = [
  'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', // Orange/Amber (Brand Default)
  'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', // Pink/Rose
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // Purple/Violet
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Blue/Royal
  'linear-gradient(135deg, #10b981 0%, #047857 100%)', // Green/Emerald
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Yellow/Amber
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cyan/Teal
  'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', // Indigo
  'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', // Red/Crimson
  'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)'  // Teal
];

function adjustColorBrightness(hex: string, percent: number) {
  let R = parseInt(hex.substring(1, 3), 16);
  let G = parseInt(hex.substring(3, 5), 16);
  let B = parseInt(hex.substring(5, 7), 16);

  R = Math.max(0, Math.min(255, R + (R * percent) / 100));
  G = Math.max(0, Math.min(255, G + (G * percent) / 100));
  B = Math.max(0, Math.min(255, B + (B * percent) / 100));

  const rHex = Math.round(R).toString(16).padStart(2, '0');
  const gHex = Math.round(G).toString(16).padStart(2, '0');
  const bHex = Math.round(B).toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

export function getUserGradient(user: any) {
  const baseColor = user?.color;
  if (baseColor && baseColor.startsWith('#')) {
    try {
      return `linear-gradient(135deg, ${baseColor} 0%, ${adjustColorBrightness(baseColor, -20)} 100%)`;
    } catch {
      return USER_GRADIENTS[0];
    }
  }
  return USER_GRADIENTS[Math.abs(Number(user?.id || 0)) % USER_GRADIENTS.length];
}

export function initials(name?: string) {
  return (name || 'U').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
}

export function Avatar({ user, size = 40 }: { user: any; size?: number }) {
  const gradient = getUserGradient(user);
  
  if (user?.avatar) {
    return (
      <img 
        src={user.avatar} 
        alt={user.name} 
        className="rounded-full object-cover shrink-0 ring-2 ring-white/80 dark:ring-orange-500/20 shadow-sm transition-transform duration-300 hover:scale-105" 
        style={{ width: size, height: size }} 
      />
    );
  }

  return (
    <div 
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ring-2 ring-white/80 dark:ring-orange-500/20 transition-all duration-300 hover:scale-105" 
      style={{ 
        width: size, 
        height: size, 
        background: gradient 
      }}
    >
      <span style={{ fontSize: Math.max(10, Math.floor(size / 2.3)), letterSpacing: '-0.025em' }}>{initials(user?.name)}</span>
    </div>
  );
}
