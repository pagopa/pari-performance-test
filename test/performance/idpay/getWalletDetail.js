import { check, group } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';

import { getMockLogin } from '../../common/api/mockIOLogin.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { getWalletDetail } from '../../common/api/walletClient.js';
import { loadCsvArray } from '../../common/loadCsvArray.js';

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');
if (!baseUrl) throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: { getWallet: scenarioConfig },
  thresholds: { http_req_duration: ['p(95)<500'] },
};

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

export function setup() {
  logScenario();
}

const INITIATIVE_ID = __ENV.INITIATIVE_ID || '68de7fc681ce9e35a476e985';

// 🔹 Legge il nome file CSV dall’ambiente o usa un default
const csvFile = __ENV.FISCAL_CODE_FILE || '../../../assets/fc_list_100k.csv';

// 🔹 Carica i codici fiscali
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

export default function () {
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

    // Get a mock IO token for the selected user.
  const tokenIO = getMockLogin(fiscalCode).body;

  group('Wallet API → get Wallet Detail', () => {
    const res = getWalletDetail(baseUrl, tokenIO, INITIATIVE_ID);
    check(res, {
      '✅ Response status is 200': r => r.status === 200,
      '📦 Response body is not empty': r => !!r.body && r.body.length > 0,
    });
  });
}

// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e INITIATIVE_ID="68de7fc681ce9e35a476e985" .\test\performance\idpay\getWalletDetail.js