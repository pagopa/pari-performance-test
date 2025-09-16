import { CONFIG } from '../envVars.js'

const stages = []
const stageNumber = CONFIG.SCENARIOS.RAMPS.STAGES_NUMBER
const timeUnit = CONFIG.SCENARIOS.RAMPS.STAGE_SECONDS_DURATION
const vus = CONFIG.VIRTUAL_USERS

for (let i = 0; i < stageNumber; i++) {
    const target = Math.round((vus / stageNumber) * (i + 1))
    stages.push({ duration: `${timeUnit}s`, target })
}

export default {
    rampingGrowingArrivalRate: {
        executor: 'ramping-arrival-rate',
        timeUnit: `${timeUnit}s`,
        preAllocatedVUs: Math.max(1, Math.round(vus / stageNumber)),
        maxVUs: vus * 2,
        stages: stages,
    }
}
