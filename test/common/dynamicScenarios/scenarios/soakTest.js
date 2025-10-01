export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 200,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 1000,
        maxVUs: 5000,
    },
}
