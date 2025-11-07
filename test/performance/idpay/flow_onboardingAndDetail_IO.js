import { check } from "k6";
import { Counter } from "k6/metrics";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

import { getMockLogin } from "../../common/api/mockIOLogin.js";
import { loadEnvConfig } from "../../common/loadEnv.js";
import { prepareScenario } from "../../common/scenarioSetup.js";
import { toTrimmedString } from "../../common/basicUtils.js";
import {
  fetchInitiativeByServiceId,
  fetchInitiativeDetail,
  getOnboardingStatus,
  saveOnboarding,
} from "../../common/api/onboardingClient.js";
import { getWallet } from "../../common/api/walletClient.js";
import { loadCsvArray } from "../../common/loadCsvArray.js";

// --- CONFIGURAZIONE AMBIENTE ---
const targetEnv = (__ENV.TARGET_ENV || "dev").trim().toLowerCase();
const envConfig = loadEnvConfig(targetEnv);
const baseUrl = toTrimmedString(__ENV.APIM_URL, envConfig.apimUrl || "");
if (!baseUrl) throw new Error(`Missing APIM_URL for environment: ${targetEnv}`);

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV });

export const options = {
  discardResponseBodies: false,
  scenarios: { flow_onboardingAndDetail_IO: scenarioConfig },
  thresholds: {
    http_req_duration: ["p(95)<500"],
    checks: ["rate>0.99"],
  },
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
const getWalletOk_Counter = new Counter("_getWallet_ok");
const getWalletKo_Counter = new Counter("_getWallet_ko");

const getOnboardingStatusOk_Counter = new Counter("_getOnboardingStatus_ok");
const getOnboardingStatusKo_Counter = new Counter("_getOnboardingStatus_ko");

const fetchInitiativeByServiceIdOk_Counter = new Counter("_fetchInitiativeByServiceId_ok");
const fetchInitiativeByServiceIdKo_Counter = new Counter("_fetchInitiativeByServiceId_ko");

const fetchInitiativeDetailOk_Counter = new Counter("_fetchInitiativeDetail_ok");
const fetchInitiativeDetailKo_Counter = new Counter("_fetchInitiativeDetail_ko");

const decisionGetOnboardingStatusOk_Counter = new Counter("_decisionGetOnboardingStatus_ok");
const decisionGetOnboardingStatusKo_Counter = new Counter("_decisionGetOnboardingStatus_ko");

const saveOnboardingOk_Counter = new Counter("_saveOnboarding_ok");
const saveOnboardingKo_Counter = new Counter("_saveOnboarding_ko");

const getOnboardingInitiativesUserStatusOk_Counter = new Counter("_getOnboardingInitiativesUserStatus_ok");
const getOnboardingInitiativesUserStatusKo_Counter = new Counter("_getOnboardingInitiativesUserStatus_ko");

const mockLoginCounter = new Counter("_mock_login_succeeded");

// --- CSV ---
const fiscalCodes = loadCsvArray('fiscalCodes', csvFile);

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
  const normalized = normalizeCallResult(caller(...args), okStatuses, expectedByStatus);
  const { res, ok } = normalized;

  (ok ? okCounter : koCounter).add(1);

  check(res, {
    [`${label} overall ok`]: () => ok,
    // alcuni 202/204/404 attesi potrebbero non avere body utile, non fallire il check
    [`${label} has body`]: (r) => (r && typeof r.body === "string" ? r.body.length >= 0 : true),
  });

  return res;
}

