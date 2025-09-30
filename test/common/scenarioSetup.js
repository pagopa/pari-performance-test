import { toNonNegativeNumber, toTrimmedString } from './utils.js'

const scenarioAliases = {
    manual: 'manual',
    none: 'manual',
    'shared-iterations': 'shared-iterations',
    sharediterations: 'shared-iterations',
    'per-vu-iterations': 'per-vu-iterations',
    pervuiterations: 'per-vu-iterations',
    'constant-vus': 'constant-vus',
    constantvus: 'constant-vus',
    'ramping-vus': 'ramping-vus',
    rampingvus: 'ramping-vus',
    'constant-arrival-rate': 'constant-arrival-rate',
    constantarrivalrate: 'constant-arrival-rate',
    'ramping-arrival-rate': 'ramping-arrival-rate',
    rampingarrivalrate: 'ramping-arrival-rate',
}

export function normalizeScenarioType(value) {
    const canonical = (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-')
    return scenarioAliases[canonical] || (canonical ? canonical : 'constant-arrival-rate')
}

export function parseStages(raw, fallbackDuration, fallbackTarget) {
    const value = toTrimmedString(raw, '')
    if (!value) {
        return fallbackTarget === undefined
            ? []
            : [
                  {
                      duration: fallbackDuration,
                      target: fallbackTarget,
                  },
              ]
    }

    let parsed
    try {
        parsed = JSON.parse(value)
    } catch (err) {
        throw new Error(
            `K6_STAGES must be a JSON array of { duration, target } objects: ${err.message}`
        )
    }

    if (!Array.isArray(parsed)) {
        throw new Error('K6_STAGES must be a JSON array of { duration, target } objects')
    }

    const stages = parsed.map((stage, index) => {
        if (!stage || typeof stage !== 'object') {
            throw new Error(
                `K6_STAGES[${index}] must be an object with duration and target fields`
            )
        }
        const duration = toTrimmedString(stage.duration, '')
        const target = toNonNegativeNumber(stage.target)
        if (!duration) {
            throw new Error(`K6_STAGES[${index}] is missing a valid duration`)
        }
        if (target === undefined) {
            throw new Error(`K6_STAGES[${index}] is missing a numeric target >= 0`)
        }
        return { duration, target }
    })

    if (stages.length > 0) {
        return stages
    }

    return fallbackTarget === undefined
        ? []
        : [
              {
                  duration: fallbackDuration,
                  target: fallbackTarget,
              },
          ]
}

export function buildScenarioConfig(scenarioType, options) {
    if (scenarioType === 'manual') {
        return undefined
    }

    const {
        duration,
        iterations,
        vus,
        rate,
        timeUnit,
        preAllocatedVUs,
        maxVUs,
        startVUs,
        stagesRaw,
    } = options

    switch (scenarioType) {
        case 'shared-iterations':
            return {
                executor: 'shared-iterations',
                vus: Math.max(vus, 1),
                iterations: Math.max(iterations, 1),
                maxDuration: duration,
            }
        case 'per-vu-iterations':
            return {
                executor: 'per-vu-iterations',
                vus: Math.max(vus, 1),
                iterations: Math.max(iterations, 1),
                maxDuration: duration,
            }
        case 'constant-vus':
            return {
                executor: 'constant-vus',
                vus: Math.max(vus, 1),
                duration,
            }
        case 'ramping-vus':
            return {
                executor: 'ramping-vus',
                startVUs: Math.max(startVUs, 1),
                gracefulRampDown: '30s',
                stages: parseStages(stagesRaw, duration, vus),
            }
        case 'ramping-arrival-rate':
            return {
                executor: 'ramping-arrival-rate',
                timeUnit,
                preAllocatedVUs: Math.max(preAllocatedVUs, 1),
                maxVUs: Math.max(maxVUs, preAllocatedVUs, 1),
                stages: parseStages(stagesRaw, duration, rate),
            }
        case 'constant-arrival-rate':
        default:
            return {
                executor: 'constant-arrival-rate',
                rate: Math.max(rate, 1),
                timeUnit,
                duration,
                preAllocatedVUs: Math.max(preAllocatedVUs, 1),
                maxVUs: Math.max(maxVUs, preAllocatedVUs, 1),
            }
    }
}
