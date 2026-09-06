export type AgentConfig = {
  name: string;
  model: string;
  lens: 'technical' | 'business' | 'user' | 'security' | 'operations';
  expertise: string[];
  blindspots: string[];
  coreValue: string;
  fears: string[];
  axes: {
    timeHorizon: number;
    riskTolerance: number;
    decisionMode: number;
    abstraction: number;
    scope: number;
  };
  verbosity: number;
  tools: string[];
};
