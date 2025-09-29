import { coalesce } from '../utils.js'
import dotenv from 'k6/x/dotenv'

const vu = parseInt(coalesce(__ENV.VUS_MAX_ENV, 3),10)// NOSONAR

const rampStageNumber = Math.max(
    parseInt(coalesce(__ENV.SCENARIO_RAMP_STAGE_NUMBER_ENV, 3), 10),
    3
)

export const CONFIG = {
    TARGET_ENV: __ENV.TARGET_ENV,
    VIRTUAL_USERS: vu,

    MAX_ITERATION_ENV: coalesce(
        __ENV.MAX_ITERATION_ENV,
        vu
    ),

    SCENARIOS: {
        TYPES: coalesce(__ENV.SCENARIO_TYPE_ENV, 'ALL').split(','),

        perVuIterations: {
            RAMPING_SIZE:
                __ENV.SCENARIO_PER_VU_RAMPING_SIZE &&
                __ENV.SCENARIO_PER_VU_RAMPING_SIZE.toLowerCase() === 'true',
            ONESHOT:
                __ENV.SCENARIO_PER_VU_SINGLE_ITERATION_ENV &&
                __ENV.SCENARIO_PER_VU_SINGLE_ITERATION_ENV.toLowerCase() !==
                    'false',
            EXECUTIONS: parseInt(coalesce(__ENV.SCENARIO_PER_VU_EXECUTIONS_ENV, 1), 10),
            DURATION: parseInt(coalesce(__ENV.SCENARIO_DURATION_ENV, 3), 10),
        },

        constantArrivalRate: {
            RATE: vu,
            DURATION: parseInt(coalesce(__ENV.SCENARIO_DURATION_ENV, 3),10),
            TIME_UNIT: parseInt(coalesce(__ENV.SCENARIO_TIME_UNIT_ENV, 1),10),
        },

        RAMPS: {
            STAGES_NUMBER: rampStageNumber,
            STAGE_SECONDS_DURATION: parseInt(coalesce(__ENV.SCENARIO_TIME_UNIT_ENV, 1),10),

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
            AVG: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_AVG_MS_ENV, 500),10),
            P90: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_P90_MS_ENV, 800),10),
            P95: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_P95_MS_ENV, 1000),10),
        },
        REQ_FAILED: {
            RATE: parseFloat(
                coalesce(__ENV.THRESHOLDS_API_MAX_FAILED_REQ_RATE_ENV, 0.05)
            ),
        },
    },

    SUMMARY: {
        RESULTS_DIR: __ENV.RESULTS_DIR,
    },

    AUTH_KEYS: dotenv.parse(open(__ENV.SECRETS_FILE_PATH))
}