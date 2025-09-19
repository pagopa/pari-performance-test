export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 5,
        timeUnit: '1s',
        duration: '1m',
        preAllocatedVUs: 5,
        maxVUs: 5,
    },
}

