/**
 * U.S. states, D.C. and inhabited territories with their capitals and current
 * governors. Capitals never change; governors were last verified on the date
 * below (governors elected in November 2026 take office in January 2027).
 * Senators and representatives are loaded live — see services/congressLookup.ts.
 */
export const GOVERNORS_VERIFIED_ON = 'November 2026';

/**
 * Governors elected in November 2026 are sworn in during January 2027. From this
 * date the app asks users to confirm their governor until the list is re-verified
 * (update GOVERNORS_VERIFIED_ON and this date together).
 */
export const GOVERNORS_RECHECK_FROM = '2027-01-01';

export function governorsMayHaveChanged(now = new Date()): boolean {
  return now.getTime() >= new Date(`${GOVERNORS_RECHECK_FROM}T00:00:00`).getTime();
}

export type JurisdictionKind = 'state' | 'district' | 'territory';

export interface Jurisdiction {
  readonly code: string;
  readonly name: string;
  readonly kind: JurisdictionKind;
  /** Exact answer for Q62 (capital). */
  readonly capital: string;
  /** Exact answer for Q61 (governor). */
  readonly governor: string;
}

const s = (code: string, name: string, capital: string, governor: string): Jurisdiction => ({
  code,
  name,
  kind: 'state',
  capital,
  governor,
});

export const JURISDICTIONS: readonly Jurisdiction[] = [
  s('AL', 'Alabama', 'Montgomery', 'Kay Ivey'),
  s('AK', 'Alaska', 'Juneau', 'Mike Dunleavy'),
  s('AZ', 'Arizona', 'Phoenix', 'Katie Hobbs'),
  s('AR', 'Arkansas', 'Little Rock', 'Sarah Huckabee Sanders'),
  s('CA', 'California', 'Sacramento', 'Gavin Newsom'),
  s('CO', 'Colorado', 'Denver', 'Jared Polis'),
  s('CT', 'Connecticut', 'Hartford', 'Ned Lamont'),
  s('DE', 'Delaware', 'Dover', 'Matt Meyer'),
  s('FL', 'Florida', 'Tallahassee', 'Ron DeSantis'),
  s('GA', 'Georgia', 'Atlanta', 'Brian Kemp'),
  s('HI', 'Hawaii', 'Honolulu', 'Josh Green'),
  s('ID', 'Idaho', 'Boise', 'Brad Little'),
  s('IL', 'Illinois', 'Springfield', 'JB Pritzker'),
  s('IN', 'Indiana', 'Indianapolis', 'Mike Braun'),
  s('IA', 'Iowa', 'Des Moines', 'Kim Reynolds'),
  s('KS', 'Kansas', 'Topeka', 'Laura Kelly'),
  s('KY', 'Kentucky', 'Frankfort', 'Andy Beshear'),
  s('LA', 'Louisiana', 'Baton Rouge', 'Jeff Landry'),
  s('ME', 'Maine', 'Augusta', 'Janet Mills'),
  s('MD', 'Maryland', 'Annapolis', 'Wes Moore'),
  s('MA', 'Massachusetts', 'Boston', 'Maura Healey'),
  s('MI', 'Michigan', 'Lansing', 'Gretchen Whitmer'),
  s('MN', 'Minnesota', 'Saint Paul', 'Tim Walz'),
  s('MS', 'Mississippi', 'Jackson', 'Tate Reeves'),
  s('MO', 'Missouri', 'Jefferson City', 'Mike Kehoe'),
  s('MT', 'Montana', 'Helena', 'Greg Gianforte'),
  s('NE', 'Nebraska', 'Lincoln', 'Jim Pillen'),
  s('NV', 'Nevada', 'Carson City', 'Joe Lombardo'),
  s('NH', 'New Hampshire', 'Concord', 'Kelly Ayotte'),
  s('NJ', 'New Jersey', 'Trenton', 'Mikie Sherrill'),
  s('NM', 'New Mexico', 'Santa Fe', 'Michelle Lujan Grisham'),
  s('NY', 'New York', 'Albany', 'Kathy Hochul'),
  s('NC', 'North Carolina', 'Raleigh', 'Josh Stein'),
  s('ND', 'North Dakota', 'Bismarck', 'Kelly Armstrong'),
  s('OH', 'Ohio', 'Columbus', 'Mike DeWine'),
  s('OK', 'Oklahoma', 'Oklahoma City', 'Kevin Stitt'),
  s('OR', 'Oregon', 'Salem', 'Tina Kotek'),
  s('PA', 'Pennsylvania', 'Harrisburg', 'Josh Shapiro'),
  s('RI', 'Rhode Island', 'Providence', 'Dan McKee'),
  s('SC', 'South Carolina', 'Columbia', 'Henry McMaster'),
  s('SD', 'South Dakota', 'Pierre', 'Larry Rhoden'),
  s('TN', 'Tennessee', 'Nashville', 'Bill Lee'),
  s('TX', 'Texas', 'Austin', 'Greg Abbott'),
  s('UT', 'Utah', 'Salt Lake City', 'Spencer Cox'),
  s('VT', 'Vermont', 'Montpelier', 'Phil Scott'),
  s('VA', 'Virginia', 'Richmond', 'Abigail Spanberger'),
  s('WA', 'Washington', 'Olympia', 'Bob Ferguson'),
  s('WV', 'West Virginia', 'Charleston', 'Patrick Morrisey'),
  s('WI', 'Wisconsin', 'Madison', 'Tony Evers'),
  s('WY', 'Wyoming', 'Cheyenne', 'Mark Gordon'),
  {
    code: 'DC',
    name: 'District of Columbia',
    kind: 'district',
    capital: 'D.C. is not a state and does not have a capital',
    governor: 'D.C. does not have a governor',
  },
  { code: 'PR', name: 'Puerto Rico', kind: 'territory', capital: 'San Juan', governor: 'Jenniffer González-Colón' },
  { code: 'GU', name: 'Guam', kind: 'territory', capital: 'Hagåtña', governor: 'Lou Leon Guerrero' },
  { code: 'VI', name: 'U.S. Virgin Islands', kind: 'territory', capital: 'Charlotte Amalie', governor: 'Albert Bryan Jr.' },
  { code: 'MP', name: 'Northern Mariana Islands', kind: 'territory', capital: 'Saipan', governor: 'David M. Apatang' },
  { code: 'AS', name: 'American Samoa', kind: 'territory', capital: 'Pago Pago', governor: 'Pula Nikolao Pula' },
];

export function findJurisdiction(code: string): Jurisdiction | undefined {
  return JURISDICTIONS.find((j) => j.code === code);
}

/** Q23 answer for places without U.S. senators. */
export function noSenatorsAnswer(j: Jurisdiction): string {
  return j.kind === 'district'
    ? 'D.C. has no U.S. senators'
    : `${j.name} has no U.S. senators`;
}
