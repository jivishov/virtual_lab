// Fit a closed outline to the image near a landmark-based estimate. All edge
// searches are local so a similarly colored wall or another hand cannot flood the mask.
const neighbors=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
const chains=[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];

function perimeter(mask,width,height) {
  const on=(x,y)=>x>=0&&y>=0&&x<width&&y<height&&mask[(y*width+x)*4+3]>=128;
  let first=0;
  while(first<width*height && !on(first%width,Math.floor(first/width)))first++;
  if(first===width*height)return [];
  const path=[];
  let x=first%width,y=Math.floor(first/width),back=4;
  do {
    path.push([x,y]);
    let dir=(back+1)%8;
    while(dir!==back && !on(x+neighbors[dir][0],y+neighbors[dir][1]))dir=(dir+1)%8;
    if(!on(x+neighbors[dir][0],y+neighbors[dir][1]))break;
    const step=neighbors[dir],prev=neighbors[(dir+7)%8];
    back=neighbors.findIndex(([dx,dy])=>dx===prev[0]-step[0]&&dy===prev[1]-step[1]);
    x+=step[0];y+=step[1];
  } while(y*width+x!==first && path.length<width*height);
  return path;
}

// In a narrow band around the estimate, compare the observed colors with samples
// inside and outside this particular hand. Ambiguous colors retain the estimate.
function refineMask(mask,rgba,n,span,center) {
  const boundary=perimeter(mask,n,n);
  if(!boundary.length)return boundary;
  const depth=new Uint8Array(n*n),queue=new Int32Array(n*n);
  let head=0,tail=0;
  for(const [x,y] of boundary){
    const i=y*n+x;if(!depth[i]){depth[i]=1;queue[tail++]=i;}
  }
  const radius=Math.max(2,Math.round(span*.24));
  while(head<tail){
    const i=queue[head++],d=depth[i]+1;
    if(d>radius*2+2)continue;
    for(const [dx,dy] of neighbors){
      const x=i%n+dx,y=Math.floor(i/n)+dy,j=y*n+x;
      if(x<0||x>=n||y<0||y>=n||depth[j])continue;
      depth[j]=d;queue[tail++]=j;
    }
  }
  const fg=new Uint16Array(4096),bg=new Uint16Array(4096);
  const bin=i=>(rgba[i*4]>>4)*256+(rgba[i*4+1]>>4)*16+(rgba[i*4+2]>>4);
  for(let i=0;i<depth.length;i++){
    if(!rgba[i*4+3])continue;
    const inside=mask[i*4+3]>=128;
    if(inside && (!depth[i]||depth[i]>Math.max(1,span*.06)))fg[bin(i)]++;
    if(!inside && depth[i]>radius)bg[bin(i)]++;
  }
  for(let i=0;i<depth.length;i++){
    if(!depth[i]||depth[i]>radius||!rgba[i*4+3])continue;
    const k=bin(i);
    if(fg[k]>=3 && bg[k]===0)mask[i*4+3]=255;
    if(bg[k]>=3 && fg[k]===0)mask[i*4+3]=0;
  }
  // Only keep skin connected to the palm. A nearby fingertip can be a separate object.
  const connected=new Uint8Array(mask.length);
  const seed=Math.round(center.y)*n+Math.round(center.x);
  if(mask[seed*4+3]<128)return boundary;
  head=0;tail=1;queue[0]=seed;connected[seed*4+3]=255;
  while(head<tail){
    const i=queue[head++];
    for(const [dx,dy] of neighbors){
      const x=i%n+dx,y=Math.floor(i/n)+dy,j=y*n+x;
      if(x<0||x>=n||y<0||y>=n||mask[j*4+3]<128||connected[j*4+3])continue;
      connected[j*4+3]=255;queue[tail++]=j;
    }
  }
  return perimeter(connected,n,n);
}

