// Runs on first container start. The mongo-init service handles re-runs idempotently.
try {
  rs.status();
} catch (error) {
  rs.initiate({ _id: 'icb-rs', members: [{ _id: 0, host: 'localhost:27017' }] });
}
