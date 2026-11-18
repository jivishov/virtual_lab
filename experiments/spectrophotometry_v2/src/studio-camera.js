// B06's shared room/hand camera, with a generation guard for permission and device changes.
export class StudioCamera extends EventTarget {
  constructor(devices=navigator.mediaDevices, makeVideo=()=>document.createElement('video')) {
    super();
    this.devices=devices;
    this.makeVideo=makeVideo;
    this.owners=new Set();
    this.generation=0;
    this.mirrored=true;
    this.video=null;
    this.pending=null;
  }
  notify(){this.dispatchEvent(new Event('change'))}
  async open(deviceId,facing) {
    if(!this.devices?.getUserMedia)throw new Error('Open the studio on localhost or HTTPS to use a camera.');
    const token=this.generation, video=this.makeVideo();
    const stream=await this.devices.getUserMedia({audio:false,video:{
      ...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:facing}}),
      resizeMode:{ideal:'none'},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}
    }});
    const stop=()=>stream.getTracks().forEach(track=>track.stop());
    try {
      if(token!==this.generation)throw new DOMException('Camera request ended','AbortError');
      video.muted=video.playsInline=video.autoplay=true;
      video.srcObject=stream;await video.play();
      if(token!==this.generation)throw new DOMException('Camera request ended','AbortError');
      const track=stream.getVideoTracks()[0];
      if(!track)throw new Error('No video track was available.');
      const previous=this.video;
      this.video=video;
      this.mirrored=(track.getSettings().facingMode||facing)==='user';
      track.addEventListener('ended',()=>{if(this.video===video)this.stopAll()},{once:true});
      this.notify();
      if(previous){previous.srcObject?.getTracks().forEach(t=>t.stop());previous.srcObject=null}
      return video;
    } catch(error){stop();video.srcObject=null;throw error}
  }
  opening(deviceId,facing) {
    const operation=this.open(deviceId,facing).finally(()=>{if(this.pending===operation)this.pending=null});
    this.pending=operation;return operation;
  }
  async use(owner) {
    const token=this.generation;
    this.owners.add(owner);
    try {
      if(!this.video)await (this.pending||this.opening('',owner==='room'?'environment':'user'));
      if(token!==this.generation||!this.owners.has(owner)||!this.video)throw new DOMException('Camera request ended','AbortError');
      this.notify();return this.video;
    } catch(error){if(token===this.generation){this.owners.delete(owner);this.notify()}throw error}
  }
  release(owner) {
    if(!this.owners.delete(owner))return;
    if(!this.owners.size)this.stopAll();else this.notify();
  }
  stopAll() {
    this.generation++;this.owners.clear();this.pending=null;
    const video=this.video;this.video=null;
    if(video){video.srcObject?.getTracks().forEach(t=>t.stop());video.srcObject=null}
    this.notify();
  }
  async inputs() {
    try{return (await this.devices.enumerateDevices()).filter(d=>d.kind==='videoinput')}catch{return []}
  }
  async switchDevice() {
    const video=this.video, list=await this.inputs();
    if(!video||this.video!==video||this.pending||list.length<2)return false;
    const current=video.srcObject.getVideoTracks()[0].getSettings().deviceId;
    const next=list[(list.findIndex(d=>d.deviceId===current)+1)%list.length];
    await this.opening(next.deviceId,'user');return true;
  }
  mirror(value){this.mirrored=value;this.notify()}
}
