// F1 team colours and metadata.
//
// Keys are normalised (lowercase, alphanumerics only) so the same table serves
// Jolpica constructorIds ("red_bull"), Jolpica names ("Red Bull"), and OpenF1
// team names ("Red Bull Racing"). Order matters: more specific aliases come
// first so "Racing Bulls" is not swallowed by a looser match.
const TEAM_COLOR_ALIASES = [
  ['racingbulls', '#6692FF'],
  ['rbf1team', '#6692FF'],
  ['visacashapprb', '#6692FF'],
  ['alphatauri', '#5E8FAA'],
  ['tororosso', '#469BFF'],
  ['redbull', '#3671C6'],
  ['ferrari', '#E8002D'],
  ['mercedes', '#27F4D2'],
  ['mclaren', '#FF8000'],
  ['astonmartin', '#229971'],
  ['alpine', '#FF87BC'],
  ['williams', '#1868DB'],
  ['haas', '#B6BABD'],
  ['audi', '#F50537'],
  ['cadillac', '#C9A227'],
  ['sauber', '#52E252'],
  ['alfaromeo', '#B12039'],
  ['renault', '#FFF500'],
  ['racingpoint', '#F596C8'],
  ['forceindia', '#F596C8'],
];

// Jolpica constructorIds that don't contain the brand name.
const CONSTRUCTOR_ID_ALIASES = {
  rb: 'racingbulls',
};

const normalise = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const FALLBACK_COLOR = '#888888';

/**
 * Resolve a team colour from any team identifier (constructorId, Jolpica name,
 * or OpenF1 team_name).
 */
export function getTeamColor(team) {
  if (!team) return FALLBACK_COLOR;
  const key = CONSTRUCTOR_ID_ALIASES[team] || normalise(team);
  const hit = TEAM_COLOR_ALIASES.find(([alias]) => key.includes(alias));
  return hit ? hit[1] : FALLBACK_COLOR;
}

/**
 * OpenF1 returns team_colour as a bare hex string ("3671C6"). Prefer it when
 * present (it is the official colour for that exact session) and fall back to
 * the name lookup otherwise.
 */
export function getOpenF1DriverColor(driver) {
  if (!driver) return FALLBACK_COLOR;
  if (driver.team_colour && /^[0-9a-f]{6}$/i.test(driver.team_colour)) {
    return `#${driver.team_colour}`;
  }
  return getTeamColor(driver.team_name);
}

/**
 * Teammates share a team colour, which makes two-driver charts unreadable.
 * Return a contrasting colour for the second driver when that happens.
 */
export function distinctColor(color, against, alt = '#A855F7') {
  if (!color || !against) return color;
  return color.toLowerCase() === against.toLowerCase() ? alt : color;
}

/**
 * Text drawn in a team (or any brand) colour. Team colours are tuned for
 * dark broadcast graphics, so several (Mercedes cyan, Haas grey, Cadillac
 * gold) vanish on a light background. This keeps the hue but mixes it toward
 * the theme's text colour by --tone-strength, so it reads in both themes.
 * Use the raw colour for lines, bars and swatches; use tone() only for text.
 */
export function tone(color) {
  return `color-mix(in srgb, ${color} var(--tone-strength), var(--text-primary))`;
}

/**
 * Black or white, whichever reads better on a solid `hex` fill (WCAG
 * relative luminance). For labels inside coloured tiles and bars.
 */
export function textOn(hex) {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || '');
  if (!m) return '#fff';
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast with black = (L + 0.05) / 0.05; with white = 1.05 / (L + 0.05)
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#111' : '#fff';
}

/**
 * A driver who changed teams mid-season has several entries in Jolpica's
 * Constructors array; the last one is the current team.
 */
export function currentConstructor(standing) {
  const list = standing?.Constructors || [];
  return list[list.length - 1];
}

export const TIRE_COMPOUNDS = {
  SOFT: { color: '#FF3333', label: 'Soft' },
  MEDIUM: { color: '#FFD700', label: 'Medium' },
  // Mid grey rather than white so it stays visible in light mode
  HARD: { color: '#A0A0A0', label: 'Hard' },
  INTERMEDIATE: { color: '#43B02A', label: 'Inter' },
  WET: { color: '#0067AD', label: 'Wet' },
};

export const DRY_COMPOUNDS = ['SOFT', 'MEDIUM', 'HARD'];
