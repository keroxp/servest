type Key = string | symbol;
export interface DataHolder {
  set<T = unknown>(key: Key, value: T): void;
  get<T = unknown>(key: Key): T | undefined;
  getString(key: Key): string | undefined;
  getNumber(key: Key): number | undefined;
  getBoolean(key: Key): boolean | undefined;
  delete(key: Key): void;
}

export function createDataHolder(): DataHolder {
  const data = new Map<Key, any>();
  function _set<T>(k: Key, v: T) {
    data.set(k, v);
  }
  function _get<T>(k: Key): T | undefined {
    return data.get(k) as T;
  }
  function _delete(k: Key) {
    data.delete(k);
  }
  function getString(k: Key): string | undefined {
    return _get<string>(k);
  }
  function getNumber(k: Key): number | undefined {
    return _get<number>(k);
  }
  function getBoolean(k: Key): boolean | undefined {
    return _get<boolean>(k);
  }
  return {
    set: _set,
    get: _get,
    delete: _delete,
    getNumber,
    getString,
    getBoolean,
  };
}
