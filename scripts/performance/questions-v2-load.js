import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'https://concursomestre.com').replace(/\/$/, '');

export const options = {
  scenarios: {
    pilot_read_load: {
      executor: 'ramping-arrival-rate',
      startRate: Number(__ENV.START_RPS || 2),
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 20),
      maxVUs: Number(__ENV.MAX_VUS || 100),
      stages: [
        { target: Number(__ENV.PILOT_RPS || 10), duration: __ENV.RAMP_DURATION || '1m' },
        { target: Number(__ENV.PILOT_RPS || 10), duration: __ENV.HOLD_DURATION || '3m' },
        { target: 0, duration: '30s' },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<750', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const response = http.get(
    `${baseUrl}/api/v2/questions/list.php?publication_scope=public&publish_status=published&limit=50`,
    { tags: { endpoint: 'questions-v2-list' } },
  );
  check(response, {
    'status is 200': (result) => result.status === 200,
    'response is json': (result) => String(result.headers['Content-Type'] || '').includes('application/json'),
    'contract succeeds': (result) => {
      try {
        const body = result.json();
        return body?.success === true && Array.isArray(body?.data?.items);
      } catch {
        return false;
      }
    },
  });
  sleep(0.1);
}
