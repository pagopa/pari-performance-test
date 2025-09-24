export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 1000,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 1000,
        maxVUs: 5000,
    },
}