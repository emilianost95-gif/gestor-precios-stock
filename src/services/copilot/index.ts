export * from './types';
export * from './insights';
export * from './actions';
export { getInventoryContext, buildLastMovementMap, buildLastPriceChangeMap } from './inventoryContext';
export type { InventorySource } from './inventoryContext';
export { answerLocally } from './localEngine';
export type { EngineDeps } from './localEngine';
export { askCopilot, isAiBackendConfigured, COPILOT_API_URL } from './copilotClient';
