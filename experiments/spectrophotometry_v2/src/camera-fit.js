/* Fit transformed equipment corners without changing the scene or camera.
 * Projection and clip distances come from the renderer, including its portrait
 * distance multiplier. Insets are CSS pixels, just like picking coordinates.
 */
const DEFAULT_INSETS=Object.freeze({top:180,right:24,bottom:110,left:24});
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const scale=(a,value)=>a.map(component=>component*value);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>scale(a,1/Math.hypot(...a));
const finite=value=>typeof value==='number'&&Number.isFinite(value);

/**
 * Return {at,yaw,pitch,roll,distance,fov} for the supplied world-space corners.
 * Invalid geometry/options and impossible distance/clip constraints throw.
 */
export function fitCamera(points,options={}){
  const {width,height,yaw=0,pitch=.6,fov=42,minDistance=.05,maxDistance}=options;
  if(!Array.isArray(points)||!points.length||points.some(point=>!Array.isArray(point)||point.length!==3||!point.every(finite)))throw new RangeError('Camera bounds must contain finite three-dimensional points.');
  if(!finite(width)||!finite(height)||width<=0||height<=0)throw new RangeError('Camera viewport width and height must be positive finite pixels.');
  if(!finite(yaw)||!finite(pitch)||Math.abs(pitch)>=Math.PI/2-.0001||!finite(fov)||fov<=0||fov>=180)throw new RangeError('Camera yaw, pitch and field of view must define a finite, nonvertical perspective view.');
  if(!finite(minDistance)||minDistance<0||maxDistance!==undefined&&(!finite(maxDistance)||maxDistance<=0||maxDistance<minDistance))throw new RangeError('Camera distance limits must be finite, nonnegative and ordered.');
  if(options.insets!==undefined&&(!options.insets||typeof options.insets!=='object'||Array.isArray(options.insets)))throw new RangeError('Camera insets must be an object of nonnegative pixel values.');
  const insets={...DEFAULT_INSETS,...options.insets};
  if(Object.keys(DEFAULT_INSETS).some(side=>!finite(insets[side])||insets[side]<0)||insets.left+insets.right>=width||insets.top+insets.bottom>=height)throw new RangeError('Camera insets must leave a positive usable viewport.');
  const runtime=globalThis.E3D;
  if(!runtime?.cameraMatrices||!runtime?.M?.point||!runtime?.M?.inverse)throw new Error('Load the E3D renderer before fitting a camera.');
  const {cameraMatrices,M}=runtime;
  const low=[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]))),high=[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis])));
  const center=low.map((value,axis)=>value+(high[axis]-value)/2);
  const base={at:center,yaw,pitch,roll:0,distance:1,fov},reference=cameraMatrices(base,width,height);
  const away=unit(sub(reference.eye,center)),forward=scale(away,-1),right=unit(cross(forward,[0,1,0])),up=unit(cross(right,forward));
  const distanceScale=Math.hypot(...sub(reference.eye,center));
  const inverse=M.inverse(reference.vp);
  const near=dot(sub(M.point(inverse,[0,0,-1]),reference.eye),forward),far=dot(sub(M.point(inverse,[0,0,1]),reference.eye),forward),clipPad=Math.max(.001,far*.0001);
  if(![distanceScale,near,far,...center,...away,...right,...up].every(finite)||distanceScale<=0||near<=0||far<=near)throw new RangeError('Camera bounds are outside the renderer’s numeric range.');
  const local=points.map(point=>{const relative=sub(point,center);return {x:dot(relative,right),y:dot(relative,up),z:dot(relative,away)}});
  let lower=Math.max(minDistance,(Math.max(...local.map(point=>point.z))+near+clipPad)/distanceScale);
  let upper=Math.min(maxDistance??Infinity,(Math.min(...local.map(point=>point.z))+far-clipPad)/distanceScale);
  if(!finite(lower)||!finite(upper)||lower>upper)throw new RangeError('Camera bounds cannot fit within the requested distance limits and clip range.');
  const focalY=1/Math.tan(fov*Math.PI/360),focalX=focalY/(width/height);
  const targetX=(insets.left-insets.right)/width,targetY=(insets.bottom-insets.top)/height;
  const usableWidth=width-insets.left-insets.right,usableHeight=height-insets.top-insets.bottom;
  // Leave a subpixel guard against Float32 projection rounding at a viewport edge.
  const guard=Math.min(.5,usableWidth/8,usableHeight/8);

  function centeredOffset(axis,focal,target,depths){
    const candidates=local.map((point,index)=>point[axis]-target*depths[index]/focal);
    let lo=Math.min(...candidates),hi=Math.max(...candidates);
    for(let iteration=0;iteration<36;iteration++){
      const value=(lo+hi)/2,projected=local.map((point,index)=>(point[axis]-value)*focal/depths[index]);
      if((Math.min(...projected)+Math.max(...projected))/2>target)lo=value;else hi=value;
    }
    return (lo+hi)/2;
  }

  function trial(distance){
    const depths=local.map(point=>distance*distanceScale-point.z);
    const x=centeredOffset('x',focalX,targetX,depths),y=centeredOffset('y',focalY,targetY,depths);
    const camera={...base,at:add(center,add(scale(right,x),scale(up,y))),distance};
    const {vp}=cameraMatrices(camera,width,height),projected=points.map(point=>M.point(vp,point));
    const fits=projected.every(point=>{
      const px=(point[0]+1)*width/2,py=(1-point[1])*height/2;
      return point.every(finite)&&point[2]>=-1&&point[2]<=1&&px>=insets.left+guard&&px<=width-insets.right-guard&&py>=insets.top+guard&&py<=height-insets.bottom-guard;
    });
    return {camera,fits};
  }

  const closest=trial(lower);if(closest.fits)return closest.camera;
  let best=trial(upper);
  if(!best.fits)throw new RangeError('Camera bounds cannot fit within the requested distance limits and usable viewport.');
  for(let iteration=0;iteration<42;iteration++){
    const middle=lower+(upper-lower)/2,candidate=trial(middle);
    if(candidate.fits){upper=middle;best=candidate}else lower=middle;
  }
  return best.camera;
}
