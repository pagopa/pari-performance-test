import {
    toNonNegativeNumber,
    toPositiveNumber,
    toTrimmedString,
    formatValueForMessage,
} from './basicUtils.js'

const SCENARIO_TYPE_ALIASES = {
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

const DEFAULT_SCENARIO_TYPE = 'constant-arrival-rate'

export function normalizeScenarioType(value) {
    const canonical = (value || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/_+/g, '-')
    return SCENARIO_TYPE_ALIASES[canonical] || (canonical ? canonical : DEFAULT_SCENARIO_TYPE)
}

export function resolveScenarioType(rawValue) {
    const scenarioTypeValue = toTrimmedString(rawValue, undefined)
    if (!scenarioTypeValue) {
        throw new Error(
            `Missing required environment variable: K6PERF_SCENARIO_TYPE (received ${formatValueForMessage(
                rawValue
            )})`
        )
    }
    return normalizeScenarioType(scenarioTypeValue)
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

    const stages = parsed.map((stage, index) => parseSingleStage(stage, index))

    if (stages.length === 0) {
        throw new Error(
            'K6PERF_STAGES (or K6PERF_STAGES_JSON) must define at least one stage with duration and target; received []'
        )
    }

    return stages
}

function parseSingleStage(candidate, index) {
    if (!candidate || typeof candidate !== 'object') {
        throw new Error(
            `K6PERF_STAGES[${index}] must be an object with duration and target fields; received ${formatValueForMessage(
                candidate
            )}`
        )
    }

    const duration = toTrimmedString(candidate.duration, '')
    const target = toNonNegativeNumber(candidate.target)

    if (!duration) {
        throw new Error(
            `K6PERF_STAGES[${index}] is missing a valid duration; received ${formatValueForMessage(
                candidate.duration
            )}`
        )
    }
    if (target === undefined) {
        throw new Error(
            `K6PERF_STAGES[${index}] is missing a numeric target >= 0; received ${formatValueForMessage(
                candidate.target
            )}`
        )
    }

    return { duration, target }
}

export const SCENARIO_OPTION_ENV_NAMES = {
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

export function readScenarioOptionsFromEnv(env = {}) {
    return {
        duration: env.K6PERF_DURATION,
        iterations: env.K6PERF_ITERATIONS,
        vus: env.K6PERF_VUS,
        rate: env.K6PERF_RATE,
        timeUnit: env.K6PERF_TIME_UNIT,
        preAllocatedVUs: env.K6PERF_PRE_ALLOCATED_VUS,
        maxVUs: env.K6PERF_MAX_VUS,
        startVUs: env.K6PERF_START_VUS,
        stagesRaw: env.K6PERF_STAGES_JSON ?? env.K6PERF_STAGES,
    }
}

function optionLabel(key) {
    return SCENARIO_OPTION_ENV_NAMES[key] || key
}

function requirePositiveNumber(scenarioType, options, key) {
    const parsed = toPositiveNumber(options[key])
    if (parsed === undefined) {
        throw new Error(
            `Scenario "${scenarioType}" requires ${optionLabel(
                key
            )} to be a positive number; received ${formatValueForMessage(options[key])}`
        )
    }
    return parsed
}

function requireString(scenarioType, options, key) {
    const value = toTrimmedString(options[key], undefined)
    if (!value) {
        throw new Error(
            `Scenario "${scenarioType}" requires ${optionLabel(
                key
            )} to be set; received ${formatValueForMessage(options[key])}`
        )
    }
    return value
}

function optionalString(options, key) {
    return toTrimmedString(options[key], undefined)
}

function ensurePoolBounds(scenarioType, preAllocatedVUs, maxVUs) {
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

function buildIterationBasedScenario(executor, scenarioType, options) {
    const config = {
        executor,
        vus: requirePositiveNumber(scenarioType, options, 'vus'),
        iterations: requirePositiveNumber(scenarioType, options, 'iterations'),
    }
    const duration = optionalString(options, 'duration')
    if (duration) {
        config.maxDuration = duration
    }
    return config
}

const SCENARIO_BUILDERS = {
    'shared-iterations': (scenarioType, options) =>
        buildIterationBasedScenario('shared-iterations', scenarioType, options),
    'per-vu-iterations': (scenarioType, options) =>
        buildIterationBasedScenario('per-vu-iterations', scenarioType, options),
    'constant-vus': (scenarioType, options) => ({
        executor: 'constant-vus',
        vus: requirePositiveNumber(scenarioType, options, 'vus'),
        duration: requireString(scenarioType, options, 'duration'),
    }),
    'ramping-vus': (scenarioType, options) => ({
        executor: 'ramping-vus',
        startVUs: requirePositiveNumber(scenarioType, options, 'startVUs'),
        gracefulRampDown: '30s',
        stages: parseStages(requireString(scenarioType, options, 'stagesRaw')),
    }),
    'ramping-arrival-rate': (scenarioType, options) => {
        const timeUnit = requireString(scenarioType, options, 'timeUnit')
        const preAllocatedVUs = requirePositiveNumber(scenarioType, options, 'preAllocatedVUs')
        const maxVUs = requirePositiveNumber(scenarioType, options, 'maxVUs')
        ensurePoolBounds(scenarioType, preAllocatedVUs, maxVUs)
        return {
            executor: 'ramping-arrival-rate',
            timeUnit,
            preAllocatedVUs,
            maxVUs,
            stages: parseStages(requireString(scenarioType, options, 'stagesRaw')),
        }
    },
    'constant-arrival-rate': (scenarioType, options) => {
        const preAllocatedVUs = requirePositiveNumber(scenarioType, options, 'preAllocatedVUs')
        const maxVUs = requirePositiveNumber(scenarioType, options, 'maxVUs')
        ensurePoolBounds(scenarioType, preAllocatedVUs, maxVUs)
        return {
            executor: 'constant-arrival-rate',
            rate: requirePositiveNumber(scenarioType, options, 'rate'),
            timeUnit: requireString(scenarioType, options, 'timeUnit'),
            duration: requireString(scenarioType, options, 'duration'),
            preAllocatedVUs,
            maxVUs,
        }
    },
}

function resolveScenarioBuilder(scenarioType) {
    if (scenarioType === 'manual') {
        return { resolvedScenarioType: 'manual', builder: undefined }
    }

    const builder = SCENARIO_BUILDERS[scenarioType]
    if (builder) {
        return { resolvedScenarioType: scenarioType, builder }
    }

    return {
        resolvedScenarioType: DEFAULT_SCENARIO_TYPE,
        builder: SCENARIO_BUILDERS[DEFAULT_SCENARIO_TYPE],
    }
}

export function computeScenarioDetails(scenarioTypeInput, options = {}) {
    const canonicalScenarioType = normalizeScenarioType(scenarioTypeInput)
    const { resolvedScenarioType, builder } = resolveScenarioBuilder(canonicalScenarioType)

    if (!builder) {
        return { resolvedScenarioType, scenarioConfig: undefined }
    }

    const scenarioConfig = builder(resolvedScenarioType, options)
    return { resolvedScenarioType, scenarioConfig }
}

function renderOptionValue(rawValue) {
    return rawValue === undefined ? '<assente>' : formatValueForMessage(rawValue)
}

function buildScenarioLogLines(scenarioType, options, resolvedScenarioType, scenarioConfig) {
    const lines = [`🎯 Scenario: ${scenarioType} → ${resolvedScenarioType}`, '📥 Parametri:']

    Object.entries(SCENARIO_OPTION_ENV_NAMES).forEach(([key, envVarName]) => {
        const rawValue = options[key]
        lines.push(`  • ${envVarName} = ${renderOptionValue(rawValue)}`)
    })

    if (scenarioConfig) {
        lines.push('⚙️ Config risultante:')
        lines.push(JSON.stringify(scenarioConfig, null, 2))
    } else {
        lines.push('⚙️ Config risultante: manual scenario (no executor)')
    }

    return lines
}

export function logScenarioDetails(
    scenarioType,
    options,
    logger = console.log,
    precomputedDetails
) {
    const { resolvedScenarioType, scenarioConfig } =
        precomputedDetails ?? computeScenarioDetails(scenarioType, options)
    const lines = buildScenarioLogLines(
        scenarioType,
        options,
        resolvedScenarioType,
        scenarioConfig
    )
    logger(lines.join('\n'))
    return { resolvedScenarioType, scenarioConfig }
}
