import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';


let client = null;
let connectPromise = null;

const listeners = new Map();

const brokerSubs = new Map();

function toWebSocketUrl(baseUrl) {

  const trimmed = (baseUrl || '').replace(/\/$/, '');
  return `${trimmed}/ws`;
}

function resubscribeAll() {
  listeners.forEach((_callbacks, destination) => attachBrokerSub(destination));
}

function attachBrokerSub(destination) {
  if (!client || !client.connected || brokerSubs.has(destination)) return;
  const sub = client.subscribe(destination, (message) => {
    let payload = message.body;
    try {
      payload = JSON.parse(message.body);
    } catch {

    }
    listeners.get(destination)?.forEach((cb) => {
      try {
        cb(payload);
      } catch (err) {
        console.error('STOMP listener threw for', destination, err);
      }
    });
  });
  brokerSubs.set(destination, sub);
}


export function connectSocket({ baseUrl, authToken, onConnect, onDisconnect, onError } = {}) {
  if (client && (client.active || client.connected)) {
    return connectPromise || Promise.resolve(client);
  }

  connectPromise = new Promise((resolve) => {
    client = new Client({
      webSocketFactory: () => new SockJS(toWebSocketUrl(baseUrl)),
      connectHeaders: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      reconnectDelay: 4000, 
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
      onConnect: () => {
        resubscribeAll();
        onConnect?.();
        resolve(client);
      },
      onDisconnect: () => onDisconnect?.(),
      onStompError: (frame) => {
        console.error('STOMP broker error:', frame.headers?.message, frame.body);
        onError?.(frame);
      },
      onWebSocketError: (evt) => {
        console.error('Collaboration socket error:', evt);
        onError?.(evt);
      },
    });
    client.activate();
  });

  return connectPromise;
}


export function subscribeTopic(destination, callback) {
  if (!listeners.has(destination)) listeners.set(destination, new Set());
  listeners.get(destination).add(callback);
  if (client?.connected) attachBrokerSub(destination);

  return () => {
    const set = listeners.get(destination);
    set?.delete(callback);
    if (set && set.size === 0) {
      brokerSubs.get(destination)?.unsubscribe();
      brokerSubs.delete(destination);
      listeners.delete(destination);
    }
  };
}


export function publish(destination, body, headers = {}) {
  if (!client || !client.connected) {
    console.warn('Socket not connected yet — could not publish to', destination);
    return false;
  }
  client.publish({
    destination,
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers,
  });
  return true;
}

export function isSocketConnected() {
  return !!client?.connected;
}

export function disconnectSocket() {
  brokerSubs.forEach((sub) => sub.unsubscribe());
  brokerSubs.clear();
  listeners.clear();
  client?.deactivate();
  client = null;
  connectPromise = null;
}
