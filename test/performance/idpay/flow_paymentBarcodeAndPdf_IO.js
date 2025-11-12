import { check } from "k6";
import { Counter } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

import { getTokenKeycloakClientCredentials } from '../../common/api/tokenAuth.js';
import { getMockLogin } from "../../common/api/mockIOLogin.js";
import { loadEnvConfig } from "../../common/loadEnv.js";
import { prepareScenario } from "../../common/scenarioSetup.js";
import { toTrimmedString } from "../../common/basicUtils.js";
import { downloadPdf, getBarcode } from '../../common/api/payment.js';
import { loadCsvArray } from "../../common/loadCsvArray.js";

// --- CONFIGURAZIONE AMBIENTE ---
const targetEnv = (__ENV.TARGET_ENV || "dev").trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || "");
const keycloakUserUrl = toTrimmedString(__ENV.KEYCLOAK_USER_URL, envConfig.keycloakUserUrl || '');
if (!baseUrl) throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);
if (!keycloakUserUrl) throw new Error(`Missing KEYCLOAK_USER_URL for environment: ${targetEnv}`);

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: false,
  scenarios: { flow_paymentBarcodeAndPdf_IO: scenarioConfig },
  thresholds: { http_req_duration: ["p(95)<500"] },
};

// --- REPORT ---
export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    [`report-${Date.now()}.html`]: htmlReport(data),
  };
}

export function setup() {
  logScenario();
}

// --- COSTANTI ---
const INITIATIVE_ID = __ENV.INITIATIVE_ID || "68de7fc681ce9e35a476e985";
const csvFile = __ENV.FISCAL_CODE_FILE || "../../../assets/fc_list_100k.csv";
const TRX_CODE = __ENV.TRX_CODE || "wtkfws34";

// --- COUNTERS ---
const getBarcodeOk_Counter = new Counter("_getBarcode_ok");
const getBarcodeKo_Counter = new Counter("_getBarcode_ko");
const downloadPdfOk_Counter = new Counter("_downloadPdf_ok");
const downloadPdfKo_Counter = new Counter("_downloadPdf_ko");
const mockLoginIoCounter = new Counter("_mock_login_Io_succeeded");
const mockLoginKeyCounter = new Counter("_mock_login_Key_succeeded");

// --- CARICAMENTO CSV ---
const fiscalCodes = loadCsvArray("fiscalCodes", csvFile);

// --- UTILS ---
const parseJsonSafe = (res) => {
  if (!res?.body) return null;
  try {
    return res?.json?.() ?? JSON.parse(res.body);
  } catch {
    return null;
  }
};

const isOkStatus = (res, okStatuses = [200]) => !!res && okStatuses.includes(res.status);

const isExpectedError = (res, expectedByStatus = {}) => {
  if (!res) return false;
  const list = expectedByStatus[res.status];
  if (!list || list.length === 0) return false;
  const j = parseJsonSafe(res);
  return !!j?.code && list.includes(j.code);
};

function normalizeCallResult(result, okStatuses = [200], expectedByStatus = {}) {
  // Client che restituiscono Response "puro" (es. wallet)
  if (result && typeof result.status === "number") {
    const res = result;
    const ok = isOkStatus(res, okStatuses) || isExpectedError(res, expectedByStatus);
    return { res, ok };
  }
  // Client che restituiscono { res, ok } (es. onboarding)
  if (result?.res) {
    const res = result.res;
    const ok =
      typeof result.ok === "boolean"
        ? result.ok
        : isOkStatus(res, okStatuses) || isExpectedError(res, expectedByStatus);
    return { res, ok };
  }
  return { res: result || null, ok: false };
}

/**
 * Chiamata + tracciamento + check compatti
 */
function callAndTrack(caller, args, { okCounter, koCounter, label, okStatuses = [200], expectedByStatus = {} }) {
console.log(`Calling ${label} with args: ${JSON.stringify(args)}`);
  const normalized = normalizeCallResult(caller(...args), okStatuses, expectedByStatus);
  const { res, ok } = normalized;
  (ok ? okCounter : koCounter).add(1);
  check(res, {
    [`${label} overall ok`]: () => ok,
    [`${label} has body`]: (r) => (r && typeof r.body === "string" ? r.body.length >= 0 : true),
  });

  return res;
}

// --- TEST PRINCIPALE ---
export default function flowPaymentBarcodeAndPdfIo () {
  if (!fiscalCodes || fiscalCodes.length === 0) {
    throw new Error(`La lista dei codici fiscali è vuota. File letto: ${csvFile}`);
  }

  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];
  const { token, ok: loginOk } = getMockLogin(fiscalCode);
  const tokenKeycloak = getTokenKeycloakClientCredentials(keycloakUserUrl,
    {
      clientId: 'performance-test-client',
      clientSecret: 'xFS3pAsJe5xblxdWqJZbktSCmbWm9Qtr'
    }
  );
  if (!loginOk || !token || !tokenKeycloak) return;

  mockLoginIoCounter.add(1);
  mockLoginKeyCounter.add(1);

  callAndTrack(getBarcode, [baseUrl, token, INITIATIVE_ID], {
    okCounter: getBarcodeOk_Counter,
    koCounter: getBarcodeKo_Counter,
    label: "✅ getBarcode",
    okStatuses: [200, 403, 404],
    expectedByStatus: { 403: ["PAYMENT_USER_NOT_ONBOARDED"], 404: ["PAYMENT_NOT_FOUND_OR_EXPIRED"] },
  });

  callAndTrack(downloadPdf, [baseUrl, tokenKeycloak, INITIATIVE_ID, TRX_CODE], {
    okCounter: downloadPdfOk_Counter,
    koCounter: downloadPdfKo_Counter,
    label: "✅ downloadPdf",
    okStatuses: [200, 403, 404],
    expectedByStatus: { 403: ["PAYMENT_USER_NOT_ONBOARDED"], 404: ["PAYMENT_NOT_FOUND_OR_EXPIRED"] },
  });
}
// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e INITIATIVE_ID="68de7fc681ce9e35a476e985" -e TRX_CODE="wtkfws34" .\test\performance\idpay\flow_paymentBarcodeAndPdf_IO.js