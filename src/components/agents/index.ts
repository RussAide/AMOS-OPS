/**
 * components/agents/index.ts
 *
 * Barrel export for AMOS agent persona system components.
 *
 * Tech: React 19, TypeScript 5.9
 */

export {
  AgentPersonaIndicator,
  getAgentForRoute,
  AGENT_PERSONAS,
} from "./AgentPersonaIndicator";

export type {
  AgentPersonaIndicatorProps,
  AgentPersona,
  AgentStatus,
  AgentColor,
} from "./AgentPersonaIndicator";
