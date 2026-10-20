import React from 'react';
import { tone } from '../data/constants';

/**
 * Recharts <Legend formatter>: draw each label in its series colour, toned
 * for readability (team colours like Mercedes cyan vanish on light panels).
 */
export const toneLegend = (value, entry) => (
  <span style={{ color: tone(entry.color) }}>{value}</span>
);
