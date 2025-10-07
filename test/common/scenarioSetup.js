import {
    readScenarioOptionsFromEnv,
    resolveScenarioType,
    computeScenarioDetails,
    logScenarioDetails as logScenarioDetailsInternal,
} from './scenarioSetupUtils.js'

export { normalizeScenarioType, parseStages, logScenarioDetails } from './scenarioSetupUtils.js'

export function buildScenarioConfig(scenarioType, options) {
    const { scenarioConfig } = computeScenarioDetails(scenarioType, options)
    return scenarioConfig
}

export function getScenarioDebugSnapshot(scenarioType, options) {
    return computeScenarioDetails(scenarioType, options)
}

export function prepareScenario({ env, logger = console.log, logOnPrepare = false } = {}) {
    const effectiveEnv = env || (typeof __ENV !== 'undefined' ? __ENV : {})
    const { scenarioType } = resolveScenarioType(effectiveEnv)
    const scenarioOptions = readScenarioOptionsFromEnv(effectiveEnv)
    const details = computeScenarioDetails(scenarioType, scenarioOptions)
    const logScenario = () =>
        logScenarioDetailsInternal(scenarioType, scenarioOptions, logger, details)

    if (logOnPrepare) {
        logScenario()
    }

    return {
        scenarioType,
        resolvedScenarioType: details.resolvedScenarioType,
        scenarioOptions,
        scenarioConfig: details.scenarioConfig,
        logScenario,
    }
}
