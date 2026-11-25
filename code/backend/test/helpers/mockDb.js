require('./setup');

const dbPath = require.resolve('../../src/db');

const state = {
  handler: async () => ({ rows: [] }),
  calls: [],
};

const fakeDb = {
  query(sql, params) {
    state.calls.push({ sql: String(sql), params });
    return state.handler(String(sql), params);
  },
  pool: {
    connect: async () => ({
      query: (sql, params) => fakeDb.query(sql, params),
      release() {},
    }),
  },
};

// Replace the real module before any route/service requires it.
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: fakeDb,
};

function setHandler(handler) {
  state.handler = handler;
}

function reset() {
  state.handler = async () => ({ rows: [] });
  state.calls.length = 0;
}

function finding(fragment) {
  return state.calls.find((call) =>
    call.sql.replace(/\s+/g, ' ').toLowerCase().includes(fragment.toLowerCase())
  );
}

module.exports = {
  fakeDb,
  setHandler,
  reset,
  calls: state.calls,
  finding,
};
