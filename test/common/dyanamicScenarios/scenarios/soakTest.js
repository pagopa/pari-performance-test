export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 67,
        timeUnit: '1s',
        duration: '10m',
        preAllocatedVUs: 50,
        maxVUs: 200,
    },
}

