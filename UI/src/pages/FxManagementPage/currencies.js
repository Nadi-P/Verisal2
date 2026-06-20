/**
 * Top-50 foreign currencies the app supports for FX-rate management.
 * Each entry carries:
 *   code      — ISO-4217 currency code (USD, EUR, …)
 *   country   — ISO-3166-1 alpha-2 country code (for the flag emoji)
 *   nameHe    — Hebrew currency name (used in search + card title)
 *   countryHe — Hebrew country name (used in search)
 *   symbol    — short display symbol where one exists
 */
export const CURRENCIES = [
  { code: 'USD', country: 'US', nameHe: 'דולר אמריקאי',     countryHe: 'ארצות הברית',           symbol: '$' },
  { code: 'EUR', country: 'EU', nameHe: 'אירו',              countryHe: 'אירופה',                 symbol: '€' },
  { code: 'JPY', country: 'JP', nameHe: 'ין יפני',            countryHe: 'יפן',                    symbol: '¥' },
  { code: 'GBP', country: 'GB', nameHe: 'פאונד בריטי',        countryHe: 'בריטניה',                symbol: '£' },
  { code: 'AUD', country: 'AU', nameHe: 'דולר אוסטרלי',       countryHe: 'אוסטרליה',               symbol: 'A$' },
  { code: 'CAD', country: 'CA', nameHe: 'דולר קנדי',          countryHe: 'קנדה',                   symbol: 'C$' },
  { code: 'CHF', country: 'CH', nameHe: 'פרנק שוויצרי',       countryHe: 'שוויץ',                  symbol: 'Fr' },
  { code: 'CNY', country: 'CN', nameHe: 'יואן סיני',           countryHe: 'סין',                    symbol: '¥' },
  { code: 'HKD', country: 'HK', nameHe: 'דולר הונג קונגי',     countryHe: 'הונג קונג',              symbol: 'HK$' },
  { code: 'NZD', country: 'NZ', nameHe: 'דולר ניו זילנדי',      countryHe: 'ניו זילנד',              symbol: 'NZ$' },
  { code: 'SEK', country: 'SE', nameHe: 'קרונה שוודית',        countryHe: 'שוודיה',                 symbol: 'kr' },
  { code: 'KRW', country: 'KR', nameHe: 'וון קוריאני',          countryHe: 'דרום קוריאה',            symbol: '₩' },
  { code: 'SGD', country: 'SG', nameHe: 'דולר סינגפורי',        countryHe: 'סינגפור',                symbol: 'S$' },
  { code: 'NOK', country: 'NO', nameHe: 'קרונה נורבגית',        countryHe: 'נורבגיה',                symbol: 'kr' },
  { code: 'MXN', country: 'MX', nameHe: 'פסו מקסיקני',          countryHe: 'מקסיקו',                 symbol: '$' },
  { code: 'INR', country: 'IN', nameHe: 'רופי הודי',             countryHe: 'הודו',                   symbol: '₹' },
  { code: 'RUB', country: 'RU', nameHe: 'רובל רוסי',             countryHe: 'רוסיה',                  symbol: '₽' },
  { code: 'ZAR', country: 'ZA', nameHe: 'ראנד דרום אפריקאי',    countryHe: 'דרום אפריקה',            symbol: 'R' },
  { code: 'TRY', country: 'TR', nameHe: 'לירה טורקית',           countryHe: 'טורקיה',                 symbol: '₺' },
  { code: 'BRL', country: 'BR', nameHe: 'ריאל ברזילאי',          countryHe: 'ברזיל',                  symbol: 'R$' },
  { code: 'TWD', country: 'TW', nameHe: 'דולר טייוואני',          countryHe: 'טייוואן',                symbol: 'NT$' },
  { code: 'DKK', country: 'DK', nameHe: 'קרונה דנית',             countryHe: 'דנמרק',                  symbol: 'kr' },
  { code: 'PLN', country: 'PL', nameHe: 'זלוטי פולני',            countryHe: 'פולין',                  symbol: 'zł' },
  { code: 'THB', country: 'TH', nameHe: 'באט תאילנדי',            countryHe: 'תאילנד',                 symbol: '฿' },
  { code: 'IDR', country: 'ID', nameHe: 'רופיה אינדונזית',         countryHe: 'אינדונזיה',              symbol: 'Rp' },
  { code: 'HUF', country: 'HU', nameHe: 'פורינט הונגרי',          countryHe: 'הונגריה',                symbol: 'Ft' },
  { code: 'CZK', country: 'CZ', nameHe: 'קורונה צ׳כית',           countryHe: 'צ׳כיה',                  symbol: 'Kč' },
  { code: 'CLP', country: 'CL', nameHe: 'פסו צ׳יליאני',           countryHe: 'צ׳ילה',                  symbol: '$' },
  { code: 'PHP', country: 'PH', nameHe: 'פסו פיליפיני',           countryHe: 'פיליפינים',              symbol: '₱' },
  { code: 'AED', country: 'AE', nameHe: 'דירהם איחוד האמירויות',  countryHe: 'איחוד האמירויות הערביות', symbol: 'د.إ' },
  { code: 'COP', country: 'CO', nameHe: 'פסו קולומביאני',         countryHe: 'קולומביה',               symbol: '$' },
  { code: 'SAR', country: 'SA', nameHe: 'ריאל סעודי',             countryHe: 'ערב הסעודית',            symbol: 'ر.س' },
  { code: 'MYR', country: 'MY', nameHe: 'רינגיט מלזי',            countryHe: 'מלזיה',                  symbol: 'RM' },
  { code: 'RON', country: 'RO', nameHe: 'לאו רומני',              countryHe: 'רומניה',                 symbol: 'lei' },
  { code: 'ARS', country: 'AR', nameHe: 'פסו ארגנטינאי',          countryHe: 'ארגנטינה',               symbol: '$' },
  { code: 'EGP', country: 'EG', nameHe: 'לירה מצרית',             countryHe: 'מצרים',                  symbol: '£' },
  { code: 'BGN', country: 'BG', nameHe: 'לב בולגרי',              countryHe: 'בולגריה',                symbol: 'лв' },
  { code: 'PEN', country: 'PE', nameHe: 'סול פרואני',              countryHe: 'פרו',                    symbol: 'S/' },
  { code: 'KZT', country: 'KZ', nameHe: 'טנגה קזחי',               countryHe: 'קזחסטן',                 symbol: '₸' },
  { code: 'VND', country: 'VN', nameHe: 'דונג ויאטנמי',            countryHe: 'ויאטנם',                 symbol: '₫' },
  { code: 'BHD', country: 'BH', nameHe: 'דינר בחריני',             countryHe: 'בחריין',                 symbol: '.د.ب' },
  { code: 'NGN', country: 'NG', nameHe: 'נאירה ניגרי',             countryHe: 'ניגריה',                 symbol: '₦' },
  { code: 'PKR', country: 'PK', nameHe: 'רופי פקיסטני',            countryHe: 'פקיסטן',                 symbol: '₨' },
  { code: 'QAR', country: 'QA', nameHe: 'ריאל קטארי',              countryHe: 'קטאר',                   symbol: 'ر.ق' },
  { code: 'KWD', country: 'KW', nameHe: 'דינר כווייתי',            countryHe: 'כווית',                  symbol: 'د.ك' },
  { code: 'UAH', country: 'UA', nameHe: 'הריווניה אוקראיני',       countryHe: 'אוקראינה',               symbol: '₴' },
  { code: 'ISK', country: 'IS', nameHe: 'קרונה איסלנדית',          countryHe: 'איסלנד',                 symbol: 'kr' },
  { code: 'JOD', country: 'JO', nameHe: 'דינר ירדני',              countryHe: 'ירדן',                   symbol: 'د.ا' },
  { code: 'MAD', country: 'MA', nameHe: 'דירהם מרוקאי',            countryHe: 'מרוקו',                  symbol: 'د.م' },
  { code: 'HRK', country: 'HR', nameHe: 'קונה קרואטית',            countryHe: 'קרואטיה',                symbol: 'kn' },
];

