const host = process.env.MISSION_CONTROL_HEALTH_HOST || '127.0.0.1';
const port = Number.parseInt(process.env.PORT || '3000', 10) || 3000;
const url = process.env.MISSION_CONTROL_HEALTH_URL || `http://${host}:${port}/api/health`;

try {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Healthcheck failed with HTTP ${response.status} for ${url}`);
    process.exit(1);
  }

  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
} catch (error) {
  console.error(`Healthcheck request failed for ${url}`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
