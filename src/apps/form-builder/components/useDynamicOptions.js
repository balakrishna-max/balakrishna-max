import { useCallback, useEffect, useRef, useState } from 'react';
import { parseOptions } from '../model/dynamicSource';
import { fetchDataSource } from '../api/dynamicFormApi';


export default function useDynamicOptions(wanted) {
  const [cache, setCache] = useState({});
  const inflight = useRef(new Set());

  const load = useCallback((key, ds, request) => {
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    setCache((c) => ({ ...c, [key]: { status: 'loading', options: [] } }));
    fetchDataSource(request)
      .then((res) => {
        const options = parseOptions(res, ds);
        setCache((c) => ({ ...c, [key]: { status: 'ready', options } }));
      })
      .catch((e) => {
        console.warn('[SmartForms] dynamic dropdown failed', request.url, e);
        setCache((c) => ({ ...c, [key]: { status: 'error', options: [], message: e.message } }));
      })
      .finally(() => inflight.current.delete(key));
  }, []);

  useEffect(() => {
    wanted.forEach(({ ds, request }) => {
      if (request.ready && !cache[request.key]) load(request.key, ds, request);
    });
  }, [wanted, cache, load]);

  const state = {};
  wanted.forEach(({ id, ds, request }) => {
    if (!ds || !ds.url) state[id] = { status: 'unset', options: [], message: 'API URL is not set' };
    else if (!request.ready) state[id] = { status: 'waiting', options: [], missing: request.missing };
    else state[id] = cache[request.key] || { status: 'loading', options: [] };
  });

  const retry = useCallback((id) => {
    const w = wanted.find((x) => x.id === id);
    if (!w) return;
    setCache((c) => {
      const n = { ...c };
      delete n[w.request.key];
      return n;
    });
  }, [wanted]);

  return { state, retry };
}
