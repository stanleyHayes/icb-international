import { countryDistanceKm } from './geo-distance.js';
import { MS_PER_HOUR, numberParam, severity } from './rule.params.js';
import { fired, notFired, type RuleContext, type RuleEvaluator } from './rule.types.js';

/**
 * Geo velocity: two countries too far apart for the time between them.
 *
 * The customer who lands in Dubai and pays for a taxi is normal. The account that authorises in
 * Accra and then in São Paulo eleven minutes later is one credential shared between two people.
 * The rule measures implied travel speed rather than "foreign country", because a foreign country
 * is not suspicious and a Mach 4 human being is.
 */

interface Journey {
  readonly from: string;
  readonly to: string;
  readonly hours: number;
  readonly distanceKm: number | null;
}

/** The trip implied by the last seen country and this one, or null when there is no trip. */
function journeyOf(context: RuleContext): Journey | null {
  const { countryCode, lastCountryCode, lastCountryAt } = context;
  if (!countryCode || !lastCountryCode || !lastCountryAt) {
    return null;
  }
  if (countryCode.toUpperCase() === lastCountryCode.toUpperCase()) {
    return null;
  }
  return {
    from: lastCountryCode.toUpperCase(),
    to: countryCode.toUpperCase(),
    hours: Math.max((context.at.getTime() - lastCountryAt.getTime()) / MS_PER_HOUR, 1 / 60),
    distanceKm: countryDistanceKm(lastCountryCode, countryCode),
  };
}

/** Without a distance, fall back to "two countries impossibly close together in time". */
function withoutDistance(journey: Journey, minHours: number) {
  const observed = `${journey.from} then ${journey.to}, ${journey.hours.toFixed(1)} hours apart (distance unknown)`;
  const threshold = `at least ${minHours} hours between countries`;
  return journey.hours >= minHours
    ? notFired(observed, threshold)
    : fired(observed, threshold, severity(minHours / journey.hours, 1, 4));
}

export const geoVelocityRule: RuleEvaluator = (context, parameters) => {
  const maxKph = numberParam(parameters, 'maxKph', 900);
  const minHours = numberParam(parameters, 'minHoursBetweenCountries', 4);

  const journey = journeyOf(context);
  if (!journey) {
    return notFired('No country change since the last observed event', `under ${maxKph} km/h`);
  }
  if (journey.distanceKm === null) {
    return withoutDistance(journey, minHours);
  }

  const impliedKph = journey.distanceKm / journey.hours;
  const observed =
    `${journey.from} to ${journey.to} — ${Math.round(journey.distanceKm)} km in ` +
    `${journey.hours.toFixed(1)} hours, an implied ${Math.round(impliedKph)} km/h`;
  const threshold = `under ${maxKph} km/h`;

  if (impliedKph <= maxKph) {
    return notFired(observed, threshold);
  }
  return fired(observed, threshold, severity(impliedKph, maxKph, 3));
};
