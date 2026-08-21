/**
 * Process-local environment for the SEC-02 suite (runs in every worker, before spec imports).
 *
 * `BACKGROUND_JOBS_ENABLED=false` keeps the outbox drain and the approved-postings sweep quiet
 * against a throwaway database, so a background pass never races an assertion.
 */

process.env['BACKGROUND_JOBS_ENABLED'] = 'false';
