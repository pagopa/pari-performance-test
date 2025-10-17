import { htmlReport, textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';

import { getTokenIO } from '../../common/api/tokenAuth.js';
import { createBarCode } from '../../common/api/payment.js';
import { toTrimmedString } from '../../common/basicUtils.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';

/** Load fiscal codes from CSV */
const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_10k.csv');
  return csv
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

/** Environment and API configuration */
const targetEnv = (__ENV.TARGET_ENV || 'uat').trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '');

if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
}

/** Scenario setup */
const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: true,
  scenarios: {
    createVoucher: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
};

/**
 * Generates test summary reports.
 * @param {Object} data - K6 test result data.
 * @returns {Object} Report files.
 */
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

/** Setup function for logging scenario */
export function setup() {
  logScenario();
}

/** Test data */
const initiativeId = '68de7fc681ce9e35a476e985';


export default function () {
  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];

  //console.log(`🧾 FiscalCode: ${fiscalCode}`);

  if (!fiscalCode) {
    console.error(`Index ${iterationIndex} out of range. Skipping iteration.`);
    return;
  }

  //console.log('🔑 Requesting tokens...');
  const tokenIO = getTokenIO(fiscalCode);
  //console.log('✅ Tokens retrieved successfully.');
  //console.log('TokenIO:',tokenIO)

  let trxCode;
    /** Create Voucher */
  group('Create Voucher', () => {
    const payload = { initiativeId };
    //console.log('📦 Creating voucher...');
    const res = createBarCode(baseUrl, tokenIO, payload);
    check(res, { 'Voucher created (201)': r => r?.status === 201 });

    trxCode = res.json('trxCode');
    if (!trxCode) {
      throw new Error('❌ Missing trxCode in createBarCode response.');
    }
    console.log(`🎟️ trxCode generated: ${trxCode}`);
  });

}
