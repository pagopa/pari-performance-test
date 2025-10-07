import {
    toNonNegativeNumber,
    toPositiveNumber,
    toTrimmedString,
    formatValueForMessage,
} from './basicUtils.js'

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

export function parseStages(raw) {
    const value = toTrimmedString(raw, '')
    if (!value) {
        throw new Error(
            `Missing required K6PERF_STAGES (or K6PERF_STAGES_JSON) definition for ramping scenarios; received ${formatValueForMessage(
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
            `K6PERF_STAGES (or K6PERF_STAGES_JSON) must be a JSON array of { duration, target } objects; received ${formatValueForMessage(
                parsed
            )}`
        )
    }

    const stages = parsed.map((stage, index) => {
        if (!stage || typeof stage !== 'object') {
            throw new Error(
                `K6PERF_STAGES[${index}] must be an object with duration and target fields; received ${formatValueForMessage(
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
                `K6PERF_STAGES[${index}] is missing a valid duration; received ${formatValueForMessage(
                    durationRaw
                )}`
            )
        }
        if (target === undefined) {
            throw new Error(
                `K6PERF_STAGES[${index}] is missing a numeric target >= 0; received ${formatValueForMessage(
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
    stagesRaw: 'K6PERF_STAGES_JSON / K6PERF_STAGES',
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
            )} to be a positive number; received ${formatValueForMessage(rawValue)}`
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
            )} to be set; received ${formatValueForMessage(rawValue)}`
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

function resolveScenarioBuilder(scenarioType) {
    if (scenarioType === 'manual') {
        return { resolvedScenarioType: 'manual', builder: undefined }
    }
    const builder = scenarioBuilders[scenarioType]
    if (builder) {
        return { resolvedScenarioType: scenarioType, builder }
    }
    return {
        resolvedScenarioType: defaultScenarioType,
        builder: scenarioBuilders[defaultScenarioType],
    }
}

function computeScenarioConfig(scenarioType, options) {
    const { resolvedScenarioType, builder } = resolveScenarioBuilder(scenarioType)
    if (!builder) {
        return { resolvedScenarioType, scenarioConfig: undefined }
    }
    const scenarioConfig = builder(scenarioType, options)
    return { resolvedScenarioType, scenarioConfig }
}

export function buildScenarioConfig(scenarioType, options) {
    const { scenarioConfig } = computeScenarioConfig(scenarioType, options)
    return scenarioConfig
}

export function getScenarioDebugSnapshot(scenarioType, options) {
    return computeScenarioConfig(scenarioType, options)
}

export function logScenarioDetails(scenarioType, options, logger = console.log) {
    const { resolvedScenarioType, scenarioConfig } = computeScenarioConfig(
        scenarioType,
        options
    )
    const lines = [`🎯 Scenario: ${scenarioType} → ${resolvedScenarioType}`]

    lines.push('📥 Parametri:')
    Object.entries(optionEnvNames).forEach(([key, envVarName]) => {
        const rawValue = options[key]
        const rendered =
            rawValue === undefined ? '<assente>' : formatValueForMessage(rawValue)
        lines.push(`  • ${envVarName} = ${rendered}`)
    })

    if (scenarioConfig) {
        lines.push('⚙️ Config risultante:')
        lines.push(JSON.stringify(scenarioConfig, null, 2))
    } else {
        lines.push('⚙️ Config risultante: manual scenario (no executor)')
    }

    logger(lines.join('\n'))
    return { resolvedScenarioType, scenarioConfig }
}
