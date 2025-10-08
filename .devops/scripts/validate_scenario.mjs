#!/usr/bin/env node
/**
 * Validates k6 scenario parameters using the shared scenarioSetup utilities.
 * Intended to run in CI before invoking the actual k6 script.
 */

import { prepareScenario } from '../../test/common/scenarioSetup.js'

const interestingEntries = Object.entries(process.env)
    .filter(([key]) => key === 'TARGET_ENV' || key.startsWith('K6PERF_'))
    .sort(([a], [b]) => a.localeCompare(b))

const scenarioEnv = Object.fromEntries(interestingEntries)

console.log('ℹ️ Scenario validation inputs:')
if (interestingEntries.length === 0) {
    console.log('  <no TARGET_ENV or K6PERF_* variables provided>')
} else {
    for (const [key, value] of interestingEntries) {
        console.log(`  ${key} = ${value}`)
    }
}

try {
    prepareScenario({
        env: scenarioEnv,
        logOnPrepare: true,
    })
    console.log('✅ Scenario parameters validated successfully via scenarioSetup.js')
} catch (error) {
    console.error('❌ Scenario validation failed:')
    if (error && error.stack) {
        console.error(error.stack)
    } else {
        console.error(String(error))
    }
    process.exitCode = 1
}
