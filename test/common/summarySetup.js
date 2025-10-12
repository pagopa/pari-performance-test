import {
    jUnit,
    textSummary,
} from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import {
    toTrimmedString,
    toFiniteNumber,
    formatTimestamp,
    formatMs,
    formatCount,
    formatPercentage,
} from './basicUtils.js'
import {
    ensureReportsDirExists,
    resolveReportsDirectory,
} from './directoryUtils.js'
import { CONFIG } from './dynamicScenarios/envVars.js'

function resolveEnvironment() {
    return typeof __ENV !== 'undefined' ? __ENV : undefined
}

function buildSummaryLines({
    application,
    testName,
    data,
    reportsDir,
}) {
    const metrics = data?.metrics || {}
    const httpReqDuration = metrics.http_req_duration?.values || {}
    const httpReqs = metrics.http_reqs?.values || {}
    const httpReqFailed = metrics.http_req_failed?.values || {}
    const checks = metrics.checks?.values || {}
    const vus = metrics.vus?.values || {}
    const scenarioTypes = CONFIG?.SCENARIOS?.TYPES
        ? [].concat(CONFIG.SCENARIOS.TYPES).join(', ')
        : 'n/a'

    const totalRequests = toFiniteNumber(httpReqs.count)
    const failedRequests = toFiniteNumber(httpReqFailed.passes)
    const successfulRequests =
        totalRequests !== undefined && failedRequests !== undefined
            ? Math.max(totalRequests - failedRequests, 0)
            : undefined
    const failRate = toFiniteNumber(httpReqFailed.rate)
    const checksPassed = toFiniteNumber(checks.passes)
    const checksFailed = toFiniteNumber(checks.fails)
    const vusMax = toFiniteNumber(vus.max)

    return [
        `• 🆔 Test: ${application} / ${testName}`,
        `• 🌍 Target env: ${CONFIG?.TARGET_ENV || 'n/a'}`,
        `• 🎯 Scenario: ${scenarioTypes}`,
        `• ⏱️ Durata test: ${formatMs(data?.state?.testRunDurationMs)}`,
        `• 📦 Richieste: ${formatCount(totalRequests)} totali (${formatCount(
            successfulRequests
        )} ✅ / ${formatCount(failedRequests)} ❌)`,
        `• ⚡ p(95): ${formatMs(httpReqDuration['p(95)'])}`,
        `• 🚀 p(99): ${formatMs(httpReqDuration['p(99)'])}`,
        `• 📉 Error rate: ${formatPercentage(failRate)}`,
        `• ✅ Checks: ${formatCount(checksPassed)} pass / ${formatCount(
            checksFailed
        )} fail`,
        `• 👥 VUs max: ${formatCount(vusMax)}`,
        `• 🗂️ Report path: ${reportsDir}`,
    ]
}

export function prepareSummary({
    application,
    testName,
    reportsDir,
    logger = console.log,
    logOnPrepare = false,
} = {}) {
    const resolvedApplication = toTrimmedString(application)
    const resolvedTestName = toTrimmedString(testName)

    if (!resolvedApplication) {
        throw new Error('Missing summary application name')
    }

    if (!resolvedTestName) {
        throw new Error('Missing summary test name')
    }

    const env = resolveEnvironment()
    const resolvedReportsDir = resolveReportsDirectory({
        providedDir: reportsDir,
        env,
    })

    if (env) {
        env.RESULTS_DIR = resolvedReportsDir
    }
    if (CONFIG && CONFIG.SUMMARY) {
        CONFIG.SUMMARY.RESULTS_DIR = resolvedReportsDir
    }

    const logSummary = () => {
        const logFn = typeof logger === 'function' ? logger : console.log
        logFn(
            `📝 Summary setup ready → application=${resolvedApplication}, test=${resolvedTestName}, folder=${resolvedReportsDir}`
        )
    }

    if (logOnPrepare) {
        logSummary()
    }

    const handleSummary = (data) => {
        const logFn = typeof logger === 'function' ? logger : console.log

        if (!data || !data.metrics) {
            logFn('⚠️ Nessun dato di summary disponibile, nessun report generato.')
            return {
                stdout: 'No summary data generated.\n',
            }
        }

        const reportsReady = ensureReportsDirExists(
            resolvedReportsDir,
            logger
        )

        if (!reportsReady) {
            logFn(
                `⚠️ La cartella report "${resolvedReportsDir}" non è stata creata automaticamente. Verifica i permessi o crea la directory manualmente.`
            )
        }

        const lines = buildSummaryLines({
            application: resolvedApplication,
            testName: resolvedTestName,
            data,
            reportsDir: resolvedReportsDir,
        })

        logFn('📊 Performance Snapshot')
        lines.forEach((line) => logFn(line))

        const timestamp = formatTimestamp(new Date())
        const filePrefix = `${resolvedApplication}_${resolvedTestName}-${timestamp}`
        const basePath = `${resolvedReportsDir}/${filePrefix}`

        return {
            stdout: textSummary(data, {
                indent: ' ',
                enableColors: true,
                summaryTimeUnit: 'ms',
                summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
            }),
            [`${basePath}.html`]: htmlReport(data),
            [`${basePath}.json`]: JSON.stringify(data, null, 2),
            [`${basePath}.xml`]: jUnit(data, { name: `${resolvedApplication}_${resolvedTestName}` }),
        }
    }

    return {
        application: resolvedApplication,
        testName: resolvedTestName,
        outputDir: resolvedReportsDir,
        handleSummary,
        logSummary,
    }
}
