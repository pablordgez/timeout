import type { Action, Config } from '../../core/types';
import { accepted, loadLexicon } from '../../core/lexicon';
import * as rules from './rules';
export * from './rules';
export async function createLetters(config: Config, seed: number): Promise<rules.LettersState> {
  const state = rules.createLettersSync(config,seed);
  await loadLexicon(state.language);
  return state;
}
export function evaluatePlacement(state: Parameters<typeof rules.evaluatePlacement>[0], placements: rules.Placement[], dictionary = accepted(state.language)) { return rules.evaluatePlacement(state,placements,dictionary); }
export function commitLetters(state: rules.LettersState, placements: rules.Placement[], dictionary = accepted(state.language)) { return rules.commitLetters(state,placements,dictionary); }
export function lettersReducer(state: rules.LettersState, action: Action, config: Config) { return rules.lettersReducer(state,action,config,accepted(state.language)); }
