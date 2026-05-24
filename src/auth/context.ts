import { AsyncLocalStorage } from 'async_hooks';
import type { AuthMode } from '../config.ts';

const storage = new AsyncLocalStorage<AuthMode>();

export const authContext = {
    run: <T>(mode: AuthMode, fn: () => T): T => storage.run(mode, fn),
    get: (): AuthMode | undefined => storage.getStore(),
};
