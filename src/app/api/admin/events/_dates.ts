import { badRequest } from '@/lib/api';

type Dates = { starts_on: string; ends_on: string; registration_opens_on: string; registration_closes_on: string };

/** Dates must make sense together: the event ends after it starts, registration closes before it ends. */
export function checkEventDates(e: Dates): void {
  const errors: Record<string, string> = {};
  if (e.ends_on < e.starts_on) errors.ends_on = 'The end date must be on or after the start date.';
  if (e.registration_closes_on < e.registration_opens_on) errors.registration_closes_on = 'Registration must close after it opens.';
  if (e.registration_closes_on > e.ends_on) errors.registration_closes_on = 'Registration must close before the event ends.';
  if (Object.keys(errors).length) throw badRequest('Some fields need attention.', errors);
}
