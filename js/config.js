export const CONFIG = {
  DATA_FOLDER: './data/',
  DEFAULT_WEEKS: 8,
  CHART_COLORS: ['#0A3047', '#286382', '#87BFD9', '#F26417'],

  EXCLUDED_ACCOUNTS: new Set(['46', '666', '4393']),

  SYSTEM_USERS: new Set([
    'Service Database Admin',
    'ServiceTrade Support',
    'ServiceTrade Support User (Do Not Delete)',
    'automation user',
  ]),

  // higherIsBetter drives delta arrow color in ui.js
  KPIS: [
    { key: 'activeUsers',         label: 'ACTIVE USERS',         higherIsBetter: true,  format: 'int' },
    { key: 'activeTenants',       label: 'ACTIVE TENANTS',       higherIsBetter: true,  format: 'int' },
    { key: 'conversionRate',      label: 'QUOTE CONVERSION',     higherIsBetter: true,  format: 'pct' },
    { key: 'stellaAdoption',      label: 'STELLA ADOPTION',      higherIsBetter: true,  format: 'pct' },
    { key: 'totalIdleQuotes',     label: 'IDLE QUOTES',          higherIsBetter: false, format: 'int' },
    { key: 'avgIdleAge',          label: 'AVG IDLE AGE',         higherIsBetter: false, format: 'days' },
    { key: 'avgTimeToQuote',      label: 'AVG TIME TO QUOTE',    higherIsBetter: false, format: 'days' },
    { key: 'totalStellaQuotes',   label: 'TOTAL STELLA QUOTES',  higherIsBetter: true,  format: 'int' },
  ],

  ACCOUNTS: {
    '1063':  { company: 'Total Fire Protection',           cohort: 'May',     status: 'active' },
    '1449':  { company: 'VSC Fire & Security Inc',         cohort: 'Pre-May', status: 'active' },
    '2584':  { company: 'Century Fire Protection LLC',     cohort: 'Pre-May', status: 'active' },
    '3345':  { company: 'Emerald Fire LLC',                cohort: 'Pre-May', status: 'active' },
    '7133':  { company: 'Desert Fire',                     cohort: 'Pre-May', status: 'inactive' },
    '7710':  { company: 'Century Fire',                    cohort: 'Pre-May', status: 'active' },
    '8416':  { company: 'Jayhawk Fire Sprinkler Co.',      cohort: 'Pre-May', status: 'active' },
    '9464':  { company: 'Yadon Mechanical',                cohort: 'May',     status: 'active' },
    '9639':  { company: 'California Boiler Inc.',          cohort: 'Pre-May', status: 'active' },
    '9755':  { company: 'Performance Fire',                cohort: 'May',     status: 'active' },
    '9773':  { company: 'Innovative Systems',              cohort: 'May',     status: 'active' },
    '9790':  { company: 'The Fireman Equipment Company',   cohort: 'May',     status: 'active' },
    '9797':  { company: 'Soul Mechanical',                 cohort: 'May',     status: 'active' },
    '9900':  { company: 'Gray Mechanical Contractors LLC', cohort: 'Pre-May', status: 'active' },
    '9945':  { company: 'Thorpe Design, Inc.',             cohort: 'May',     status: 'active' },
    '10296': { company: 'Continental Mechanical',          cohort: 'May',     status: 'active' },
    '10435': { company: 'National Fire and Safety',        cohort: 'May',     status: 'active' },
    '11098': { company: 'Envelop Group',                   cohort: 'Pre-May', status: 'active' },
    '11146': { company: 'Stark Tech',                      cohort: 'Pre-May', status: 'active' },
    '11150': { company: 'MSI Mechanical Systems Inc.',     cohort: 'Pre-May', status: 'active' },
    '11261': { company: 'Serenergy Corp',                  cohort: 'Pre-May', status: 'active' },
    '11631': { company: 'DVL Group Inc.',                  cohort: 'Pre-May', status: 'active' },
  },
};
