(function(root){'use strict';
class TimerClock{
 constructor({now,readSpeed,advance}={}){this.now=now||(()=>Date.now());this.readSpeed=readSpeed||(()=>1);this.advance=advance||(()=>{});this.anchor=null;this.rate=1}
 _speed(){let n=Number(this.readSpeed());return Number.isFinite(n)&&n>0?n:1}
 start(now=this.now()){this.anchor=now;this.rate=this._speed();return this}
 reset(){this.anchor=null;this.rate=this._speed();return this}
 running(){return this.anchor!==null}
 sync(now=this.now()){if(this.anchor===null){this.anchor=now;this.rate=this._speed();return 0}let elapsed=Math.max(0,(now-this.anchor)/1000);this.anchor=now;if(!elapsed)return 0;let scaled=elapsed*this.rate;this.advance(scaled);return scaled}
 changeSpeed(now=this.now()){if(this.anchor!==null)this.sync(now);this.rate=this._speed();return this.rate}
}
root.ClassroomTimerClock={TimerClock};
if(typeof module!=='undefined'&&module.exports)module.exports=root.ClassroomTimerClock;
})(globalThis);
