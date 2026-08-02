/**
 * Country centroids, for implied-travel-speed checks.
 *
 * A centroid is a coarse approximation — Lagos to Kano is nearly a thousand kilometres and both
 * are "NG" — so the geo rule is deliberately tuned to catch the impossible (Accra to Tokyo in
 * twenty minutes) rather than the merely improbable. Coarse and honest beats precise and wrong.
 */
const CENTROIDS: Readonly<Record<string, readonly [number, number]>> = {
  AE: [23.42, 53.85],
  AU: [-25.27, 133.78],
  BR: [-14.24, -51.93],
  CA: [56.13, -106.35],
  CH: [46.82, 8.23],
  CN: [35.86, 104.2],
  DE: [51.17, 10.45],
  EG: [26.82, 30.8],
  ES: [40.46, -3.75],
  FR: [46.23, 2.21],
  GB: [55.38, -3.44],
  GH: [7.95, -1.02],
  IN: [20.59, 78.96],
  IT: [41.87, 12.57],
  JP: [36.2, 138.25],
  KE: [-0.02, 37.91],
  MA: [31.79, -7.09],
  NG: [9.08, 8.68],
  NL: [52.13, 5.29],
  PT: [39.4, -8.22],
  RU: [61.52, 105.32],
  SG: [1.35, 103.82],
  TR: [38.96, 35.24],
  UA: [48.38, 31.17],
  US: [37.09, -95.71],
  ZA: [-30.56, 22.94],
};

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  const [fromLat, fromLon] = from;
  const [toLat, toLon] = to;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLon = toRadians(toLon - fromLon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Distance between two country centroids, or null when either country is not in the table. */
export function countryDistanceKm(from: string, to: string): number | null {
  const origin = CENTROIDS[from.toUpperCase()];
  const destination = CENTROIDS[to.toUpperCase()];
  if (!origin || !destination) {
    return null;
  }
  return haversineKm(origin, destination);
}

export function isKnownCountry(code: string): boolean {
  return CENTROIDS[code.toUpperCase()] !== undefined;
}
