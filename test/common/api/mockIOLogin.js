import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import { logResult } from '../dynamicScenarios/utils.js';

export const IDPAY_ONBOARDING_API_NAMES = {
  testLogin: 'idpay/mock-io',
};

const mockLoginErrorCounter = new Counter('mock_login_failed');

export function getMockLogin(baseUrl, fiscalCode) {
  const apiName = IDPAY_ONBOARDING_API_NAMES.testLogin;
  const url = `${baseUrl}/shared/mock-io/login?fiscalCode=${fiscalCode}`;

  const headers = {};
  if (__ENV.APIM_MOCK_IO_SUBSCRIPTION_KEY) {
    headers['Ocp-Apim-Subscription-Key'] = __ENV.APIM_MOCK_IO_SUBSCRIPTION_KEY;
  }

  const res = http.post(url, null, { headers, responseType: 'text' });

  // ✅ esegui i check qui
  const ok = check(res, {
    '✅ mock login status 200': (r) => r.status === 200,
    '📦 mock login body is not empty': (r) => r.body && r.body.length > 0,
  });

  if (!ok) {
    logResult?.(`❌ Login failed for ${fiscalCode} - status: ${res.status}`);
    mockLoginErrorCounter.add(1);
  }

  return {
    res,
    ok,
    token: ok ? res.body : null,
  };
}