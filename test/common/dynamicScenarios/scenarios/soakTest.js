export default {
    soakTest: {
        executor: 'constant-arrival-rate',
        rate: 4,
        timeUnit: '1s',
        duration: '2m',
        preAllocatedVUs: 5,
        maxVUs: 5,
    },
}

