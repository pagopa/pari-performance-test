import { coalesce } from '../utils.js'

export const ENV = globalThis.__ENV

const vu = parseInt(coalesce(ENV.VUS_MAX_ENV, 3),10)

const rampStageNumber = Math.max(
    parseInt(coalesce(ENV.SCENARIO_RAMP_STAGE_NUMBER_ENV, 3), 10),
    3
)

export const CONFIG = {
    TARGET_ENV: ENV.TARGET_ENV,
    INITIATIVE_NAME: ENV.INITIATIVE_NAME,
    INITIATIVE_ID: ENV.INITIATIVE_ID,
    VIRTUAL_USERS: vu,

    MAX_ITERATION_ENV: coalesce(
        ENV.MAX_ITERATION_ENV,
        vu
    ),

    SCENARIOS: {
        TYPES: coalesce(ENV.SCENARIO_TYPE_ENV, 'ALL').split(','),

        perVuIterations: {
            RAMPING_SIZE:
                ENV.SCENARIO_PER_VU_RAMPING_SIZE &&
                ENV.SCENARIO_PER_VU_RAMPING_SIZE.toLowerCase() === 'true',
            ONESHOT:
                ENV.SCENARIO_PER_VU_SINGLE_ITERATION_ENV &&
                ENV.SCENARIO_PER_VU_SINGLE_ITERATION_ENV.toLowerCase() !==
                    'false',
            EXECUTIONS: parseInt(coalesce(ENV.SCENARIO_PER_VU_EXECUTIONS_ENV, 1), 10),
            DURATION: parseInt(coalesce(ENV.SCENARIO_DURATION_ENV, 3), 10),
        },

        constantArrivalRate: {
            RATE: vu,
            DURATION: parseInt(coalesce(ENV.SCENARIO_DURATION_ENV, 3),10),
            TIME_UNIT: parseInt(coalesce(ENV.SCENARIO_TIME_UNIT_ENV, 1),10),
        },

        RAMPS: {
            STAGES_NUMBER: rampStageNumber,
            STAGE_SECONDS_DURATION: parseInt(coalesce(ENV.SCENARIO_TIME_UNIT_ENV, 1),10),

            rampingGrowingArrivalRate: {
                RAMP_BUILDING_VU_POOL: Math.min(
                    parseInt(
                        coalesce(Math.ceil((vu * (rampStageNumber - 1)) / 2)
                        ) ,10
                    ),
                    Math.ceil((vu * (rampStageNumber - 1)) / 2)
                ),
            },
        },
    },

    THRESHOLDS: {
        DURATIONS: {
            AVG: parseInt(coalesce(ENV.THRESHOLDS_API_MAX_AVG_MS_ENV, 500),10),
            P90: parseInt(coalesce(ENV.THRESHOLDS_API_MAX_P90_MS_ENV, 800),10),
            P95: parseInt(coalesce(ENV.THRESHOLDS_API_MAX_P95_MS_ENV, 1000),10),
        },
        REQ_FAILED: {
            RATE: parseFloat(
                coalesce(ENV.THRESHOLDS_API_MAX_FAILED_REQ_RATE_ENV, 0.05)
            ),
        },
    },

    SUMMARY: {
        RESULTS_DIR: ENV.RESULTS_DIR,
    },

    // Raw passthroughs needed by a few scripts that read a single env var directly
    // (kept here instead of each file touching the global __ENV binding).
    APIM_MOCK_IO_SUBSCRIPTION_KEY: ENV.APIM_MOCK_IO_SUBSCRIPTION_KEY,
    KEYCLOAK_CLIENT_SECRET: ENV.KEYCLOAK_CLIENT_SECRET,
    FISCAL_CODE_FILE: ENV.FISCAL_CODE_FILE,

}
