/*
 * k6 run -e RATE=100 -e URL=https://api.datavaultapp.com script-fixed-rate-dev.js --duration 1m --vus 10000
 */
import http from 'k6/http';
import { check } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
	discardResponseBodies: true,
	scenarios: {
		contacts: {
			executor: 'constant-arrival-rate',
			rate: __ENV.RATE,
			timeUnit: '1s'
		}
	},
    thresholds: {
        checks: ['rate>0.99'],
    }
};

export default function() {
    let body = {
        pii: randomString(8, 'abcdefghijklmnopqrstuvwxyz01234567890')
    };
    
    let resp = http.put(
        `${__ENV.URL}/tokens`,
        JSON.stringify(body),
        {
            headers: {
                'Content-Type': 'application/json'
            }
        });
    
    check(resp, { 'status was 200': (r) => r.status === 200 } );
}
