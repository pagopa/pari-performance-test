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
import { ensureReportsDirExists, resolveReportsDirectory } from './directoryUtils.js'
import { CONFIG } from './dynamicScenarios/envVars.js'

function createSummaryLogger(logger) {
    return typeof logger === 'function' ? logger : console.log
}

function validateSummaryConfig({ application, testName, reportsDir, env, config }) {
    const resolvedApplication = toTrimmedString(application)
    const resolvedTestName = toTrimmedString(testName)

    if (!resolvedApplication) {
        throw new Error('Missing summary application name')
    }

    if (!resolvedTestName) {
        throw new Error('Missing summary test name')
    }

    const outputDir = resolveReportsDirectory({
        providedDir: reportsDir,
        env,
    })

    if (env) {
        env.RESULTS_DIR = outputDir
    }

    if (config && config.SUMMARY) {
        config.SUMMARY.RESULTS_DIR = outputDir
    }

    return {
        application: resolvedApplication,
        testName: resolvedTestName,
        outputDir,
    }
}

function setupSummaryHandler({ context, logger, config }) {
    return (data) => {
        if (!data?.metrics) {
            logger('⚠️ Nessun dato di summary disponibile, nessun report generato.')
            return {
                stdout: 'No summary data generated.\n',
            }
        }

        const reportsReady = ensureReportsDirExists(context.outputDir)
        if (reportsReady === false) {
            logger(
                `⚠️ La cartella report "${context.outputDir}" non esiste. Creala manualmente per ricevere i file di output.`
            )
        }

        const metrics = data.metrics || {}
        const httpReqDuration = metrics.http_req_duration?.values || {}
        const httpReqs = metrics.http_reqs?.values || {}
        const httpReqFailed = metrics.http_req_failed?.values || {}
        const checks = metrics.checks?.values || {}
        const vus = metrics.vus?.values || {}

        const scenarioTypes = (() => {
            if (!config?.SCENARIOS?.TYPES) {
                return 'n/a'
            }
            const types = []
                .concat(config.SCENARIOS.TYPES)
                .filter(Boolean)
            return types.length > 0 ? types.join(', ') : 'n/a'
        })()

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

        const lines = [
            `• 🆔 Test: ${context.application} / ${context.testName}`,
            `• 🌍 Target env: ${config?.TARGET_ENV || 'n/a'}`,
            `• 🎯 Scenario: ${scenarioTypes}`,
            `• ⏱️ Durata test: ${formatMs(data.state?.testRunDurationMs)}`,
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
            `• 🗂️ Report path: ${context.outputDir}`,
        ]

        logger('📊 Performance Snapshot')
        lines.forEach((line) => logger(line))

        const timestamp = formatTimestamp(new Date())
        const basePath = `${context.outputDir}/${context.application}_${context.testName}-${timestamp}`

        const summaryText = textSummary(data, {
            indent: ' ',
            enableColors: true,
            summaryTimeUnit: 'ms',
            summaryTrendStats: ['avg', 'min', 'max', 'p(90)', 'p(95)', 'p(99)'],
        })

        return {
            stdout: summaryText,
            [`${basePath}.html`]: htmlReport(data),
            [`${basePath}.json`]: JSON.stringify(data, null, 2),
            [`${basePath}.xml`]: jUnit(data, { name: `${context.application}_${context.testName}` }),
        }
    }
}

export function prepareSummary({
    application,
    testName,
    reportsDir,
    logger = console.log,
    logOnPrepare = false,
} = {}) {
    const env = typeof __ENV !== 'undefined' ? __ENV : undefined
    const config = CONFIG
    const context = validateSummaryConfig({
        application,
        testName,
        reportsDir,
        env,
        config,
    })
    const summaryLogger = createSummaryLogger(logger)

    const logSummary = () => {
        summaryLogger(
            `📝 Summary setup ready → application=${context.application}, test=${context.testName}, folder=${context.outputDir}`
        )
    }

    if (logOnPrepare) {
        logSummary()
    }

    const handleSummary = setupSummaryHandler({
        context,
        logger: summaryLogger,
        config,
    })

    return {
        application: context.application,
        testName: context.testName,
        outputDir: context.outputDir,
        handleSummary,
        logSummary,
    }
}
