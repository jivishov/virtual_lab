/* Classic worker keeps MediaPipe's WASM importScripts loader off the UI thread. */
let detector=null,generation=0,initializing=false;
const closeDetector=()=>{try{detector?.close()}catch{}detector=null};
self.onmessage=async event=>{
 const data=event.data;
 if(data.type==='init'){
  const gen=data.generation;generation=gen;initializing=true;closeDetector();
  try{
   const {createDetector}=await import('./hand-camera.js');
   const out=await createDetector({offscreen:true});
   if(generation!==gen){out.detector.close();return}
   detector=out.detector;initializing=false;self.postMessage({type:'ready',generation:gen,backend:out.backend});
  }catch{if(generation===gen){initializing=false;self.postMessage({type:'error',generation:gen,message:'The local hand-tracking model could not load.'})}}
 }else if(data.type==='frame'){
  const start=performance.now();
  try{
   if(data.generation!==generation||!detector||initializing)throw Error('Tracker is not ready.');
   const result=detector.detectForVideo(data.bitmap,data.stamp);
   self.postMessage({type:'result',generation,requestId:data.requestId,stamp:data.stamp,landmarks:result.landmarks,worldLandmarks:result.worldLandmarks,handedness:result.handedness,inferenceMS:performance.now()-start});
  }catch{self.postMessage({type:'frame-error',generation:data.generation,requestId:data.requestId,stamp:data.stamp})}
  finally{data.bitmap?.close()}
 }else if(data.type==='stop'){generation++;initializing=false;closeDetector();self.close()}
};
