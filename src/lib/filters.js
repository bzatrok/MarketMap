/**
 * Build a Meilisearch filter string from UI filter state.
 * @param {Object} params
 * @param {string[]} [params.days] - Selected days (multi-select)
 * @param {string[]} [params.provinces] - Province names (multi-select)
 * @param {string} [params.type] - Market type
 * @returns {string[]} Array of filter strings for Meilisearch
 */
export function buildFilterArray({ days, provinces, type } = {}) {
  const filters = [];

  if (days && days.length > 0) {
    const dayFilters = days.map((d) => `schedule.days = "${d}"`);
    filters.push(`(${dayFilters.join(' OR ')})`);
  }

  if (provinces && provinces.length > 0) {
    const provFilters = provinces.map((p) => `province = "${p}"`);
    filters.push(`(${provFilters.join(' OR ')})`);
  }

  if (type) {
    filters.push(`type = "${type}"`);
  }

  return filters;
}

/**
 * Check if a market is currently open based on its schedule.
 * @param {Object} schedule - Market schedule object
 * @param {Date} [now] - Current date/time (defaults to now)
 * @returns {boolean}
 */
export function isMarketOpenNow(schedule, now = new Date()) {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];

  if (!schedule.days.includes(currentDay)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = schedule.timeStart.split(':').map(Number);
  const [endH, endM] = schedule.timeEnd.split(':').map(Number);

  return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
}
