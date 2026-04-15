/**
 * Nationality → Flag Emoji utility
 * Maps F1 nationality strings (as used in Jolpica API & championship data)
 * to their corresponding Unicode flag emojis via ISO 3166-1 alpha-2 codes.
 */

const NATIONALITY_TO_CODE = {
  // Current grid nationalities
  British:        'GB', Dutch:          'NL', Monegasque:     'MC',
  Spanish:        'ES', German:         'DE', Australian:     'AU',
  Mexican:        'MX', Canadian:       'CA', French:         'FR',
  Finnish:        'FI', Japanese:       'JP', Chinese:        'CN',
  Thai:           'TH', Danish:         'DK', American:       'US',
  Italian:        'IT', Swiss:          'CH', Austrian:       'AT',

  // Historic nationalities (championship winners & notable drivers)
  Brazilian:      'BR', Argentine:      'AR', Argentinian:    'AR',
  'South African':'ZA', 'New Zealander':'NZ', Colombian:      'CO',
  Venezuelan:     'VE', Indian:         'IN', Polish:         'PL',
  Belgian:        'BE', Swedish:        'SE', Irish:          'IE',
  Portuguese:     'PT', Russian:        'RU', Indonesian:     'ID',

  // Country names (some APIs return these instead of adjectives)
  'United Kingdom':'GB', UK:            'GB', England:        'GB',
  Netherlands:    'NL', Monaco:         'MC', Spain:          'ES',
  Germany:        'DE', Australia:      'AU', Mexico:         'MX',
  Canada:         'CA', France:         'FR', Finland:        'FI',
  Japan:          'JP', China:          'CN', Thailand:       'TH',
  Denmark:        'DK', USA:            'US', 'United States':'US',
  Italy:          'IT', Switzerland:    'CH', Austria:        'AT',
  Brazil:         'BR', Argentina:      'AR', 'South Africa': 'ZA',
  'New Zealand':  'NZ', Colombia:       'CO', Venezuela:      'VE',
  India:          'IN', Poland:         'PL', Belgium:        'BE',
  Sweden:         'SE', Ireland:        'IE', Portugal:       'PT',
  Russia:         'RU', Indonesia:      'ID',
};

/**
 * Convert an ISO 3166-1 alpha-2 country code to a flag emoji.
 * Works by mapping each letter to its Regional Indicator Symbol.
 */
function codeToEmoji(code) {
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}

/**
 * Get a flag emoji for a nationality or country name.
 * Returns the flag emoji string, or '' if not found.
 *
 * @param {string} nationality - e.g. "British", "Dutch", "Brazil"
 * @returns {string} Flag emoji or empty string
 */
export function getFlag(nationality) {
  if (!nationality) return '';
  const code = NATIONALITY_TO_CODE[nationality] || NATIONALITY_TO_CODE[nationality.trim()];
  return code ? codeToEmoji(code) : '';
}

/**
 * Get both flag and country code for a nationality.
 * Useful when you want to display flag + code badge.
 *
 * @param {string} nationality
 * @returns {{ flag: string, code: string }}
 */
export function getFlagData(nationality) {
  if (!nationality) return { flag: '', code: '' };
  const code = NATIONALITY_TO_CODE[nationality] || NATIONALITY_TO_CODE[nationality.trim()] || '';
  return { flag: code ? codeToEmoji(code) : '', code };
}
