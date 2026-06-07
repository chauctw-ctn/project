"use strict";

class CacheStore {
  constructor() {
    this.data = new Map();
    this.lastUpdate = null;
  }

  set(source, payload) {
    this.data.set(source, {
      timestamp: new Date().toISOString(),
      data: payload,
    });

    this.lastUpdate = new Date();
  }

  get(source) {
    return this.data.get(source) || null;
  }

  getAll() {
    return Object.fromEntries(this.data);
  }

  clear() {
    this.data.clear();
  }
}

module.exports = new CacheStore();