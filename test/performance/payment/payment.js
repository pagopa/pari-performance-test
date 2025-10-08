import { htmlReport, textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import exec from 'k6/execution';
import {
  getTokenIO,
  getTokenKeycloak
} from '../../common/api/tokenAuth.js'
import {
  getProductsApproved,
  createBarCode,
  previewPayment,
  authPayment,
} from '../../common/api/payment.js'
import {
  toTrimmedString
} from '../../common/basicUtils.js';
import { loadEnvConfig } from '../../common/loadEnv.js';
import { prepareScenario } from '../../common/scenarioSetup.js';

const fiscalCodes = new SharedArray('fiscalCodes', () => {
  const csv = open('../../../assets/fc_list_10k.csv');
  return csv.split('\n')
    .map(line => line.trim())
    .filter(line => line && line !== 'CF');
});

const targetEnv = (__ENV.TARGET_ENV || 'dev').trim().toLowerCase()

const envConfig = loadEnvConfig(targetEnv)

const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || '')
const keycloakUrl = toTrimmedString(__ENV.KEYCLOAK_URL, envConfig.keycloakUrl || '')

if (!baseUrl) {
  throw new Error(`Missing APIM_URL for environment: ${targetEnv}`)
}
if (!keycloakUrl) {
  throw new Error(`Missing KEYCLOAK_URL for environment: ${targetEnv}`)
}

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV })

export const options = {
  discardResponseBodies: true,
  scenarios: {
    onboardingStatus: scenarioConfig,
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
  },
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`report-${new Date().getTime()}.html`]: htmlReport(data),
  }
}

export function setup() {
    logScenario()
}

const initiativeId = '68dd003ccce8c534d1da22bc'
const startIndex = 1000000;
const email = __ENV.USER_EMAIL || 'referente234@gmail.com'
const password = __ENV.USER_PASSWORD || 'test'

export default function (data) {
  const index = startIndex + exec.scenario.iterationInTest;
  const fiscalCode = fiscalCodes[index]

  if (!fiscalCode) {
    console.error(`Indice ${index} fuori dai limiti. L'iterazione si ferma.`);
    return;
  }

  const tokenIO = getTokenIO(fiscalCode)
  const tokenKeycloak = getTokenKeycloak(keycloakUrl, email, password)

  group('Payment API - End-to-End Flow', () => {
    let trxCode
    let randomProduct


    group('Create Voucher', () => {

      const payload = { initiativeId: data.initiativeId }
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.tokenIO}`,
      }

      const res = createBarCode(payload, headers)
      check(res, { 'Voucher created (201)': (r) => r?.status === 201 })

      trxCode = res.json('trxCode')
      if (!trxCode) {
        throw new Error('❌ Missing trxCode in createBarCode response.')
      }
    })

    group('Get Products', () => {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.tokenKeycloak}`,
      }

      const res = getProductsApproved(headers)
      check(res, { 'Products retrieved (200)': (r) => r?.status === 200 })

      const productList = res.json('content') || []
      if (!productList.length) {
        throw new Error('❌ No products available for preview.')
      }

      randomProduct =
        productList[Math.floor(Math.random() * productList.length)]
    })

    group('Preview and Authorize Payment', () => {
      const previewHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.tokenKeycloak}`,
      }

      const previewPayload = {
        productGtin: randomProduct.gtinCode,
        productName: randomProduct.productName,
        amountCents: 1000,
        discountCode: trxCode,
      }

      const previewRes = previewPayment(previewPayload, previewHeaders)
      check(previewRes, { 'Preview succeeded (200)': (r) => r?.status === 200 })

      const authPayload = {
        additionalProperties: { productGtin: randomProduct.gtinCode },
        amountCents: 1000,
        discountCode: trxCode,
      }

      const authRes = authPayment(authPayload, previewHeaders)
      check(authRes, {
        'Auth succeeded (200)': (r) =>
          [200].includes(r?.status),
      })
    })
  })
}
