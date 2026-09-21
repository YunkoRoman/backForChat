/**
 * Generate a deterministic color based on a string (user ID or conversation ID).
 * This ensures the same user always gets the same color.
 */
function getColorFromId(id: string): string {
  const colors = [
    '#4C6E91', // Blue
    '#A65A5A', // Mauve/Rose
    '#5B7B7A', // Teal
    '#6B5B95', // Purple
    '#5C8A5C', // Green
    '#B08948', // Brown
    '#8B5A8E', // Purple-ish
    '#6B8E23', // Olive
  ];

  // Use hash of the ID to select a color consistently
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

export interface AvatarProps {
  /** The text to display (initials, typically 1-3 characters) */
  initials: string;
  /** The ID to base the color on (for deterministic colors) */
  id: string;
  /** Optional size in pixels (default 44) */
  size?: number;
  /** Optional presence dot - true for online, false or undefined for offline */
  presence?: boolean;
}

/**
 * A circular avatar with initials and optional presence indicator.
 */
export function Avatar({ initials, id, size = 44, presence }: AvatarProps) {
  const bgColor = getColorFromId(id);
  const dotsSize = size === 44 ? 11 : size === 30 ? 8 : size === 40 ? 10 : size / 4;
  const borderSize = dotsSize / 2 + 1;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 700,
          fontSize: Math.max(size * 0.3, 11),
        }}
      >
        {initials.toUpperCase()}
      </div>
      {presence && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: dotsSize,
            height: dotsSize,
            borderRadius: '50%',
            background: '#3F9142',
            border: `${borderSize}px solid white`,
          }}
        />
      )}
    </div>
  );
}
