export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 4,
        timeUnit: '1s',
        duration: '1m',
        preAllocatedVUs: 4,
        maxVUs: 4,
    },
}

