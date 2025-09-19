export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 3,
        timeUnit: '1s',
        duration: '1m',
        preAllocatedVUs: 3,
        maxVUs: 3,
    },
}

