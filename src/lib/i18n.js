/**
 * Dutch (primary) and English translations for SEO and UI.
 */

export const DAY_LABELS_NL = {
  monday: 'Maandag',
  tuesday: 'Dinsdag',
  wednesday: 'Woensdag',
  thursday: 'Donderdag',
  friday: 'Vrijdag',
  saturday: 'Zaterdag',
  sunday: 'Zondag',
};

export const DAY_LABELS_SHORT_NL = {
  monday: 'Ma',
  tuesday: 'Di',
  wednesday: 'Wo',
  thursday: 'Do',
  friday: 'Vr',
  saturday: 'Za',
  sunday: 'Zo',
};

export const TYPE_LABELS_NL = {
  weekly_market: 'Weekmarkt',
  groentemarkt: 'Groentemarkt',
  bloemenmarkt: 'Bloemenmarkt',
  boekenmarkt: 'Boekenmarkt',
  book_market: 'Boekenmarkt',
  fabric_market: 'Stoffenmarkt',
  farmers_market: 'Boerenmarkt',
  flower_market: 'Bloemenmarkt',
  minimarkt: 'Minimarkt',
  organic_market: 'Biologische markt',
  regional_market: 'Streekmarkt',
  warenmarkt: 'Warenmarkt',
  'warenmarkt+stoffenmarkt': 'Warenmarkt & Stoffenmarkt',
  antique_market: 'Antiekmarkt',
};

export function formatTypeNL(type) {
  return TYPE_LABELS_NL[type] || type.replace(/_/g, ' ');
}

export function formatScheduleNL(schedule) {
  return schedule
    .map((s) => `${DAY_LABELS_NL[s.day]} ${s.timeStart}–${s.timeEnd}`)
    .join(', ');
}
