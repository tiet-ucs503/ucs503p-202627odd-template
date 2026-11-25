require('./setup');

const redisPath = require.resolve('../../src/redis');

const store = new Map();

const fakeRedis = {
  async set(key, value) {
    store.set(key, value);
    return 'OK';
  },
  async get(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async del(key) {
    return store.delete(key) ? 1 : 0;
  },
};

require.cache[redisPath] = {
  id: redisPath,
  filename: redisPath,
  loaded: true,
  exports: {
    getRedisClient: () => fakeRedis,
    getRedisStatus: () => ({ status: 'connected', backend: 'redis' }),
  },
};

function resetRedis() {
  store.clear();
}

module.exports = { fakeRedis, resetRedis, store };
