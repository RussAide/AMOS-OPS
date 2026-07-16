/**
 * components/agents/index.ts
 *
 * Barrel export for AMOS agent persona system components.
 *
 * Tech: React 19, TypeScript 5.9
 */

export {
  AgentPersonaIndicator,
} from "./agent-persona-indicator";

export { getAgentForRoute, AGENT_PERSONAS } from "./agent-personas";

export type {
  AgentPersona,
  AgentPersonaIndicatorProps,
  AgentStatus,
  AgentColor,
} from "./agent-personas";
