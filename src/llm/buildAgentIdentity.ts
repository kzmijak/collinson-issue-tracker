import type { AgentConfig } from './AgentConfig.js';

export function buildAgentIdentity(config: AgentConfig): string {
  return [role(config), perspective(config), personality(config), verbosity(config)]
    .filter(Boolean)
    .join('\n\n');
}

function role(c: AgentConfig): string {
  return `You are ${c.name}, viewing the world through a ${c.lens} lens.

Your deep expertise: ${c.expertise.join(', ')}.
Your known blindspots: ${c.blindspots.join(', ')}.`;
}

function perspective(c: AgentConfig): string {
  const { axes } = c;
  return `How you think:
- ${axisLabel('Time horizon', axes.timeHorizon, ['fixated on immediate delivery', 'pragmatic about timelines', 'balanced between now and later', 'leaning toward long-term thinking', 'obsessed with long-term consequences'])}
- ${axisLabel('Risk tolerance', axes.riskTolerance, ['extremely risk-averse, demand proof before any change', 'cautious, prefer proven approaches', 'balanced risk assessment', 'comfortable with calculated risks', 'thrive on bold moves, willing to break things'])}
- ${axisLabel('Decision mode', axes.decisionMode, ['methodical and data-driven, need evidence for everything', 'lean analytical but trust patterns', 'blend of analysis and intuition', 'trust gut feelings backed by experience', 'strongly intuitive, decide fast and adjust'])}
- ${axisLabel('Abstraction', axes.abstraction, ['concrete and implementation-focused, show me the code', 'prefer tangible examples over theory', 'comfortable moving between abstract and concrete', 'think in patterns and principles', 'operate at the highest conceptual level, focus on models and invariants'])}
- ${axisLabel('Scope', axes.scope, ['laser-focused on the immediate task', 'aware of nearby concerns', 'balanced local and system view', 'naturally think about system-wide implications', 'always zoom out to the full ecosystem'])}`;
}

function personality(c: AgentConfig): string {
  return `What drives you: ${c.coreValue}.

What you fear most: ${c.fears.join('; ')}.

These fears are visceral — when you sense them in a proposal, you push back hard.`;
}

function verbosity(c: AgentConfig): string {
  const descriptions: [string, string, string, string, string] = [
    'Keep each response under 50 words. Be terse and decisive — every word must earn its place.',
    'Keep each response under 100 words. Be concise — make your point and stop.',
    'Keep each response under 200 words. Balance brevity with substance.',
    'You may use up to 300 words when the argument demands it. Develop key points but avoid rambling.',
    'No length restriction. Develop your arguments fully, with examples and reasoning.',
  ];
  const tier = Math.min(Math.floor((c.verbosity - 1) / 2), 4);
  return `Communication style: ${descriptions[tier]}`;
}

function axisLabel(
  name: string,
  value: number,
  descriptions: [string, string, string, string, string],
): string {
  const tier = Math.min(Math.floor((value - 1) / 2), 4);
  return `${name}: ${descriptions[tier]}`;
}
