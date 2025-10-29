import { check } from "k6";
import { Counter } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

import { getMockLogin } from "../../common/api/mockIOLogin.js";
import { loadEnvConfig } from "../../common/loadEnv.js";
import { prepareScenario } from "../../common/scenarioSetup.js";
import { toTrimmedString } from "../../common/basicUtils.js";
import { fetchInitiativeByServiceId, fetchInitiativeDetail } from "../../common/api/onboardingClient.js";
import { loadCsvArray } from "../../common/loadCsvArray.js";

// --- CONFIGURAZIONE AMBIENTE ---
const targetEnv = (__ENV.TARGET_ENV || "dev").trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || "");
if (!baseUrl) throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: false,
  scenarios: { flow_initiative: scenarioConfig },
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
const SERVICE_ID = __ENV.SERVICE_ID || "01K6JJB7W6B6F1W31EHDS9JP3Z";
const INITIATIVE_ID = __ENV.INITIATIVE_ID || "68de7fc681ce9e35a476e985";
const csvFile = __ENV.FISCAL_CODE_FILE || "../../../assets/fc_list_100k.csv";

// --- COUNTERS ---
const fetchInitiativeByServiceIdOk_Counter = new Counter("_fetchInitiativeByServiceIdOk");
const fetchInitiativeByServiceIdKo_Counter = new Counter("_fetchInitiativeByServiceIdKo");
const fetchInitiativeDetailOk_Counter = new Counter("_fetchInitiativeDetailOk");
const fetchInitiativeDetailKo_Counter = new Counter("_fetchInitiativeDetailKo");
const mockLoginCounter = new Counter("_mock_login_succeeded");

// --- CARICAMENTO CSV ---
const fiscalCodes = loadCsvArray("fiscalCodes", csvFile);

// --- FUNZIONI DI SUPPORTO ---
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
  const codes = expectedByStatus[res.status];
  if (!codes || codes.length === 0) return false;
  const j = parseJsonSafe(res);
  const code = j?.code;
  return !!code && codes.includes(code);
};

// --- LOG ESTESO ---
const logResponseDetails = (label, res) => {
  if (!res) {
    console.error(`❌ [${label}] Nessuna risposta ricevuta`);
    return;
  }

  const bodyPreview =
    res.body && res.body.length > 250
      ? res.body.substring(0, 250) + "..."
      : res.body;

  const parsed = parseJsonSafe(res);
  const code = parsed?.code ? parsed.code : "—";

  console.log(
    `\n📘 [${label}] status=${res.status} | code=${code} | bodyPreview="${bodyPreview}"`
  );
};

/**
 * Chiamata + tracciamento + check + log dettagliati.
 * - okStatuses: array di status “puri” considerati OK (default [200])
 * - expectedByStatus: mappa {status: [codes]} per errori attesi che contano come OK
 */
const callAndTrack = (caller, args, okCounter, koCounter, label) => {
  const { res, ok } = caller(...args); // usa validateAndLogResponse interno al client
  (ok ? okCounter : koCounter).add(1);

  // opzionale: un solo check "riassuntivo" nel test
  check(res, {
    [`${label} overall ok`]: () => ok,
    [`${label} body not empty`]: (r) => r && !!r.body && r.body.length > 0,
  });

  return res;
};

// --- TEST PRINCIPALE ---
export default function () {
  if (!fiscalCodes || fiscalCodes.length === 0) {
    throw new Error(`La lista dei codici fiscali è vuota. File letto: ${csvFile}`);
  }

  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];
  const { token, ok } = getMockLogin(fiscalCode);
  if (!ok || !token) {
    return;
  }

  mockLoginCounter.add(1);

  // ---- CHIAMATE API ----
  callAndTrack(
    fetchInitiativeByServiceId,
    [baseUrl, token, SERVICE_ID],
    fetchInitiativeByServiceIdOk_Counter,
    fetchInitiativeByServiceIdKo_Counter,
    "✅ fetchInitiativeByServiceId"
  );

  callAndTrack(
    fetchInitiativeDetail,
    [baseUrl, token, INITIATIVE_ID],
    fetchInitiativeDetailOk_Counter,
    fetchInitiativeDetailKo_Counter,
    "✅ fetchInitiativeDetail"
  );
}


// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e INITIATIVE_ID="68de7fc681ce9e35a476e985" -e SERVICE_ID="01K6JJB7W6B6F1W31EHDS9JP3Z" .\test\performance\idpay\flow_onboardingInitiative_IO.js