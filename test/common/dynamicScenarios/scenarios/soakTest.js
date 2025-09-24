export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 85,
        timeUnit: '1s',
        duration: '5m',
        preAllocatedVUs: 10,
        maxVUs: 10,
    },
}