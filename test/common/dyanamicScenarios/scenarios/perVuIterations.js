import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import { CONFIG } from '../envVars.js'
import { testEntitiesBasedScenarioPrefix } from '../utils.js'

const scenarios = {}

if (!CONFIG.SCENARIOS.perVuIterations.ONESHOT) {
    let counter = 0
    let startTime = 0
    let maxIteration = CONFIG.MAX_ITERATION_ENV

    do {
        const randomVus = Math.min(
            maxIteration,
            CONFIG.SCENARIOS.perVuIterations.RAMPING_SIZE
                ? randomIntBetween(1, CONFIG.VIRTUAL_USERS)
                : CONFIG.VIRTUAL_USERS
        )

        scenarios[`${testEntitiesBasedScenarioPrefix}${counter}`] =
            buildPerVuIteration(startTime, randomVus)

        startTime = startTime + CONFIG.SCENARIOS.perVuIterations.DURATION
        counter++
        maxIteration -= randomVus
    } while (maxIteration > 0)
} else {
    scenarios['perVuIterations'] = buildPerVuIteration(0, CONFIG.VIRTUAL_USERS)
}

function buildPerVuIteration(startTime, vus) {
    return {
        executor: 'per-vu-iterations',
        vus,
        iterations: CONFIG.SCENARIOS.perVuIterations.EXECUTIONS,
        startTime: `${startTime}s`,
        maxDuration: `${CONFIG.SCENARIOS.perVuIterations.DURATION}s`,
    }
}

export default scenarios
