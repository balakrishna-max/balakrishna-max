import { createContext, useContext } from 'react';

export const AppContext = createContext({ contextPath: '' });
export const useApp = () => useContext(AppContext);

export const useAsset = () => {
  const { contextPath } = useApp();
  return (p) => `${contextPath || ''}/${p.replace(/^\/+/, '')}`;
};
