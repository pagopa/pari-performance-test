import {isEnvValid} from "./envUrl.js";
import dotenv from 'k6/x/dotenv'

export function setupEnvironment(environmentsPath) {
    const services = JSON.parse(open(environmentsPath))
    if (isEnvValid(__ENV.TARGET_ENV)) { // NOSONAR
        const myEnv = dotenv.parse(open(`../../.env.${__ENV.TARGET_ENV}.local`))
        const baseUrl = services[`${__ENV.TARGET_ENV}`].baseUrl

        return {
            env: myEnv,
            baseUrl: baseUrl
        }
    } else {
        throw new Error("Invalid environment");
    }
}
