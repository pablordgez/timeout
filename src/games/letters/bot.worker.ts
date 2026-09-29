import { buildBotDictionary, chooseLetterBotAction, type BotDictionary, type BotPosition } from './bot';
import type { Locale } from '../../core/types';
const dictionaries: Partial<Record<Locale,BotDictionary>> = {};
self.onmessage = (event: MessageEvent<{id:number;position:BotPosition;words?:string[]}>) => {
  try {
    const { position, words }=event.data;
    if(!dictionaries[position.language]) dictionaries[position.language]=buildBotDictionary(words||[],position.language);
    self.postMessage({id:event.data.id,action:chooseLetterBotAction(position,dictionaries[position.language]!)});
  } catch(error) { self.postMessage({id:event.data.id,error:error instanceof Error?error.message:'Bot failed'}); }
};
