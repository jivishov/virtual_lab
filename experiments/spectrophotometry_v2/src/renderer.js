/* Embedded rendering foundation adapted from the existing ELISA WebGL2 renderer, baseline b7c0a9d.
   v3: linear HDR target with MSAA, filmic tone mapping, bloom limited to emitters, procedural
   surface detail, ground occlusion, and a long-wave UV lamp that excites fluorescent materials.
   Physically based shading and approximate thin-shell transmission; not a fluid solver or a
   calibrated optical model. Without float render targets it falls back to the v2 LDR path. */
(function(global){'use strict';
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>{let l=Math.hypot(...a)||1;return a.map(v=>v/l)},lerp:(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t)};
const M={id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),mul:(a,b)=>{let o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o},trs:(p,r,s)=>{let[x,y,z]=r,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);return new Float32Array([(cy*cz)*s[0],(sx*sy*cz+cx*sz)*s[0],(-cx*sy*cz+sx*sz)*s[0],0,(-cy*sz)*s[1],(-sx*sy*sz+cx*cz)*s[1],(cx*sy*sz+sx*cz)*s[1],0,sy*s[2],-sx*cy*s[2],cx*cy*s[2],0,...p,1])},perspective:(f,a,n,fa)=>{let t=1/Math.tan(f/2);return new Float32Array([t/a,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0])},ortho:(l,r,b,t,n,f)=>new Float32Array([2/(r-l),0,0,0,0,2/(t-b),0,0,0,0,-2/(f-n),0,-(r+l)/(r-l),-(t+b)/(t-b),-(f+n)/(f-n),1]),look:(eye,at,up=[0,1,0])=>{let z=V.norm(V.sub(eye,at)),x=V.norm(V.cross(up,z)),y=V.cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-V.dot(x,eye),-V.dot(y,eye),-V.dot(z,eye),1])},point:(m,p)=>{let x=p[0],y=p[1],z=p[2],w=m[3]*x+m[7]*y+m[11]*z+m[15];return[(m[0]*x+m[4]*y+m[8]*z+m[12])/w,(m[1]*x+m[5]*y+m[9]*z+m[13])/w,(m[2]*x+m[6]*y+m[10]*z+m[14])/w]},inverse:a=>{let out=new Float32Array(16),aug=Array.from({length:4},(_,r)=>[...Array.from({length:4},(_,c)=>a[c*4+r]),...Array.from({length:4},(_,c)=>r===c?1:0)]);for(let c=0;c<4;c++){let p=c;for(let r=c+1;r<4;r++)if(Math.abs(aug[r][c])>Math.abs(aug[p][c]))p=r;[aug[p],aug[c]]=[aug[c],aug[p]];let d=aug[c][c];if(Math.abs(d)<1e-12)return M.id();for(let j=0;j<8;j++)aug[c][j]/=d;for(let r=0;r<4;r++)if(r!==c){d=aug[r][c];for(let j=0;j<8;j++)aug[r][j]-=d*aug[c][j]}}for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=aug[r][c+4];return out}};
class Node{constructor(){this.pos=[0,0,0];this.rot=[0,0,0];this.scale=[1,1,1];this.children=[];this.parent=null;this.visible=true;this.world=M.id()}add(n){n.parent=this;this.children.push(n);return n}set(x,y,z){this.pos=[x,y,z];return this}update(parent=M.id(),visible=true){this.world=M.mul(parent,M.trs(this.pos,this.rot,this.scale));this.shown=visible&&this.visible;for(let c of this.children)c.update(this.world,this.shown)}}
const G={tri:(out,a,b,c,na,nb,nc,ua=[0,0],ub=[1,0],uc=[1,1])=>out.push(...a,...na,...ua,...b,...nb,...ub,...c,...nc,...uc),box:(w,h,d)=>{let o=[],x=w/2,y=h/2,z=d/2;let faces=[[[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z],[1,0,0]],[[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z],[-1,0,0]],[[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z],[0,1,0]],[[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z],[0,-1,0]],[[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z],[0,0,1]],[[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z],[0,0,-1]]];for(let[a,b,c,d,n]of faces){G.tri(o,a,b,c,n,n,n,[0,0],[1,0],[1,1]);G.tri(o,a,c,d,n,n,n,[0,0],[1,1],[0,1])}return o},lathe:(profile,segments=48)=>{let o=[],faces=profile.slice(0,-1).map((p,j)=>V.norm([profile[j+1][1]-p[1],p[0]-profile[j+1][0],0]));for(let j=0;j<profile.length-1;j++){let[r0,y0]=profile[j],[r1,y1]=profile[j+1],f=faces[j];let smooth=(k,other)=>other&&V.dot(f,other)>.45?V.norm(V.add(f,other)):f;let lo=smooth(j,faces[j-1]),hi=smooth(j,faces[j+1]);for(let i=0;i<segments;i++){let t0=i/segments*Math.PI*2,t1=(i+1)/segments*Math.PI*2,pt=(r,y,t)=>[r*Math.cos(t),y,r*Math.sin(t)],nn=(n,t)=>[n[0]*Math.cos(t),n[1],n[0]*Math.sin(t)];let a=pt(r0,y0,t0),b=pt(r0,y0,t1),c=pt(r1,y1,t1),d=pt(r1,y1,t0),na=nn(lo,t0),nb=nn(lo,t1),nc=nn(hi,t1),nd=nn(hi,t0);G.tri(o,a,d,c,na,nd,nc,[i/segments,j/(profile.length-1)],[i/segments,(j+1)/(profile.length-1)],[(i+1)/segments,(j+1)/(profile.length-1)]);G.tri(o,a,c,b,na,nc,nb,[i/segments,j/(profile.length-1)],[(i+1)/segments,(j+1)/(profile.length-1)],[(i+1)/segments,j/(profile.length-1)])}}return o},bevelBox:(w,h,d,rad=.018)=>{let halves=[w/2,h/2,d/2],b=Math.min(rad,...halves.map(v=>v*.35)),out=[];for(let axis=0;axis<3;axis++)for(let sign of[-1,1]){let u=(axis+1)%3,v=(axis+2)%3,grid=k=>[-halves[k],-halves[k]+b,halves[k]-b,halves[k]],us=grid(u),vs=grid(v);let at=(i,j)=>{let p=[0,0,0];p[axis]=halves[axis]*sign;p[u]=us[i];p[v]=vs[j];let core=p.map((q,k)=>Math.min(halves[k]-b,Math.max(-halves[k]+b,q))),n=V.norm(V.sub(p,core));return{p:V.add(core,V.mul(n,b)),n,uv:[(p[u]+halves[u])/(2*halves[u]),(p[v]+halves[v])/(2*halves[v])]}};for(let i=0;i<3;i++)for(let j=0;j<3;j++){let a=at(i,j),bb=at(i+1,j),c=at(i+1,j+1),dd=at(i,j+1);if(sign<0)[bb,dd]=[dd,bb];G.tri(out,a.p,bb.p,c.p,a.n,bb.n,c.n,a.uv,bb.uv,c.uv);G.tri(out,a.p,c.p,dd.p,a.n,c.n,dd.n,a.uv,c.uv,dd.uv)}}return out},cylinder:(r,h,segments=48,rTop=r)=>G.lathe([[0,0],[r,0],[rTop,h],[0,h]],segments),sphere:(r,segments=40,rings=20)=>{let p=[];for(let i=0;i<=rings;i++){let a=-Math.PI/2+i/rings*Math.PI;p.push([Math.max(.00001,Math.cos(a)*r),Math.sin(a)*r])}return G.lathe(p,segments)},torus:(radius,tube,segments=48)=>{let p=[];for(let i=0;i<=12;i++){let a=-Math.PI/2+i/12*Math.PI*2;p.push([radius+Math.cos(a)*tube,Math.sin(a)*tube])}return G.lathe(p,segments)},plane:(w,h)=>{let o=[],n=[0,0,1],a=[-w/2,-h/2,0],b=[w/2,-h/2,0],c=[w/2,h/2,0],d=[-w/2,h/2,0];G.tri(o,a,b,c,n,n,n,[0,1],[1,1],[1,0]);G.tri(o,a,c,d,n,n,n,[0,1],[1,0],[0,0]);return o},merge:items=>{let out=[];for(let[geo,mat]of items){let im=M.inverse(mat);for(let i=0;i<geo.length;i+=8){let p=M.point(mat,geo.slice(i,i+3)),n=geo.slice(i+3,i+6),nn=V.norm([im[0]*n[0]+im[1]*n[1]+im[2]*n[2],im[4]*n[0]+im[5]*n[1]+im[6]*n[2],im[8]*n[0]+im[9]*n[1]+im[10]*n[2]]);out.push(...p,...nn,geo[i+6],geo[i+7])}}return out}};
// Shared by the renderer and the framing module so fitted views project identically.
function cameraMatrices(c,w,h){const aspect=w/h,cp=Math.cos(c.pitch),dist=c.distance*Math.max(1,1.10/aspect);const eye=V.add(c.at,[Math.sin(c.yaw)*cp*dist,Math.sin(c.pitch)*dist,Math.cos(c.yaw)*cp*dist]);const forward=V.norm(V.sub(c.at,eye)),right=V.norm(V.cross(forward,[0,1,0])),baseUp=V.norm(V.cross(right,forward)),roll=c.roll||0,up=V.norm(V.add(V.mul(baseUp,Math.cos(roll)),V.mul(right,Math.sin(roll))));const vp=M.mul(M.perspective(c.fov*Math.PI/180,aspect,.04,80),M.look(eye,c.at,up));return{eye,vp}}

