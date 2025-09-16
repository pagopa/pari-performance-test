import { coalesce } from '../utils.js'
import dotenv from 'k6/x/dotenv'

const vu = parseInt(coalesce(__ENV.VUS_MAX_ENV, 3), 10)
const rampStageNumber = Math.max(
  parseInt(coalesce(__ENV.SCENARIO_RAMP_STAGE_NUMBER_ENV, 3), 10),
  3
)

export const CONFIG = {
  TARGET_ENV: __ENV.TARGET_ENV,
  VIRTUAL_USERS: vu,

  SCENARIOS: {
    RAMPS: {
      STAGES_NUMBER: rampStageNumber,
      STAGE_SECONDS_DURATION: parseInt(coalesce(__ENV.SCENARIO_TIME_UNIT_ENV, 1), 10)
    }
  },

  THRESHOLDS: {
    DURATIONS: {
      AVG: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_AVG_MS_ENV, 500), 10),
      P90: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_P90_MS_ENV, 800), 10),
      P95: parseInt(coalesce(__ENV.THRESHOLDS_API_MAX_P95_MS_ENV, 1000), 10),
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