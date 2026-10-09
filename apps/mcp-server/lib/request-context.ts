import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const requestContext = new AsyncLocalStorage<{requestId: string}>();

export function runWithRequestId<T>(callback: () => Promise<T>): Promise<T> {
  return requestContext.run({requestId: randomUUID()}, callback);
}

export function currentRequestId(): string {
  return requestContext.getStore()?.requestId ?? randomUUID();
}
