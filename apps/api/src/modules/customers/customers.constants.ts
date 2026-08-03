/** Relationship value is reported in the bank's base currency; multi-currency conversion is the FX card's job. */
export const BASE_CURRENCY = 'USD';

/** Data-export document conventions. */
export const EXPORT_LABEL = 'Personal data export';
export const EXPORT_FILENAME = 'personal-data-export.pdf';
/** The export lists recent sessions only; a churned device farm from 2024 is not the footprint. */
export const EXPORT_SESSION_LIMIT = 50;