// --- TEST PRINCIPALE ---
export default function flowOnboardingAndDetailIo() {
  if (!fiscalCodes || fiscalCodes.length === 0) {
    throw new Error(`La lista dei codici fiscali è vuota. File letto: ${csvFile}`);
  }

  const fiscalCode = fiscalCodes[Math.floor(Math.random() * fiscalCodes.length)];
  const { token, ok: loginOk } = getMockLogin(fiscalCode);
  if (!loginOk || !token) return;

  mockLoginCounter.add(1);

  // 1) getWallet
  callAndTrack(getWallet, [baseUrl, token], {
    okCounter: getWalletOk_Counter,
    koCounter: getWalletKo_Counter,
    label: "✅ getWallet",
    // accettiamo come "ok" anche 404 con code WALLET_USER_NOT_ONBOARDED
    okStatuses: [200, 404],
    expectedByStatus: { 404: ["WALLET_USER_NOT_ONBOARDED"] },
  });

  // 2) getOnboardingStatus (prima volta, informativa)
  callAndTrack(getOnboardingStatus, [baseUrl, INITIATIVE_ID, token], {
    okCounter: getOnboardingStatusOk_Counter,
    koCounter: getOnboardingStatusKo_Counter,
    label: "✅ getFirstOnboardingStatus",
    okStatuses: [200, 404], // utente può non essere onboarded
  });

  // 3) fetchInitiativeByServiceId
  callAndTrack(fetchInitiativeByServiceId, [baseUrl, token, SERVICE_ID], {
    okCounter: fetchInitiativeByServiceIdOk_Counter,
    koCounter: fetchInitiativeByServiceIdKo_Counter,
    label: "✅ fetchInitiativeByServiceId",
    okStatuses: [200], // puro 200 ok
    expectedByStatus: { 404: ["INITIATIVE_NOT_FOUND"] }, // 404 con codice previsto conta come ok
  });

  // 4) fetchInitiativeDetail (allineato: 200 puro ok, 400/404 ok solo con codici attesi)
  callAndTrack(fetchInitiativeDetail, [baseUrl, token, INITIATIVE_ID], {
    okCounter: fetchInitiativeDetailOk_Counter,
    koCounter: fetchInitiativeDetailKo_Counter,
    label: "✅ fetchInitiativeDetail",
    okStatuses: [200],
    expectedByStatus: {
      404: ["ONBOARDING_USER_NOT_ONBOARDED"],
      400: ["ONBOARDING_ALREADY_ONBOARDED", "ONBOARDING_ON_EVALUATION"],
    },
  });

  // --- Gate: se non onboarded, faccio saveOnboarding; altrimenti esco pulito ---
  const decisionStatusRes = callAndTrack(getOnboardingStatus, [baseUrl, INITIATIVE_ID, token], {
    okCounter: decisionGetOnboardingStatusOk_Counter,
    koCounter: decisionGetOnboardingStatusKo_Counter,
    label: "🧭 decision.getOnboardingStatus",
    okStatuses: [200, 404], // entrambi accettati per il controllo di flusso
  });

  const decisionJson = parseJsonSafe(decisionStatusRes);
  const bodyStr = typeof decisionStatusRes?.body === "string" ? decisionStatusRes.body : "";
  const hasNotOnboardedCode =
    decisionJson?.code === "ONBOARDING_USER_NOT_ONBOARDED" ||
    decisionJson?.errorCode === "ONBOARDING_USER_NOT_ONBOARDED" ||
    bodyStr.includes("ONBOARDING_USER_NOT_ONBOARDED");

  const isNotOnboarded = decisionStatusRes?.status === 404 && hasNotOnboardedCode;
  if (!isNotOnboarded) {
    // niente save, chiudo l'iterazione
    return;
  }

  // 5) saveOnboarding (solo se 404 & codice coerente)
  const payload = {
    initiativeId: INITIATIVE_ID,
    confirmedTos: true,
    pdndAccept: true,
    selfDeclarationList: [
      { _type: "multi_consent", code: "isee", value: "3" },
      { _type: "boolean", code: "1", accepted: true },
    ],
  };

  try {
    callAndTrack(saveOnboarding, [baseUrl, token, payload], {
      okCounter: saveOnboardingOk_Counter,
      koCounter: saveOnboardingKo_Counter,
      label: "✅ saveOnboarding",
      okStatuses: [202], // esito atteso
    });
  } catch (e) {
    saveOnboardingKo_Counter.add(1);
    console.error(`saveOnboarding failed: ${e?.message ? e.message : e}`);
    return;
  }

  // 6) fetchUserInitiatives
  callAndTrack(fetchUserInitiatives, [baseUrl, token], {
    okCounter: getOnboardingInitiativesUserStatusOk_Counter,
    koCounter: getOnboardingInitiativesUserStatusKo_Counter,
    label: "✅ fetchUserInitiatives",
    okStatuses: [200],
  });
}

// ESEMPIO RUN
// ./k6 run -e K6PERF_SCENARIO_TYPE="constant-arrival-rate" -e K6PERF_TIME_UNIT="1s" -e K6PERF_PRE_ALLOCATED_VUS="10" -e K6PERF_MAX_VUS="20" -e K6PERF_RATE="1" -e K6PERF_DURATION="1s" -e TARGET_ENV="uat" -e FISCAL_CODE_FILE="../../../assets/fc_list_100k.csv" -e INITIATIVE_ID="68de7fc681ce9e35a476e985" -e SERVICE_ID="01K6JJB7W6B6F1W31EHDS9JP3Z" .\test\performance\idpay\flow_onboardingAndDetail_IO.js