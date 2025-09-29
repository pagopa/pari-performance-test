import {
    jUnit,
    textSummary,
} from 'https://jslib.k6.io/k6-summary/0.0.3/index.js'
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js'
import { coalesce } from './utils.js'
import { CONFIG } from './dynamicScenarios/envVars.js'
import rampingArrivalRate from './dynamicScenarios/scenarios/rampingArrivalRate.js'
import rampingGrowingArrivalRate from './dynamicScenarios/scenarios/rampingGrowingArrivalRate.js'

const outputDir = coalesce(CONFIG.SUMMARY.RESULTS_DIR, '.')

export default (application, testName) => (data) => {
    const outputFilePrefix = `${application}_${testName}`

    console.log(
        `TEST DETAILS: [Time to complete test: ${data.state.testRunDurationMs} ms, Environment target: ${CONFIG.TARGET_ENV}, Scenario test type: ${CONFIG.SCENARIOS.TYPES}, Request processed: ${data.metrics.http_reqs.values.count}, Request OK: ${data.metrics.http_req_failed.values.fails}, ERRORS: ${data.metrics.http_req_failed.values.passes}]`
    )

    if (CONFIG.SCENARIOS.TYPES.indexOf('rampingArrivalRate') > -1) {
        printRampingConfig(
            'rampingArrivalRate',
            rampingArrivalRate.rampingArrivalRate.stages
        )
    }

    if (CONFIG.SCENARIOS.TYPES.indexOf('rampingGrowingArrivalRate') > -1) {
        printRampingConfig(
            'rampingGrowingArrivalRate',
            rampingGrowingArrivalRate.rampingGrowingArrivalRate.stages
        )
    }

    const outputJUnitFile = `${outputDir}/results/${outputFilePrefix}-result.xml`
    const outputTextSummaryFile = `${outputDir}/results/${outputFilePrefix}-summary.txt`
    const outputHtmlSummaryFile = `${outputDir}/results/${outputFilePrefix}-summary.html`

    console.log(`Exporting results text format into ${outputTextSummaryFile}`)
    console.log(`Exporting results HTML format into ${outputHtmlSummaryFile}`)
    console.log(`Exporting results JUnit format into ${outputJUnitFile}`)

    return {
        stdout: textSummary(data, { indent: ' ', enableColors: true }),
        [outputTextSummaryFile]: textSummary(data, {
            indent: ' ',
            enableColors: false,
        }),
        [outputHtmlSummaryFile]: htmlReport(data),
        [outputJUnitFile]: jUnit(data, { name: outputFilePrefix }),
    }
}

function printRampingConfig(scenarioName, customStages) {
    let stringRamping = `[${scenarioName}] Ramping iterations for stage : { `

    for (let i = 0; i < customStages.length - 1; i++) {
        stringRamping += `${customStages[i].target}, `
    }

}