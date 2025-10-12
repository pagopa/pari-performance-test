// macOS usage examples (execute from the repository root)
//   Env-driven constant-arrival scenario
//     TARGET_ENV=uat K6PERF_SCENARIO_TYPE=constant-arrival-rate K6PERF_RATE=300 K6PERF_TIME_UNIT=500ms \
//     K6PERF_DURATION=3m K6PERF_PRE_ALLOCATED_VUS=150 K6PERF_MAX_VUS=300 k6 run pdvPerformance.js
//   Manual fallback (CLI-driven)
//     TARGET_ENV=uat K6PERF_SCENARIO_TYPE=manual k6 run --vus 1 --duration 1s pdvPerformance.js
import http from 'k6/http'
import { check } from 'k6'
import { randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js'
import { loadEnvConfig } from '../../common/loadEnv.js'
import { toTrimmedString } from '../../common/basicUtils.js'
import { prepareScenario } from '../../common/scenarioSetup.js'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'

const targetEnv = toTrimmedString(__ENV.TARGET_ENV, 'dev').toLowerCase()
const TOKEN_PII_ALPHABET = 'abcdefghijklmnopqrstuvwxyz01234567890'

const envConfig = loadEnvConfig(targetEnv)
const pdvUrl = toTrimmedString(__ENV.PDV_URL, envConfig.pdvUrl || '')

if (!pdvUrl) {
    throw new Error(`Missing PDV_URL for environment: ${targetEnv}`)
}

const { scenarioConfig, logScenario } = prepareScenario({ env: __ENV })

const testOptions = {
    discardResponseBodies: true,
    thresholds: {
        checks: ['rate>0.99'],
    },
}

if (scenarioConfig) {
    testOptions.scenarios = {
        pdv: scenarioConfig,
    }
}

export const options = testOptions

export function setup() {
    logScenario()
}

export function handleSummary(data) {
    if (!data || !data.metrics) {
        return {
            stdout: 'No summary data generated.\n',
        }
    }

    const timestamp = Date.now()
    const summaryOptions = {
        indent: ' ',
        enableColors: true,
        summaryTimeUnit: 'ms',
        summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
    }

    const httpReqDurationValues =
        data.metrics.http_req_duration &&
        data.metrics.http_req_duration.values
            ? data.metrics.http_req_duration.values
            : {}
    const checkValues =
        data.metrics.checks && data.metrics.checks.values
            ? data.metrics.checks.values
            : {}

    const httpReqAvg =
        httpReqDurationValues.avg !== undefined
            ? `${httpReqDurationValues.avg} ms`
            : 'n/a'
    const httpReqP95 =
        httpReqDurationValues['p(95)'] !== undefined
            ? `${httpReqDurationValues['p(95)']} ms`
            : 'n/a'
    const httpReqP99 =
        httpReqDurationValues['p(99)'] !== undefined
            ? `${httpReqDurationValues['p(99)']} ms`
            : 'n/a'
    const checksPassed =
        checkValues.passes !== undefined ? checkValues.passes : 'n/a'
    const checksFailed =
        checkValues.fails !== undefined ? checkValues.fails : 'n/a'

    const quickStats = [
        `http_req_duration avg: ${httpReqAvg}`,
        `http_req_duration p(95): ${httpReqP95}`,
        `http_req_duration p(99): ${httpReqP99}`,
        `checks passed: ${checksPassed}`,
        `checks failed: ${checksFailed}`,
    ].join('\n')

    return {
        stdout: textSummary(data, summaryOptions),
        [`report-${timestamp}.html`]: htmlReport(data),
        [`summary-${timestamp}.json`]: JSON.stringify(data, null, 2),
        [`metrics-${timestamp}.txt`]: `${quickStats}\n`,
    }
}

export default function () {
    const payload = buildTokenPayload()

    const response = http.put(
        `${pdvUrl}/tokens`,
        JSON.stringify(payload),
        {
            headers: {
                'Content-Type': 'application/json',
            },
        }
    )

    check(response, {
        'status was 200': (r) => r.status === 200,
    })
}

function buildTokenPayload() {
    return {
        pii: randomString(12, TOKEN_PII_ALPHABET),
    }
}