const VS=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
uniform mat4 uModel,uVP,uLightVP;uniform mat3 uNormal;
out vec3 vPos,vNormal;out vec2 vUV;out vec4 vShadow;out float vLocalY;
void main(){vec4 p=uModel*vec4(aPosition,1.);vPos=p.xyz;vLocalY=aPosition.y;vNormal=normalize(uNormal*aNormal);vUV=aUV;vShadow=uLightVP*p;gl_Position=uVP*p;}`;
// Both the panorama and the reflection atlas store log-encoded linear radiance.
const ROOM_LIGHT = `
const float ROOM_PI=3.14159265359;
vec2 roomUV(vec3 d){
  return vec2(fract(atan(d.x,-d.z)/(2.*ROOM_PI)+.315),acos(clamp(d.y,-1.,1.))/ROOM_PI);
}
vec3 radiance(vec3 encoded){ return exp2(6.*encoded*encoded)-1.; }`;
const FS=hdr=>`#version 300 es
precision highp float;
${hdr?'#define HDR 1':''}
in vec3 vPos,vNormal;in vec2 vUV;in vec4 vShadow;in float vLocalY;
uniform vec2 uPipette; // liquid height in the shaft and relative dye concentration
uniform vec3 uColor,uCamera,uFluor;
uniform float uRough,uMetal,uGlass,uOpacity,uTexture,uPattern,uEmission,uThickness,uShadowSize,uExposure;
uniform sampler2D uMap,uShadow,uBackground,uReflections;uniform vec2 uResolution;
uniform vec3 uKeyDir,uKeyColor,uFillDir,uFillColor,uSky,uGround,uUVPos,uUVDir,uUVColor,uUVAxis;
uniform float uEnvScale,uUV;
out vec4 outColor;const float PI=3.14159265359;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.5+noise(p*2.07+13.1)*.3+noise(p*4.3+7.7)*.2;}
${ROOM_LIGHT}
vec3 reflectionLevel(vec2 uv,float level){
  float w=512.*exp2(-level),h=w*.5,top=512.-w;
  vec2 at=vec2(.5+uv.x*(w-1.),top+.5+uv.y*(h-1.));
  return radiance(texture(uReflections,at/512.).rgb);
}
vec3 env(vec3 ray,float rough){
  float level=clamp(rough*5.,0.,5.);
  vec2 uv=roomUV(ray);
  return 1.65*uEnvScale*mix(reflectionLevel(uv,floor(level)),reflectionLevel(uv,ceil(level)),fract(level));
}
float shadow(vec3 n,vec3 l){vec3 p=vShadow.xyz/vShadow.w*.5+.5;if(p.z>1.||p.x<0.||p.x>1.||p.y<0.||p.y>1.)return 1.;float s=0.;float bias=max(.0009*(1.-dot(n,l)),.0002);float t=1.5/uShadowSize;for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){vec2 o=vec2(x,y)+vec2(hash(gl_FragCoord.xy+vec2(x,y))-.5)*.8;s+=(p.z-bias<=texture(uShadow,p.xy+o*t).r?1.:.22);}return s/25.;}
// The lamp is a tube: light comes from the nearest point on its axis.
vec3 lampVector(){float hl=length(uUVAxis);vec3 an=uUVAxis/max(hl,1e-5);return uUVPos+an*clamp(dot(vPos-uUVPos,an),-hl,hl)-vPos;}
float lampIrradiance(vec3 dl){float d2=dot(dl,dl);float cone=smoothstep(.2,.78,dot(normalize(-dl),normalize(uUVDir)));return uUV*cone/(1.+d2*.12);}
vec3 fresnel(float c,vec3 f){return f+(1.-f)*pow(clamp(1.-c,0.,1.),5.);}
vec3 direct(vec3 n,vec3 v,vec3 l,vec3 color,vec3 base,float rough,float metal){vec3 h=normalize(v+l);float nv=max(dot(n,v),.001),nl=max(dot(n,l),0.),nh=max(dot(n,h),0.),vh=max(dot(v,h),0.);float a=rough*rough,aa=a*a,den=nh*nh*(aa-1.)+1.;float D=aa/(PI*den*den+.00001);float k=pow(rough+1.,2.)/8.;float gg=(nv/(nv*(1.-k)+k))*(nl/(nl*(1.-k)+k));vec3 f=fresnel(vh,mix(vec3(.04),base,metal));return ((1.-f)*(1.-metal)*base/PI+f*D*gg/(4.*nv*max(nl,.001)+.0001))*color*nl;}
vec3 tonemap(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec4 finish(vec3 c,float a){
#ifdef HDR
return vec4(c,a);
#else
return vec4(pow(tonemap(c*uExposure),vec3(1./2.2)),a);
#endif
}
void main(){vec3 n=normalize(vNormal);if(!gl_FrontFacing)n=-n;vec3 v=normalize(uCamera-vPos),r;vec4 tex=uTexture>.5?texture(uMap,vUV):vec4(1.);if(tex.a<.02)discard;
  if(uPattern==4.){float rr=length((vUV-.5)*2.);float a=exp(-rr*rr*4.)*(1.-smoothstep(.65,1.,rr))*uOpacity;outColor=vec4(0.,0.,0.,a*(1.-uUV*.35));return;}
  if(uPattern==5.){outColor=finish(uColor*pow(tex.rgb,vec3(2.2))*uEmission,uOpacity*tex.a);return;}
  if(uPattern==9.){float rr=length((vUV-.5)*2.);float a=exp(-rr*rr*3.2)*(1.-smoothstep(.72,1.,rr));outColor=vec4(uColor*uEmission*a*lampIrradiance(lampVector()),1.);return;}
  vec3 base=uColor*pow(tex.rgb,vec3(2.2));float rough=max(.06,uRough);float alpha=uOpacity*tex.a;
  if(uPattern==1.){vec2 uv=vPos.xz;
    float grain=fbm(uv*5.0),fleck=noise(uv*128.);
    float detail=1.-smoothstep(.004,.022,max(fwidth(uv.x),fwidth(uv.y)));
    base*=.935+.098*grain+detail*.045*smoothstep(.68,.93,fleck);
    rough=clamp(rough+.06*(grain-.5),.40,.85);
    n=normalize(n+detail*.012*vec3(fleck-.5,0.,noise(uv*125.+7.)-.5));}
  if(uPattern==2.){float f=noise(vUV*vec2(520.,190.))*.6+noise(vUV*vec2(110.,330.))*.4;base*=.955+.075*f;rough=clamp(rough+(f-.5)*.1,.3,1.);}
  if(uPattern==3.){float c=fbm(vUV*vec2(90.,55.));vec2 d=vec2(noise(vUV*vec2(140.,85.))-.5,noise(vUV*vec2(140.,85.)+5.)-.5);n=normalize(n+vec3(d.x,0.,d.y)*.05);base*=.965+.05*c;rough=clamp(rough+(c-.5)*.12,.1,.8);}
  if(uPattern==7.){float s=noise(vec2(vUV.x*380.,vUV.y*6.));base*=.9+.14*s;rough=clamp(rough*(.75+.5*s),.08,1.);}
  if(uPattern==8.){
    float grain=fbm(vec2(vPos.x*3.,vPos.y*72.+vPos.z*58.)+noise(vPos.xy*3.)*.75);
    base*=.68+.59*grain;rough=clamp(rough+(grain-.5)*.16,.20,.85);
  }
  if(uPattern==10.){
    float stipple=noise((vPos.xy+vPos.yz*.81)*142.);
    base*=.96+.07*stipple;rough=clamp(rough+(stipple-.5)*.13,.18,.86);
  }
  r=reflect(-v,n);float nv=clamp(dot(n,v),0.,1.); // >1 by rounding would make pow() NaN and bloom spreads it
  vec3 L=normalize(uKeyDir);
  // Ground occlusion darkens the lower sides of objects standing on the bench.
  float occl=(uPattern==1.||uPattern==6.)?1.:mix(1.,mix(.55,1.,smoothstep(0.,.34,vPos.y)),1.-abs(n.y));
  vec3 f=fresnel(nv,mix(vec3(.04),base,uMetal));
  vec3 c=base*mix(uGround,uSky,n.y*.5+.5)*(1.-uMetal*.7)*occl
    +direct(n,v,L,uKeyColor,base,rough,uMetal)*shadow(n,L)*mix(1.16,.81,smoothstep(-6.,6.,vPos.x+.12*vPos.z))
    +direct(n,v,normalize(uFillDir),uFillColor,base,rough,uMetal)*occl
    +env(r,rough)*f*(1.-rough*.6)*occl;
  // Long-wave UV lamp: a little visible violet light plus excitation of fluorescent materials.
  vec3 dl=lampVector();vec3 ul=normalize(dl);float irr=lampIrradiance(dl);
  c+=direct(n,v,ul,uUVColor*irr,base,rough,uMetal);
  c+=uFluor*irr*(.35+.65*max(dot(n,ul),0.));
  c+=base*uEmission;
  float edge=pow(1.-nv,2.15);c=mix(c,c*.6,edge*.35);
  if(uPattern==11.){
    vec2 uv=clamp(gl_FragCoord.xy/uResolution,vec2(.001),vec2(.999));
    vec3 behind=texture(uBackground,uv).rgb;
    float path=uThickness*mix(.30,1.,nv);
    vec3 absorb=exp(-path*(vec3(.018,.008,.004)+uPipette.y*vec3(1.55,.59,.036)));
    float surface=.022+.62*pow(1.-nv,5.);
#ifdef HDR
    vec3 column=mix(behind*absorb,env(r,.09),surface);
#else
    vec3 column=mix(behind*pow(absorb,vec3(1./2.2)),finish(env(r,.09),1.).rgb,surface);
#endif
    outColor=vec4(column,uOpacity);return;
  }
  if(uGlass>.5){vec2 uv=gl_FragCoord.xy/uResolution;vec2 offset=vec2(dot(n,normalize(cross(v,vec3(0.,1.,0.)))),n.y)*.032*uThickness;vec3 bg=texture(uBackground,clamp(uv+offset,vec2(.002),vec2(.998))).rgb;float F=.04+.96*pow(1.-nv,5.);float reflectance=clamp(.028+.10*uOpacity+F*.93,.055,.97);
#ifdef HDR
    vec3 reflection=env(r,rough)*1.05+direct(n,v,L,uKeyColor,vec3(1.),rough,0.)*.15+uUVColor*irr*.25;vec3 tint=mix(vec3(1.),max(uColor,vec3(.001)),uOpacity);
    vec3 result=mix(bg*tint,reflection,reflectance);result=mix(result,result*.55,edge*.42);
#else
    vec3 reflection=pow(tonemap(env(r,rough)*1.05),vec3(1./2.2));vec3 tint=mix(vec3(1.),pow(max(uColor,vec3(.001)),vec3(1./2.2)),uOpacity);
    vec3 result=mix(bg*tint,reflection,reflectance);result=mix(result,vec3(.43,.55,.58)*uEnvScale,edge*.40);
#endif
    if(uGlass>1.5){
      result=mix(result,vec3(.81,.91,.93),.41);
      // The narrow bore magnifies its contents. Shade them at the shaft surface
      // so refraction cannot sample past a two-pixel-wide column in a bench view.
      if(uPipette.x>0.){
        float facing=clamp(abs(dot(n.xz,v.xz))/max(length(n.xz)*length(v.xz),.0001),0.,1.);
        float bore=smoothstep(.30,.66,facing);
        float top=uPipette.x+.028*(1.-facing);
        float dy=vLocalY-top, pixel=clamp(fwidth(vLocalY),.002,.035);
        float filled=1.-smoothstep(-pixel*.5,pixel*.5,dy);
        vec3 water=mix(result*vec3(.69,.88,.91),finish(vec3(.30,.50,.52),1.).rgb,.42);
        vec3 blue=finish(mix(vec3(.035,.26,.50),vec3(.008,.043,.35),uPipette.y),1.).rgb;
        vec3 liquid=mix(water,blue,sqrt(uPipette.y));
        result=mix(result,liquid,filled*bore);
        float rim=max(.004,pixel*.70);
        float dark=1.-smoothstep(.25,1.35,abs(dy+rim*.40)/rim);
        float glint=1.-smoothstep(.15,1.25,abs(dy-rim)/rim);
        result=mix(result,vec3(.020,.054,.070),dark*bore*.94);
        result=mix(result,vec3(.87,.96,.97),glint*bore*.90);
      }
      result=mix(result,vec3(.055,.12,.15),.74*smoothstep(.48,.93,1.-nv));
    }
    outColor=vec4(result,tex.a);
    return;}
  outColor=finish(c,alpha);}`;
const SHADOWVS=`#version 300 es
layout(location=0) in vec3 aPosition;uniform mat4 uModel,uLightVP;void main(){gl_Position=uLightVP*uModel*vec4(aPosition,1.);}`;
const SHADOWFS=`#version 300 es
precision highp float;void main(){}`;
const QUADVS=`#version 300 es
layout(location=0) in vec2 aPos;out vec2 vUV;void main(){vUV=aPos*.5+.5;gl_Position=vec4(aPos,0.,1.);}`;
const ROOM_FS=`#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColor;
uniform sampler2D uRoom,uVideo;
uniform mat4 uInverse;
uniform vec3 uEye;
uniform vec4 uVideoRect;
uniform float uLive,uMirror,uHDR,uExposure;
${ROOM_LIGHT}
void main(){
  vec2 uv=(vec2(vUV.x,1.-vUV.y)-uVideoRect.xy)/uVideoRect.zw;
  vec2 edge=min(uv,1.-uv);
  float live=uLive*smoothstep(0.,.016,min(edge.x,edge.y));
  vec3 color=vec3(0.);
  if(live<1.){
    vec4 farPoint=uInverse*vec4(vUV*2.-1.,1.,1.);
    vec3 ray=normalize(farPoint.xyz/farPoint.w-uEye);
    vec3 start=uEye-vec3(0.,3.1,0.);
    float b=dot(start,ray);
    float t=-b+sqrt(max(0.,b*b-dot(start,start)+36.*36.));
    vec3 dir=normalize(start+max(t,1.)*ray);
    color=texture(uRoom,roomUV(dir)).rgb;
  }
  if(live>0.){
    if(uMirror>.5)uv.x=1.-uv.x;
    color=mix(color,texture(uVideo,uv).rgb,live);
  }
  if(uHDR<.5){outColor=vec4(color,1.);return;}
  // Invert the composite curve so both backgrounds retain their exposure.
  vec3 y=pow(color,vec3(2.2)),a=2.51-2.43*y,b=.03-.59*y;
  vec3 c=max(vec3(0.),(-b+sqrt(b*b+.56*a*y))/(2.*a))/uExposure;
  outColor=vec4(c,1.);
}`;
const POST={
  prefilter:`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uSrc;uniform vec2 uTexel;uniform float uThreshold,uKnee;out vec4 o;
vec3 t(vec2 d){return texture(uSrc,vUV+d*uTexel).rgb;}
void main(){vec3 c=(t(vec2(-1,-1))+t(vec2(1,-1))+t(vec2(-1,1))+t(vec2(1,1)))*.25;if(any(isnan(c))||any(isinf(c)))c=vec3(0.);c=clamp(c,0.,64.);float br=max(c.r,max(c.g,c.b));float soft=clamp(br-uThreshold+uKnee,0.,2.*uKnee);soft=soft*soft/(4.*uKnee+1e-5);o=vec4(c*max(soft,br-uThreshold)/max(br,1e-5),1.);}`,
  down:`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uSrc;uniform vec2 uTexel;out vec4 o;
vec3 t(vec2 d){return texture(uSrc,vUV+d*uTexel).rgb;}
void main(){o=vec4((t(vec2(-1,-1))+t(vec2(1,-1))+t(vec2(-1,1))+t(vec2(1,1)))*.25,1.);}`,
  up:`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uSrc;uniform vec2 uTexel;out vec4 o;
vec3 t(vec2 d){return texture(uSrc,vUV+d*uTexel).rgb;}
void main(){vec3 s=t(vec2(-1,-1))+t(vec2(1,-1))+t(vec2(-1,1))+t(vec2(1,1))+2.*(t(vec2(0,-1))+t(vec2(0,1))+t(vec2(-1,0))+t(vec2(1,0)))+4.*t(vec2(0));o=vec4(s/16.,1.);}`,
  composite:`#version 300 es
precision highp float;in vec2 vUV;uniform sampler2D uScene,uBloom;uniform float uBloomStrength,uExposure,uUseBloom;out vec4 o;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec3 c=texture(uScene,vUV).rgb;if(uUseBloom>.5)c+=texture(uBloom,vUV).rgb*uBloomStrength;if(any(isnan(c))||any(isinf(c)))c=vec3(0.);c=clamp(c,0.,64.);c=aces(c*uExposure);
c=pow(c,vec3(1./2.2));o=vec4(c,1.);}`
};
const QUALITY={high:{dpr:2,scale:1.5,maxPixels:8000000,samples:4,shadow:2048,bloom:false,hdr:true},balanced:{dpr:1.5,scale:1.25,maxPixels:5000000,samples:4,shadow:1536,bloom:false,hdr:true},low:{dpr:1,scale:1,maxPixels:2500000,samples:0,shadow:1024,bloom:false,hdr:false}};
const UNIFORMS=['uReflections','uModel','uVP','uLightVP','uNormal','uPipette','uColor','uCamera','uFluor','uRough','uMetal','uGlass','uOpacity','uTexture','uPattern','uEmission','uThickness','uShadowSize','uExposure','uMap','uShadow','uBackground','uResolution','uKeyDir','uKeyColor','uFillDir','uFillColor','uSky','uGround','uUVPos','uUVDir','uUVColor','uUVAxis','uEnvScale','uUV'];
function rgb(hex){if(Array.isArray(hex))return hex;let h=hex.replace('#','');return[0,2,4].map(i=>Math.pow(parseInt(h.slice(i,i+2),16)/255,2.2))}
class Renderer{
constructor(canvas,level='balanced'){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!this.gl)throw Error('WebGL 2 could not start. Open the studio in a WebGL 2 browser with hardware acceleration enabled.');const gl=this.gl;
  this.root=new Node();this.meshes=[];this.cam={at:[0,.35,.65],yaw:0,pitch:.72,roll:0,distance:11.2,fov:42};this.dirtyShadow=true;
  this.floatTargets=!!gl.getExtension('EXT_color_buffer_float');
  // Lighting state; scene.js moves uv between 0 (daylight) and 1 (dimmed room, lamp on).
  this.light={uv:0,uvPos:[3.25,1.8,-4.2],uvDir:[0,-1,0],uvAxis:[.93,0,0],exposure:1.0,bloom:.9};
  this.programs={};this.shadowProgram=this.programOf(SHADOWVS,SHADOWFS);this.su={model:gl.getUniformLocation(this.shadowProgram,'uModel'),vp:gl.getUniformLocation(this.shadowProgram,'uLightVP')};
  this.post={};for(const[k,src]of Object.entries(POST)){const p=this.programOf(QUADVS,src);this.post[k]={p,u:Object.fromEntries(['uSrc','uTexel','uThreshold','uKnee','uScene','uBloom','uBloomStrength','uExposure','uUseBloom'].map(n=>[n,gl.getUniformLocation(p,n)]))}}
  this.quad=gl.createVertexArray();gl.bindVertexArray(this.quad);const qb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,qb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.bindVertexArray(null);
  this.lightVP=M.mul(M.ortho(-10.5,10.5,-8.5,8.5,.1,45),M.look([-12,18,7],[0,0,-.5])); // matches uKeyDir
  this.bg=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.bg);this.textureParams();this.white=this.texture(document.createElement('canvas'));gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
  this.roomProgram=this.programOf(QUADVS,ROOM_FS);
  this.roomUniforms=Object.fromEntries(['uRoom','uVideo','uInverse','uEye','uVideoRect','uLive','uMirror','uHDR','uExposure'].map(k=>[k,gl.getUniformLocation(this.roomProgram,k)]));
  this.cameraTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.cameraTexture);this.textureParams();
  this.setQuality(level);
}
async loadRoom(){
  const load=async name=>{
    const image=new Image();image.src=new URL('assets/'+name,document.baseURI).href;await image.decode();
    return this.texture(image);
  };
  [this.roomTexture,this.reflections]=await Promise.all([load('clean-lab.webp'),load('room-reflections.webp')]);
}
drawRoom(){
  if(!this.roomTexture)return;
  const gl=this.gl,u=this.roomUniforms,video=this.roomVideo,live=video?.readyState>=2;
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.depthMask(false);gl.useProgram(this.roomProgram);
  gl.uniformMatrix4fv(u.uInverse,false,this.invVP);gl.uniform3fv(u.uEye,this.eye);
  gl.uniform1f(u.uHDR,this.hdr?1:0);gl.uniform1f(u.uExposure,this.light.exposure);
  gl.uniform1f(u.uLive,live?1:0);gl.uniform1f(u.uMirror,this.mirrored?1:0);
  const rect=this.roomVideoRect;
  gl.uniform4f(u.uVideoRect,rect?.left??0,rect?.top??0,rect?.width??1,rect?.height??1);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.roomTexture);gl.uniform1i(u.uRoom,0);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,live?this.cameraTexture:this.white);gl.uniform1i(u.uVideo,1);
  if(live){
    if(this.videoTime!==video.currentTime){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,video);this.videoTime=video.currentTime;}
  }
  gl.bindVertexArray(this.quad);gl.drawArrays(gl.TRIANGLES,0,3);gl.depthMask(true);gl.enable(gl.DEPTH_TEST);
}
setQuality(level){
  const q=QUALITY[level]||QUALITY.balanced;this.level=QUALITY[level]?level:'balanced';this.quality=q.dpr;this.renderScale=q.scale;this.maxPixels=q.maxPixels;this.bloomOn=q.bloom;
  this.hdr=q.hdr&&this.floatTargets;
  if(this.hdr){const gl=this.gl,s=gl.getInternalformatParameter(gl.RENDERBUFFER,gl.RGBA16F,gl.SAMPLES);this.samples=q.samples&&s&&s.length?Math.min(q.samples,Math.max(...s)):0;}else this.samples=0;
  const key=this.hdr?'hdr':'ldr';if(!this.programs[key]){const p=this.programOf(VS,FS(this.hdr));this.programs[key]={p,u:Object.fromEntries(UNIFORMS.map(k=>[k,this.gl.getUniformLocation(p,k)]))}}
  this.program=this.programs[key].p;this.u=this.programs[key].u;
  if(this.shadowSize!==q.shadow){this.shadowSize=q.shadow;this.initShadow();}
  this.freeTargets();this.dirtyShadow=true;this.resize();
}
programOf(vs,fs){let gl=this.gl;let sh=(type,s)=>{let a=gl.createShader(type);gl.shaderSource(a,s);gl.compileShader(a);if(!gl.getShaderParameter(a,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(a));return a};let p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p}
textureParams(filter){let g=this.gl;filter??=g.LINEAR;g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,filter);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE)}
texture(canvas,old){let gl=this.gl,t=old||gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);this.textureParams();gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);const aniso=gl.getExtension('EXT_texture_filter_anisotropic');if(aniso)gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));return t}
initShadow(){let g=this.gl;if(this.shadow)g.deleteTexture(this.shadow);if(this.sf)g.deleteFramebuffer(this.sf);this.shadow=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.shadow);g.texImage2D(g.TEXTURE_2D,0,g.DEPTH_COMPONENT24,this.shadowSize,this.shadowSize,0,g.DEPTH_COMPONENT,g.UNSIGNED_INT,null);this.textureParams(g.NEAREST);this.sf=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,this.sf);g.framebufferTexture2D(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.TEXTURE_2D,this.shadow,0);g.drawBuffers([g.NONE]);g.readBuffer(g.NONE);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Shadow framebuffer unavailable');g.bindFramebuffer(g.FRAMEBUFFER,null)}
colorTexture(w,h){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texImage2D(g.TEXTURE_2D,0,g.RGBA16F,w,h,0,g.RGBA,g.HALF_FLOAT,null);this.textureParams();const fb=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,fb);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t,0);return{t,fb,w,h}}
freeTargets(){const g=this.gl,t=this.targets;if(!t)return;for(const x of[t.scene,t.bgT,...t.mips])if(x){g.deleteTexture(x.t);g.deleteFramebuffer(x.fb)}for(const rb of[t.msColor,t.msDepth,t.depth])if(rb)g.deleteRenderbuffer(rb);if(t.ms)g.deleteFramebuffer(t.ms);this.targets=null}
initTargets(w,h){
  const g=this.gl;this.freeTargets();const t={w,h,mips:[]};
  t.scene=this.colorTexture(w,h);t.depth=g.createRenderbuffer();g.bindRenderbuffer(g.RENDERBUFFER,t.depth);g.renderbufferStorage(g.RENDERBUFFER,g.DEPTH_COMPONENT24,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,t.depth);
  t.bgT=this.colorTexture(w,h);
  if(this.samples){t.ms=g.createFramebuffer();g.bindFramebuffer(g.FRAMEBUFFER,t.ms);t.msColor=g.createRenderbuffer();g.bindRenderbuffer(g.RENDERBUFFER,t.msColor);g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,g.RGBA16F,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.RENDERBUFFER,t.msColor);t.msDepth=g.createRenderbuffer();g.bindRenderbuffer(g.RENDERBUFFER,t.msDepth);g.renderbufferStorageMultisample(g.RENDERBUFFER,this.samples,g.DEPTH_COMPONENT24,w,h);g.framebufferRenderbuffer(g.FRAMEBUFFER,g.DEPTH_ATTACHMENT,g.RENDERBUFFER,t.msDepth);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE){this.samples=0;return this.initTargets(w,h)}}
  let mw=w,mh=h;for(let i=0;i<6&&mw>8&&mh>8;i++){mw=Math.max(1,mw>>1);mh=Math.max(1,mh>>1);t.mips.push(this.colorTexture(mw,mh))}
  g.bindFramebuffer(g.FRAMEBUFFER,null);this.targets=t;
}
updateGeometry(node,geometry){const gl=this.gl;node.geo=geometry;node.count=geometry.length/8;gl.bindBuffer(gl.ARRAY_BUFFER,node.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry),gl.DYNAMIC_DRAW);}
material(color='#ffffff',opts={}){const m={color:rgb(color),rough:.38,metal:0,glass:0,opacity:1,pattern:0,emission:0,thickness:1,fluor:[0,0,0],...opts};if(typeof m.fluor==='string')m.fluor=rgb(m.fluor);return m}
mesh(geometry,material,parent=this.root,indices=null){let n=new Node(),gl=this.gl;n.mat=material;n.count=geometry.length/8;n.geo=geometry;n.vao=gl.createVertexArray();gl.bindVertexArray(n.vao);let b=gl.createBuffer();n.buffer=b;gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry),gl.STATIC_DRAW);for(let[loc,size,off]of[[0,3,0],[1,3,3],[2,2,6]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,off*4)}if(indices){n.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,n.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);n.count=indices.length;}gl.bindVertexArray(null);parent.add(n);this.meshes.push(n);return n}
disposeMeshes(){const gl=this.gl,textures=new Set();for(const n of this.meshes){gl.deleteBuffer(n.buffer);if(n.indexBuffer)gl.deleteBuffer(n.indexBuffer);gl.deleteVertexArray(n.vao);if(n.mat.map)textures.add(n.mat.map)}for(const t of textures)gl.deleteTexture(t);this.meshes=[];this.root=new Node()}
group(parent=this.root){return parent.add(new Node())}
resize(){let rect=this.canvas.getBoundingClientRect(),d=Math.min(Math.max(devicePixelRatio||1,this.renderScale||1),this.quality,Math.sqrt((this.maxPixels||8000000)/(rect.width*rect.height))),w=Math.max(1,Math.floor(rect.width*d)),h=Math.max(1,Math.floor(rect.height*d));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h}let gl=this.gl;if(this.bgW!==w||this.bgH!==h){gl.bindTexture(gl.TEXTURE_2D,this.bg);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,w,h,0,gl.RGB,gl.UNSIGNED_BYTE,null);this.bgW=w;this.bgH=h} /* RGB: the canvas has no alpha channel to copy */if(this.hdr&&(!this.targets||this.targets.w!==w||this.targets.h!==h))this.initTargets(w,h);this.updateCamera()}
updateCamera(){const r=this.canvas;const m=cameraMatrices(this.cam,r.width,r.height);this.eye=m.eye;this.vp=m.vp;this.invVP=M.inverse(this.vp)}
project(pos){let p=M.point(this.vp,pos),r=this.canvas.getBoundingClientRect();return{x:(p[0]+1)*.5*r.width,y:(1-p[1])*.5*r.height,z:p[2]}}
unproject(x,y,depth){const r=this.canvas.getBoundingClientRect();return M.point(this.invVP,[x/r.width*2-1,1-y/r.height*2,depth])}
ray(x,y){const a=this.unproject(x,y,-1),b=this.unproject(x,y,1);return{origin:a,dir:V.norm(V.sub(b,a))}}
onPlane(x,y,height=0){let r=this.ray(x,y);if(Math.abs(r.dir[1])<.001)return null;let t=(height-r.origin[1])/r.dir[1];return t>0?V.add(r.origin,V.mul(r.dir,t)):null}
lighting(){
  // Daylight fades to a dim room while the UV lamp is on; the lamp itself is modeled separately.
  const uv=this.light.uv,day=1-.95*uv,k=a=>a.map(v=>v*day);const g=this.gl,u=this.u;
  g.uniform3fv(u.uKeyDir,[-6,9,3.5]);g.uniform3fv(u.uKeyColor,k([2.90,2.73,2.49]));g.uniform3fv(u.uFillDir,[6,4,-2]);g.uniform3fv(u.uFillColor,k([.55,.66,.82]));
  g.uniform3fv(u.uSky,k([.31,.35,.40]));g.uniform3fv(u.uGround,k([.11,.10,.09]));g.uniform1f(u.uEnvScale,.05+.95*day);
  g.uniform1f(u.uUV,uv);g.uniform3fv(u.uUVPos,this.light.uvPos);g.uniform3fv(u.uUVDir,this.light.uvDir);g.uniform3fv(u.uUVAxis,this.light.uvAxis);g.uniform3fv(u.uUVColor,[.1,.045,.32]); // long-wave lamps emit little visible light; most of the glow is fluorescence
  g.uniform1f(u.uExposure,this.light.exposure);g.uniform1f(u.uShadowSize,this.shadowSize);
}
drawGeometry(n){const gl=this.gl;gl.bindVertexArray(n.vao);if(n.indexBuffer)gl.drawElements(gl.TRIANGLES,n.count,gl.UNSIGNED_INT,0);else gl.drawArrays(gl.TRIANGLES,0,n.count);}
drawMesh(n,shadow=false,opacity=n.mat.opacity){let g=this.gl;if(!n.shown)return;if(shadow){if(n.mat.glass||n.mat.opacity<.99||n.noShadow)return;g.uniformMatrix4fv(this.su.model,false,n.world);this.drawGeometry(n);return}let m=n.mat,u=this.u,inv=M.inverse(n.world);g.uniformMatrix4fv(u.uModel,false,n.world);g.uniformMatrix3fv(u.uNormal,false,new Float32Array([inv[0],inv[4],inv[8],inv[1],inv[5],inv[9],inv[2],inv[6],inv[10]]));g.uniform3fv(u.uColor,m.color);g.uniform3fv(u.uFluor,m.fluor);g.uniform1f(u.uRough,m.rough);g.uniform1f(u.uMetal,m.metal);g.uniform1f(u.uGlass,m.glass);if(m.glass===2||m.pattern===11)g.uniform2f(u.uPipette,m.level||0,m.dye||0);g.uniform1f(u.uOpacity,opacity);g.uniform1f(u.uPattern,m.pattern);g.uniform1f(u.uEmission,m.emission);g.uniform1f(u.uThickness,m.thickness);g.uniform1f(u.uTexture,m.map?1:0);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,m.map||this.white);if(n.additive)g.blendFunc(g.ONE,g.ONE);this.drawGeometry(n);if(n.additive)g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA)}
quadPass(name,src,dst,setup){const g=this.gl,pp=this.post[name];g.bindFramebuffer(g.FRAMEBUFFER,dst?dst.fb:null);g.viewport(0,0,dst?dst.w:this.canvas.width,dst?dst.h:this.canvas.height);g.useProgram(pp.p);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,src.t);g.uniform1i(pp.u.uSrc,0);g.uniform2f(pp.u.uTexel,1/src.w,1/src.h);setup?.(pp.u);g.bindVertexArray(this.quad);g.drawArrays(g.TRIANGLES,0,3)}
render(){let g=this.gl;this.root.update();this.resize();g.enable(g.DEPTH_TEST);
  if(this.dirtyShadow){g.bindFramebuffer(g.FRAMEBUFFER,this.sf);g.viewport(0,0,this.shadowSize,this.shadowSize);g.clear(g.DEPTH_BUFFER_BIT);g.useProgram(this.shadowProgram);g.uniformMatrix4fv(this.su.vp,false,this.lightVP);g.enable(g.POLYGON_OFFSET_FILL);g.polygonOffset(2,2);for(let n of this.meshes)this.drawMesh(n,true);g.disable(g.POLYGON_OFFSET_FILL);this.dirtyShadow=false}
  const t=this.hdr?this.targets:null,target=t?(t.ms||t.scene.fb):null,w=this.canvas.width,h=this.canvas.height;
  const blit=(from,to)=>{g.bindFramebuffer(g.READ_FRAMEBUFFER,from);g.bindFramebuffer(g.DRAW_FRAMEBUFFER,to);g.blitFramebuffer(0,0,w,h,0,0,w,h,g.COLOR_BUFFER_BIT,g.NEAREST);g.bindFramebuffer(g.FRAMEBUFFER,target)};
  g.bindFramebuffer(g.FRAMEBUFFER,target);g.viewport(0,0,w,h);const dim=1-.95*this.light.uv;g.clearColor(.78*dim,.82*dim,.81*dim,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);this.drawRoom();g.useProgram(this.program);let u=this.u;
  g.uniformMatrix4fv(u.uVP,false,this.vp);g.uniformMatrix4fv(u.uLightVP,false,this.lightVP);g.uniform3fv(u.uCamera,this.eye);g.uniform2f(u.uResolution,w,h);g.uniform1i(u.uMap,0);g.uniform1i(u.uShadow,1);g.uniform1i(u.uBackground,2);g.activeTexture(g.TEXTURE3);g.bindTexture(g.TEXTURE_2D,this.reflections||this.white);g.uniform1i(u.uReflections,3);this.lighting();
  g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,this.shadow);g.disable(g.BLEND);g.depthMask(true);
  for(let n of this.meshes)if(!n.decal&&!n.mat.glass&&n.mat.opacity>=.99)this.drawMesh(n);
  g.enable(g.BLEND);g.blendFuncSeparate(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA,g.ONE,g.ONE_MINUS_SRC_ALPHA);g.depthMask(false);
  const glass=this.meshes.filter(n=>n.mat.glass&&n.shown).sort((a,b)=>this.distance(b)-this.distance(a));
  const translucent=this.meshes.filter(n=>!n.decal&&!n.mat.glass&&n.mat.opacity<.99&&n.shown).sort((a,b)=>this.distance(b)-this.distance(a));
  const surrounding=this.surroundingLiquid;
  // Split the active liquid at the tool. Keep the combined transmittance of
  // the closed liquid mesh, with a lighter foreground tint over the narrow shaft.
  const frontOpacity=surrounding ? surrounding.mat.opacity*.40 : 0;
  const captureTransmission=()=>{
    g.activeTexture(g.TEXTURE2);
    if(t){blit(target,t.bgT.fb);g.bindTexture(g.TEXTURE_2D,t.bgT.t)}
    else{g.bindTexture(g.TEXTURE_2D,this.bg);g.copyTexSubImage2D(g.TEXTURE_2D,0,0,0,0,0,w,h)}
  };
  captureTransmission();
  for(const n of translucent){
    if(n!==surrounding){this.drawMesh(n);continue}
    const transmittance=(1-n.mat.opacity)**2;
    g.enable(g.CULL_FACE);g.cullFace(g.FRONT);
    this.drawMesh(n,false,1-transmittance/(1-frontOpacity));
    g.disable(g.CULL_FACE);
  }
  // Each enclosing layer needs the image of the layers inside it. One snapshot
  // for all glass would let the vessel replace the submerged shaft with bare liquid.
  captureTransmission();
  g.depthMask(true);
  if(this.insertedPipette){
    for(const n of glass)if(n.pipetteId===this.insertedPipette)this.drawMesh(n);
    // Depth rejects liquid behind the pipette. Its front surface still tints the tip.
    g.depthMask(false);
    if(surrounding?.shown){
      captureTransmission();
      g.enable(g.CULL_FACE);g.cullFace(g.BACK);
      this.drawMesh(surrounding,false,frontOpacity);
      g.disable(g.CULL_FACE);
    }
    captureTransmission();
    g.depthMask(true);
  }
  for(const n of glass)if(!this.insertedPipette||n.pipetteId!==this.insertedPipette)this.drawMesh(n);
  g.depthMask(false);
  for(let n of this.meshes.filter(n=>n.decal&&n.shown).sort((a,b)=>this.distance(b)-this.distance(a)))this.drawMesh(n);
  g.depthMask(true);g.disable(g.BLEND);g.bindVertexArray(null);
  if(!t)return;
  if(t.ms)blit(t.ms,t.scene.fb);
  g.disable(g.DEPTH_TEST); // full-screen passes must not depth-test against the canvas depth buffer
  const bloom=this.bloomOn&&t.mips.length>1;
  if(bloom){
    this.quadPass('prefilter',t.scene,t.mips[0],u=>{g.uniform1f(u.uThreshold,1.05);g.uniform1f(u.uKnee,.5)});
    for(let i=1;i<t.mips.length;i++)this.quadPass('down',t.mips[i-1],t.mips[i]);
    g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE);for(let i=t.mips.length-2;i>=0;i--)this.quadPass('up',t.mips[i+1],t.mips[i]);g.disable(g.BLEND);
  }
  const c=this.post.composite;g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,w,h);g.useProgram(c.p);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,t.scene.t);g.uniform1i(c.u.uScene,0);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,(bloom?t.mips[0]:t.scene).t);g.uniform1i(c.u.uBloom,1);g.uniform1f(c.u.uBloomStrength,this.light.bloom*.5);g.uniform1f(c.u.uExposure,this.light.exposure);g.uniform1f(c.u.uUseBloom,bloom?1:0);g.bindVertexArray(this.quad);g.drawArrays(g.TRIANGLES,0,3);g.bindVertexArray(null);
}
distance(n){return Math.hypot(n.world[12]-this.eye[0],n.world[13]-this.eye[1],n.world[14]-this.eye[2])}
}global.E3D={V,M,G,Node,Renderer,rgb,cameraMatrices,QUALITY};})(globalThis);

if(typeof window!=='undefined')window.classroomDependencies=Promise.resolve();
