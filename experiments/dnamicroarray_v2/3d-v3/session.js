/* Local save/resume for one run. The manual allows pausing after any incubation (p.11);
   the simulation extends that to any point. Data stays in this browser; nothing is uploaded.
   Camera calibration is never stored. */
(function(root){
  'use strict';
  const KEY='microarray3d-v3-run', APP='microarray-3d-3', CHANNEL='microarray3d-v3';

  class Session {
    constructor(storage=root.localStorage){
      this.storage=storage;this.available=true;this.otherTab=false;this.tabId=Math.random().toString(36).slice(2);
      try{const probe=KEY+'-probe';this.storage.setItem(probe,'1');this.storage.removeItem(probe);}catch{this.available=false;}
      if(typeof BroadcastChannel!=='undefined'){
        try{
          this.channel=new BroadcastChannel(CHANNEL);
          this.channel.onmessage=e=>{
            if(e.data?.tab===this.tabId)return;
            if(e.data?.type==='hello')this.channel.postMessage({type:'here',tab:this.tabId});
            if(['hello','here'].includes(e.data?.type)){this.otherTab=true;this.onOtherTab?.();}
          };
          this.channel.unref?.(); // lets Node test runs exit; browsers ignore it
          this.channel.postMessage({type:'hello',tab:this.tabId});
        }catch{this.channel=null;}
      }
    }
    save(state){
      if(!this.available)return false;
      try{this.storage.setItem(KEY,JSON.stringify({app:APP,savedAt:Date.now(),...state}));return true;}
      catch{this.available=false;return false;}
    }
    load(){
      if(!this.available)return null;
      try{
        const data=JSON.parse(this.storage.getItem(KEY)||'null');
        return data&&data.app===APP&&data.protocol?data:null;
      }catch{return null;}
    }
    clear(){try{this.storage.removeItem(KEY);}catch{}}
    close(){this.channel?.close();}
  }
  // Human-readable age for the resume prompt.
  function age(savedAt,now=Date.now()){
    const minutes=Math.max(0,Math.floor((now-savedAt)/60000));
    if(minutes<1)return 'just now';if(minutes<60)return minutes+' min ago';
    const hours=Math.round(minutes/60);if(hours<48)return hours+' h ago';
    return Math.round(hours/24)+' days ago';
  }
  const api={Session,age,KEY,APP};root.MicroarraySession=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
