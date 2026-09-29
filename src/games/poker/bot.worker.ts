import { pokerBot, type PokerState } from './engine';
import type { Config } from '../../core/types';
self.onmessage=(event:MessageEvent<{state:PokerState;config:Config}>)=>{
  try{self.postMessage({action:pokerBot(event.data.state,event.data.config)});}catch(error){self.postMessage({error:error instanceof Error?error.message:String(error)});}
};