export function createHandOutliner() {
  const image=document.createElement('canvas'),mask=document.createElement('canvas');
  image.width=image.height=mask.width=mask.height=112;
  const n=image.width, pixels=image.getContext('2d',{willReadFrequently:true});
  const shape=mask.getContext('2d',{willReadFrequently:true});
  function outline(frame,landmarks) {
    const coords=landmarks.map(p=>({x:p.x*frame.width,y:p.y*frame.height}));
    const wrist=coords[0],side={x:coords[17].x-coords[5].x,y:coords[17].y-coords[5].y};
    const palm=Math.max(Math.hypot(side.x,side.y),.72*Math.hypot(wrist.x-coords[9].x,wrist.y-coords[9].y));
    if(palm<3)return [];
    const xs=coords.map(p=>p.x),ys=coords.map(p=>p.y),pad=palm*.5;
    const size=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys))+2*pad;
    const left=(Math.min(...xs)+Math.max(...xs)-size)/2,top=(Math.min(...ys)+Math.max(...ys)-size)/2;
    const k=n/size,p=coords.map(v=>({x:(v.x-left)*k,y:(v.y-top)*k})),span=palm*k;
    pixels.clearRect(0,0,n,n);
    pixels.drawImage(frame,left,top,size,size,0,0,n,n);
    shape.clearRect(0,0,n,n);shape.fillStyle=shape.strokeStyle='#fff';
    shape.lineJoin=shape.lineCap='round';
    shape.beginPath();
    shape.moveTo(p[0].x-side.x*k*.23,p[0].y-side.y*k*.23);
    for(const i of [1,2,5,9,13,17])shape.lineTo(p[i].x,p[i].y);
    shape.lineTo(p[0].x+side.x*k*.23,p[0].y+side.y*k*.23);
    shape.closePath();shape.lineWidth=span*.15;shape.fill();shape.stroke();
    for(const [finger,chain] of chains.entries()){
      for(let j=1;j<chain.length;j++){
        const a=p[chain[j-1]],b=p[chain[j]];
        shape.lineWidth=span*(finger===4?.18:finger===0?.25:.21)*(1-.1*(j-1));
        shape.beginPath();shape.moveTo(a.x,a.y);shape.lineTo(b.x,b.y);shape.stroke();
      }
    }
    const rgba=pixels.getImageData(0,0,n,n).data;
    const center={x:(p[0].x+p[9].x)/2,y:(p[0].y+p[9].y)/2};
    const loop=refineMask(shape.getImageData(0,0,n,n).data,rgba,n,span,center);
    if(loop.length<8)return [];
    const index=(x,y)=>4*(Math.min(n-1,Math.max(0,Math.round(y)))*n+Math.min(n-1,Math.max(0,Math.round(x))));
    const edge=[];
    for(let i=0;i<loop.length;i+=2){
      const [x,y]=loop[i],a=loop[(i+loop.length-3)%loop.length],b=loop[(i+3)%loop.length];
      const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=(b[1]-a[1])/len,ny=(a[0]-b[0])/len;
      const radius=Math.max(1,Math.round(span*.07));
      let best=28,offset=0;
      for(let d=-radius;d<=radius;d++){
        const lo=index(x+nx*(d-1),y+ny*(d-1)),hi=index(x+nx*(d+1),y+ny*(d+1));
        const contrast=Math.hypot(rgba[hi]-rgba[lo],rgba[hi+1]-rgba[lo+1],rgba[hi+2]-rgba[lo+2]);
        const score=contrast/(1+.3*Math.abs(d));
        if(score>best){best=score;offset=d;}
      }
      edge.push([(x+.5+nx*offset)/k+left,(y+.5+ny*offset)/k+top]);
    }
    return edge;
  }
  return function paint(output,frame,result) {
    if(output.width!==frame.width||output.height!==frame.height){output.width=frame.width;output.height=frame.height;}
    const ctx=output.getContext('2d');ctx.drawImage(frame,0,0);
    ctx.lineCap=ctx.lineJoin='round';
    for(const [i,points] of result.landmarks.entries()){
      if(points.length!==21)continue;
      const edge=outline(frame,points);if(!edge.length)continue;
      const last=edge[edge.length-1],first=edge[0];
      ctx.beginPath();ctx.moveTo((last[0]+first[0])/2,(last[1]+first[1])/2);
      for(let j=0;j<edge.length;j++){
        const a=edge[j],b=edge[(j+1)%edge.length];
        ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
      }
      ctx.closePath();ctx.lineWidth=4;ctx.strokeStyle='#153438';ctx.stroke();
      ctx.lineWidth=2;ctx.strokeStyle=result.handedness?.[i]?.[0]?.categoryName==='Left'?'#ffce78':'#8ff2d5';ctx.stroke();
    }
  };
}
