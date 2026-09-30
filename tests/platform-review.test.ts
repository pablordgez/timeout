import { describe, expect, it } from 'vitest';
import { emptyData, mergeData, validateSave, conflicts, type Session } from '../src/core/storage';
import { createSolitaire, findHint, solitaireReducer } from '../src/games/solitaire/engine';
import { createLettersSync, lettersReducer } from '../src/games/letters/rules';
const session = (state: Session['state'],id='sample'):Session => ({id,gameId:'solitaire',gameVersion:1,config:{variant:'klondike',draw:3},locale:'es',state,startedAt:'2026-09-30T00:00:00Z',updatedAt:'2026-09-30T01:00:00Z',elapsed:40});
describe('Platform save review',()=>{
  it('preserves all solitaire undo snapshots and stock order through JSON transfer',()=>{
    let state=createSolitaire({variant:'klondike',draw:3},91);
    for(let i=0;i<25;i++) {const hint=findHint(state);if(!hint)break;state=solitaireReducer(state,hint,{draw:3});}
    const data={...emptyData(),sessions:[session(state)]};
    const imported=validateSave(JSON.parse(JSON.stringify(data)));
    expect(imported.sessions[0].state).toEqual(JSON.parse(JSON.stringify(state)));
    expect(solitaireReducer(imported.sessions[0].state as typeof state,{type:'undo'},{draw:3})).toEqual(solitaireReducer(state,{type:'undo'},{draw:3}));
  });
  it('preserves provisional letters, rack IDs, language and current player for restart',()=>{
    let state=createLettersSync({language:'es',players:4},217);
    state=lettersReducer(state,{type:'PLACE',row:7,col:7,tileId:state.players[0].rack[0].id,letter:'CH'},{});
    const record={...session(state),gameId:'letters',config:{language:'es',players:4,humans:3}};
    const imported=validateSave(JSON.parse(JSON.stringify({...emptyData(),sessions:[record]})));
    expect(imported.sessions[0]).toEqual(record);
  });
  it('merges a completed incoming match against an unfinished local match only with explicit preference',()=>{
    const state=createSolitaire({},3);
    const local={...emptyData(),sessions:[session(state)]};
    const completed={...session({...state,status:'won'}),finishedAt:'2026-09-30T01:01:00Z'};
    const incoming={...emptyData(),history:[completed]};
    expect(conflicts(local,incoming)).toBe(1);
    const kept=mergeData(local,incoming);expect(kept.sessions).toHaveLength(1);expect(kept.history).toHaveLength(0);
    const replaced=mergeData(local,incoming,true);expect(replaced.sessions).toHaveLength(0);expect(replaced.history).toEqual([completed]);
    expect(mergeData(replaced,incoming,true).history).toHaveLength(1);
  });
  it('returns independent deep snapshots and rejects malicious prototype keys',()=>{
    const data={...emptyData(),sessions:[session(createSolitaire({},2))]};
    const validated=validateSave(data);validated.sessions[0].state.stock.pop();
    expect(validated.sessions[0].state.stock.length).toBe(data.sessions[0].state.stock.length-1);
    expect(()=>validateSave(JSON.parse(JSON.stringify(data).replace('"score":0','"score":0,"__proto__":{}')))).toThrow();
  });
  it('rejects unfinished records in history and invalid completion timestamps',()=>{
    const active=session(createSolitaire({},7));
    expect(()=>validateSave({...emptyData(),history:[active]})).toThrow();
    expect(()=>validateSave({...emptyData(),history:[{...active,state:{...active.state,status:'won'},finishedAt:'not-a-date'}]})).toThrow();
    expect(()=>validateSave({...emptyData(),sessions:[{...active,state:{...active.state,status:'won'}}]})).toThrow();
    expect(()=>validateSave({...emptyData(),sessions:[{...active,finishedAt:'2026-09-30T01:02:00Z'}]})).toThrow();
  });
});
