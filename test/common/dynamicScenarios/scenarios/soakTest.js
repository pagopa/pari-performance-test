export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 20,
        timeUnit: '1s',
        duration: '1m',
        preAllocatedVUs: 10,
        maxVUs: 10,
    },
}