export const CURRENCY_BY_CODE = Object.fromEntries(CURRENCIES.map((c) => [c.code, c]));

/** Convert an ISO-3166-1 alpha-2 country code to a regional-indicator flag emoji. */
export function flagFor(country) {
  if (!country || country.length !== 2) return '🏳️';
  const A = 0x1F1E6;
  const codepoints = [...country.toUpperCase()].map((ch) => A + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codepoints);
}

/** Match a currency against a search term (ISO code OR Hebrew name OR Hebrew country). */
export function matchesQuery(currency, q) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    currency.code.toLowerCase().includes(s)
    || (currency.nameHe || '').includes(q.trim())
    || (currency.countryHe || '').includes(q.trim())
  );
}

export const MONTH_NAMES_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

/** Format a rate for display per the "stronger side becomes 1" convention. */
export function formatRateDisplay(rate, currency) {
  if (typeof rate !== 'number' || !isFinite(rate) || rate <= 0) return null;
  const code   = currency?.code   || '';
  const symbol = currency?.symbol || code;
  if (rate >= 1) {
    // Foreign currency stronger (or equal). 1 [FX] = rate ₪.
    return `1 ${symbol} = ${formatNumber(rate)} ₪`;
  }
  // NIS stronger. 1 ₪ = (1/rate) [FX].
  return `1 ₪ = ${formatNumber(1 / rate)} ${symbol}`;
}

function formatNumber(n) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}
