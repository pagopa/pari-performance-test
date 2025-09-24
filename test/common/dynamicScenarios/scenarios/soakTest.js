export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 200,
        timeUnit: '1m',
        duration: '5m',
        preAllocatedVUs: 100,
        maxVUs: 1000,
    },
}