import { toNonNegativeNumber, toPositiveNumber, toTrimmedString } from './basicUtils.js'

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

function formatOptionValue(value) {
    if (value === undefined) {
        return 'undefined'
    }
    if (value === null) {
        return 'null'
    }
    if (typeof value === 'string') {
        return value.length === 0 ? '"" (empty string)' : `"${value}"`
    }
    if (typeof value === 'number' || typeof value === 'bigint') {
        return String(value)
    }
    if (typeof value === 'boolean') {
        return value ? 'true' : 'false'
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value)
        } catch {
            return '[object]'
        }
    }
    return String(value)
}

export function parseStages(raw) {
    const value = toTrimmedString(raw, '')
    if (!value) {
        throw new Error(
            `Missing required K6PERF_STAGES (or K6PERF_STAGES_JSON) definition for ramping scenarios; received ${formatOptionValue(
                raw
            )}`
        )
    }

    let parsed
    try {
        parsed = JSON.parse(value)
    } catch (err) {
        throw new Error(
            `K6PERF_STAGES (or K6PERF_STAGES_JSON) must be a JSON array of { duration, target } objects; received ${value}. ${err.message}`
        )
    }

    if (!Array.isArray(parsed)) {
        throw new Error(
            `K6PERF_STAGES (or K6PERF_STAGES_JSON) must be a JSON array of { duration, target } objects; received ${formatOptionValue(
                parsed
            )}`
        )
    }

    const stages = parsed.map((stage, index) => {
        if (!stage || typeof stage !== 'object') {
            throw new Error(
                `K6PERF_STAGES[${index}] must be an object with duration and target fields; received ${formatOptionValue(
                    stage
                )}`
            )
        }
        const durationRaw = stage.duration
        const targetRaw = stage.target
        const duration = toTrimmedString(durationRaw, '')
        const target = toNonNegativeNumber(targetRaw)
        if (!duration) {
            throw new Error(
                `K6PERF_STAGES[${index}] is missing a valid duration; received ${formatOptionValue(
                    durationRaw
                )}`
            )
        }
        if (target === undefined) {
            throw new Error(
                `K6PERF_STAGES[${index}] is missing a numeric target >= 0; received ${formatOptionValue(
                    targetRaw
                )}`
            )
        }
        return { duration, target }
    })

    if (stages.length === 0) {
        throw new Error(
            'K6PERF_STAGES (or K6PERF_STAGES_JSON) must define at least one stage with duration and target; received []'
        )
    }

    return stages
}

const optionEnvNames = {
    duration: 'K6PERF_DURATION',
    iterations: 'K6PERF_ITERATIONS',
    vus: 'K6PERF_VUS',
    rate: 'K6PERF_RATE',
    timeUnit: 'K6PERF_TIME_UNIT',
    preAllocatedVUs: 'K6PERF_PRE_ALLOCATED_VUS',
    maxVUs: 'K6PERF_MAX_VUS',
    startVUs: 'K6PERF_START_VUS',
    stagesRaw: 'K6PERF_STAGES_JSON or K6PERF_STAGES',
}

function optionLabel(key) {
    return optionEnvNames[key] || key
}

function getRequiredPositiveNumberOption(scenarioType, options, key) {
    const rawValue = options[key]
    const parsed = toPositiveNumber(rawValue)
    if (parsed === undefined) {
        throw new Error(
            `Scenario "${scenarioType}" requires ${optionLabel(
                key
            )} to be a positive number; received ${formatOptionValue(rawValue)}`
        )
    }
    return parsed
}

function getRequiredStringOption(scenarioType, options, key) {
    const rawValue = options[key]
    const value = toTrimmedString(rawValue, undefined)
    if (!value) {
        throw new Error(
            `Scenario "${scenarioType}" requires ${optionLabel(
                key
            )} to be set; received ${formatOptionValue(rawValue)}`
        )
    }
    return value
}

function getOptionalStringOption(options, key) {
    return toTrimmedString(options[key], undefined)
}

function assertMaxPool(scenarioType, preAllocatedVUs, maxVUs) {
    if (maxVUs < preAllocatedVUs) {
        throw new Error(
            `Scenario "${scenarioType}" requires ${optionLabel(
                'maxVUs'
            )} (${maxVUs}) to be greater than or equal to ${optionLabel(
                'preAllocatedVUs'
            )} (${preAllocatedVUs})`
        )
    }
}

const defaultScenarioType = 'constant-arrival-rate'

const scenarioBuilders = {
    'shared-iterations': (scenarioType, options) => {
        const config = {
            executor: 'shared-iterations',
            vus: getRequiredPositiveNumberOption(scenarioType, options, 'vus'),
            iterations: getRequiredPositiveNumberOption(scenarioType, options, 'iterations'),
        }
        const duration = getOptionalStringOption(options, 'duration')
        if (duration) {
            config.maxDuration = duration
        }
        return config
    },
    'per-vu-iterations': (scenarioType, options) => {
        const config = {
            executor: 'per-vu-iterations',
            vus: getRequiredPositiveNumberOption(scenarioType, options, 'vus'),
            iterations: getRequiredPositiveNumberOption(scenarioType, options, 'iterations'),
        }
        const duration = getOptionalStringOption(options, 'duration')
        if (duration) {
            config.maxDuration = duration
        }
        return config
    },
    'constant-vus': (scenarioType, options) => ({
        executor: 'constant-vus',
        vus: getRequiredPositiveNumberOption(scenarioType, options, 'vus'),
        duration: getRequiredStringOption(scenarioType, options, 'duration'),
    }),
    'ramping-vus': (scenarioType, options) => ({
        executor: 'ramping-vus',
        startVUs: getRequiredPositiveNumberOption(scenarioType, options, 'startVUs'),
        gracefulRampDown: '30s',
        stages: parseStages(getRequiredStringOption(scenarioType, options, 'stagesRaw')),
    }),
    'ramping-arrival-rate': (scenarioType, options) => {
        const timeUnit = getRequiredStringOption(scenarioType, options, 'timeUnit')
        const preAllocatedVUs = getRequiredPositiveNumberOption(
            scenarioType,
            options,
            'preAllocatedVUs'
        )
        const maxVUs = getRequiredPositiveNumberOption(scenarioType, options, 'maxVUs')
        assertMaxPool(scenarioType, preAllocatedVUs, maxVUs)
        return {
            executor: 'ramping-arrival-rate',
            timeUnit,
            preAllocatedVUs,
            maxVUs,
            stages: parseStages(getRequiredStringOption(scenarioType, options, 'stagesRaw')),
        }
    },
    'constant-arrival-rate': (scenarioType, options) => {
        const preAllocatedVUs = getRequiredPositiveNumberOption(
            scenarioType,
            options,
            'preAllocatedVUs'
        )
        const maxVUs = getRequiredPositiveNumberOption(scenarioType, options, 'maxVUs')
        assertMaxPool(scenarioType, preAllocatedVUs, maxVUs)
        return {
            executor: 'constant-arrival-rate',
            rate: getRequiredPositiveNumberOption(scenarioType, options, 'rate'),
            timeUnit: getRequiredStringOption(scenarioType, options, 'timeUnit'),
            duration: getRequiredStringOption(scenarioType, options, 'duration'),
            preAllocatedVUs,
            maxVUs,
        }
    },
}

export function buildScenarioConfig(scenarioType, options) {
    if (scenarioType === 'manual') {
        return undefined
    }

    const builder = scenarioBuilders[scenarioType] || scenarioBuilders[defaultScenarioType]
    return builder(scenarioType, options)
}
