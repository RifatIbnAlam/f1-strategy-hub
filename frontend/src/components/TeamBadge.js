import React from 'react';
import { getTeamColor } from '../data/constants';

/**
 * TeamBadge — a compact, team-coloured pill that replaces plain team name text.
 *
 * Props:
 *   team      – team / constructor name string (required)
 *   size      – 'sm' | 'md' (default 'sm')
 *   showDot   – if true, prepend a coloured circle (default true)
 *   style     – optional style overrides
 */
export default function TeamBadge({ team, size = 'sm', showDot = true, style }) {
  if (!team) return null;

  const color = getTeamColor(team);
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 4 : 6,
        padding: isSm ? '1px 7px 1px 5px' : '2px 10px 2px 7px',
        borderRadius: 6,
        background: `${color}14`,
        border: `1px solid ${color}30`,
        fontSize: isSm ? 10 : 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        letterSpacing: '0.2px',
        whiteSpace: 'nowrap',
        lineHeight: isSm ? '18px' : '20px',
        ...style,
      }}
    >
      {showDot && (
        <span
          style={{
            width: isSm ? 6 : 8,
            height: isSm ? 6 : 8,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {team}
    </span>
  );
}
