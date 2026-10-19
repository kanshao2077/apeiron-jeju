// Adapted from dgreenheck/tidewater, src/sky/SkyProClouds.js (MIT).
// Copyright (c) 2026 DRG Software Solutions LLC. See licenses/tidewater-MIT.txt.
// Perlin-Worley density, erosion, multiple scattering and aerial perspective.
export async function loadCloudShape(device){
 const response=await fetch(new URL('./assets/cloud-shape32.bin',import.meta.url));
 if(!response.ok)throw new Error(`Cloud shape: HTTP ${response.status}`);
 const data=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
 const header=new DataView(data.buffer);
 if(header.getUint32(0,true)!==0x315a5a4e)throw new Error('Invalid cloud shape');
 const size=header.getUint16(6,true),mips=header.getUint8(12);
 const texture=device.createTexture({label:'Perlin-Worley cloud shape',dimension:'3d',size:[size,size,size],mipLevelCount:mips,format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST});
 let offset=16;
 for(let mip=0;mip<mips;mip++){
  const side=Math.max(1,size>>mip);
  device.queue.writeTexture({texture,mipLevel:mip},data,{offset,bytesPerRow:side*4,rowsPerImage:side},[side,side,side]);
  offset+=side**3*4;
 }
 return texture;
}

export const CLOUD_WGSL=/* wgsl */`
// Shell and density follow Tidewater's partly-cloudy preset, in metres.
const CL_BASE:f32=4000.0;
const CL_DEPTH:f32=5200.0;
const CL_SCALE:f32=7500.0;
const CL_EROSION:f32=975.0;
struct CloudCandidate { value:f32, edge:f32, top:f32, floorMask:f32, height:f32, localHeight:f32, position:vec3f };
fn cloudWind()->vec2f{return normalize(F.windP[0].xy+vec2f(0.0001))*F.camPos.w*12.0;}
fn cloudLod(footprint:f32,scale:f32)->f32{return max(0.0,log2(max(footprint*32.0/scale,1.0)));}
fn cloudCandidate(p:vec3f,coverage:f32,lod:f32)->CloudCandidate{
 var c:CloudCandidate;c.value=0.0;
 let horizontal=p.xz-F.camPos.xz;
 let h=(p.y+dot(horizontal,horizontal)/12742000.0-CL_BASE)/CL_DEPTH;
 if(h< -0.1||h>1.3){return c;}
 let wind=cloudWind();
 let direction=normalize(F.windP[0].xy+vec2f(0.0001));
 let shape=p-vec3f(wind.x,0.0,wind.y)-vec3f(direction.x,0.0,direction.y)*(1750.0*max(h,0.0)-F.camPos.w*8.2);
 let weather=textureSampleLevel(cloudWeather,sampC,fract((p.xz-wind)/29000.0+vec2f(0.17,0.36)),0.0).r;
 let edge=max(0.065*exp2(-max(h,0.0)),0.0001);
 if(weather+coverage-1.0+1.34*0.69*coverage<h-edge){return c;}
 let required=(1.0-smoothstep(0.0,0.13,h))*0.54;
 let floorMask=smoothstep(required-0.1,required,weather);
 if(floorMask<=0.0){return c;}
 let base=textureSampleLevel(cloudVolume,sampC,fract(shape/CL_SCALE),lod).rgb;
 let top=weather+coverage-1.0+dot(base,vec3f(0.7,0.41,0.23))*0.69*coverage;
 c.value=smoothstep(-edge,edge,top-h)*smoothstep(-edge,edge,h)*floorMask;
 c.edge=edge;c.top=top;c.floorMask=floorMask;c.height=h;
 c.localHeight=clamp(h/max(top,0.001),0.0,1.0);c.position=shape;
 return c;
}
fn cloudEroded(c:CloudCandidate,lod:f32)->f32{
 if(c.value<=0.0){return 0.0;}
 let strength=mix(0.24,2.15,c.localHeight);
 if(min(c.top-c.height,c.height)>=0.173*strength*0.52+c.edge){return c.floorMask;}
 let shape=textureSampleLevel(cloudVolume,sampC,fract(c.position/CL_EROSION),lod).rgb;
 let erosion=dot(shape,vec3f(0.113,0.04,0.02))*strength*0.52;
 return smoothstep(-c.edge,c.edge,c.top-erosion-c.height)*smoothstep(-c.edge,c.edge,c.height-erosion)*c.floorMask;
}
fn cloudHG(mu:f32,g:f32)->f32{
 let d=max(1.0+g*g-2.0*g*mu,0.001);return (1.0-g*g)/(12.566371*d*sqrt(d));
}
fn cloudPhases(mu:f32)->vec3f{
 return vec3f(cloudHG(mu,0.8),cloudHG(mu,0.4),cloudHG(mu,0.2))*0.8+vec3f(cloudHG(mu,-0.2),cloudHG(mu,-0.1),cloudHG(mu,-0.05))*0.2;
}
fn cloudRoots(dir:vec3f,alt:f32,origin:f32)->vec2f{
 let radius=6371000.0;let b=(radius+origin)*dir.y;let c=(origin-alt)*(2.0*radius+origin+alt);
 let d=b*b-c;if(d<0.0){return vec2f(-1.0);}
 let q=-b-select(-sqrt(d),sqrt(d),b>=0.0);let other=c/select(-0.0001,q,abs(q)>0.0001);
 return vec2f(min(q,other),max(q,other));
}
fn clearSky(dir:vec3f)->vec3f{
 return mix(vec3f(0.35,0.56,0.76),vec3f(0.16,0.39,0.70),smoothstep(0.0,0.7,max(dir.y,0.0)));
}
fn volumeSky(dir:vec3f,steps:i32,jitter:f32)->vec3f{
 let bg=clearSky(dir);if(dir.y<=0.0){return bg;}
 let origin=vec3f(F.camPos.x,30.0,F.camPos.z);
 let start=max(0.0,cloudRoots(dir,CL_BASE,origin.y).y);
 let finish=min(120000.0,cloudRoots(dir,CL_BASE+CL_DEPTH,origin.y).y);
 if(finish<=start){return bg;}
 let stepBase=max(45.0,(finish-start)/(f32(steps)*1.7));
 let sun=normalize(F.sunDir.xyz);
 let phases=cloudPhases(dot(dir,sun));
 let pixelCone=max(0.001,2.0*length(F.camUp.xyz)/F.screen.y*2.0);
 var t=start+jitter*stepBase;var trans=1.0;var color=vec3f(0.0);var weightedDepth=0.0;
 var coarse=true;var empty=0;
 for(var i=0;i<steps;i++){
  if(t>=finish||trans<0.015){break;}
  let ds=max(stepBase,t*0.0025);
  let p=origin+dir*t;let footprint=t*pixelCone;
  let baseLod=cloudLod(footprint,CL_SCALE);let erosionLod=cloudLod(footprint,CL_EROSION);
  let coverage=0.52+0.08*smoothstep(20000.0,65000.0,t);
  let candidate=cloudCandidate(p,coverage,baseLod);
  if(coarse){
   if(candidate.value>0.0&&cloudEroded(candidate,erosionLod)>0.0){t=max(start,t-3.0*ds);coarse=false;empty=0;continue;}
   t+=ds*4.0;continue;
  }
  let density=cloudEroded(candidate,erosionLod);
  if(density<=0.0){empty++;if(empty>=3){coarse=true;}t+=select(ds,ds*4.0,coarse);continue;}
  empty=0;
  var tau=0.0;
  for(var j=0;j<3;j++){
   let offset=pow(2.0,f32(j))*140.0;
   let light=cloudCandidate(p+sun*offset,coverage,max(baseLod,f32(j)*0.7));
   tau+=light.value*offset*0.013;
  }
  let quarter=exp(-tau*0.25);let halfT=quarter*quarter;
  let energy=dot(vec3f(halfT*halfT,halfT*0.5,quarter*0.25),phases);
  let height=clamp(candidate.height,0.0,1.0);
  let baseShadow=mix(0.45,1.0,smoothstep(0.0,0.13,height));
  let powder=mix(1.0,1.0-exp(-density*2.0),0.3*(1.0-smoothstep(0.2,0.95,dot(dir,sun))));
  let skyAbove=cloudCandidate(p+vec3f(0.0,400.0,0.0),coverage,baseLod+1.0).value;
  let skyVisibility=0.2+0.8/(1.0+skyAbove*2.2);
  let ambient=mix(clearSky(vec3f(0.0,1.0,0.0)),vec3f(0.65,0.70,0.75),0.60)*skyVisibility*0.85;
  let light=vec3f(13.0,12.9,12.6)*energy*powder*baseShadow+ambient;
  let stepT=exp(-density*0.013*min(ds,finish-t));
  let alpha=trans*(1.0-stepT);color+=alpha*light;weightedDepth+=alpha*t;trans*=stepT;t+=ds;
 }
 let alpha=1.0-trans;if(alpha<0.001){return bg;}
 let distance=weightedDepth/alpha;
 // Cloud distance, rather than screen height, controls haze and softening.
 let air=exp(-distance/50000.0);color=color*air+bg*alpha*(1.0-air);
 let melt=smoothstep(22000.0,85000.0,distance);color=mix(color,bg*alpha,melt);
 return bg*trans+color;
}
`;

export const CLOUD_WEATHER_WGSL=/* wgsl */`
@group(0) @binding(0) var outputMap:texture_storage_2d<rgba8unorm,write>;

fn scHash33( cell: vec3u ) -> vec3u {
	var p = cell * 1664525u + 1013904223u;
	p.x += p.y * p.z; p.y += p.z * p.x; p.z += p.x * p.y;
	p = p ^ ( p >> vec3u( 16u ) );
	p.x += p.y * p.z; p.y += p.z * p.x; p.z += p.x * p.y;
	return p;
}
fn scGradient( cell: vec3i, period: i32, offset: vec3f ) -> f32 {
	let wrapped = vec3u( ( ( cell % vec3i( period ) ) + vec3i( period ) ) % vec3i( period ) );
	let h = ( scHash33( wrapped ).x >> 24u ) & 15u;
	let u = select( offset.y, offset.x, h < 8u );
	let v = select( select( offset.z, offset.x, h == 12u || h == 14u ), offset.y, h < 4u );
	return select( -u, u, ( h & 1u ) == 0u ) + select( -v, v, ( h & 2u ) == 0u );
}
fn scPerlin( p: vec3f, period: i32 ) -> f32 {
	let cell = vec3i( floor( p ) ); let fr = fract( p ); let w = fr * fr * fr * ( fr * ( fr * 6.0 - 15.0 ) + 10.0 );
	return mix( mix( mix( scGradient( cell, period, fr ), scGradient( cell + vec3i( 1, 0, 0 ), period, fr - vec3f( 1, 0, 0 ) ), w.x ),
		mix( scGradient( cell + vec3i( 0, 1, 0 ), period, fr - vec3f( 0, 1, 0 ) ), scGradient( cell + vec3i( 1, 1, 0 ), period, fr - vec3f( 1, 1, 0 ) ), w.x ), w.y ),
		mix( mix( scGradient( cell + vec3i( 0, 0, 1 ), period, fr - vec3f( 0, 0, 1 ) ), scGradient( cell + vec3i( 1, 0, 1 ), period, fr - vec3f( 1, 0, 1 ) ), w.x ),
		mix( scGradient( cell + vec3i( 0, 1, 1 ), period, fr - vec3f( 0, 1, 1 ) ), scGradient( cell + vec3i( 1, 1, 1 ), period, fr - vec3f( 1, 1, 1 ) ), w.x ), w.y ), w.z );
}
fn scFbm( uv: vec2f, profile: vec4f ) -> f32 {
	var frequency = max( 1.0, round( profile.x ) ); var weight = 0.5;
	var sum = 0.0; var weights = 0.0;
	for ( var i = 0u; i < u32( profile.y ); i++ ) {
		sum += scPerlin( vec3f( uv, profile.z * 13.37 + 0.5 ) * frequency, i32( frequency ) ) * weight;
		weights += weight; weight *= 0.5; frequency *= 2.0;
	}
	return sum / max( weights, 0.001 ) * 0.5 + 0.5;
}

@compute @workgroup_size(8,8)
fn main(@builtin(global_invocation_id) id:vec3u){
 if(id.x>=256u||id.y>=256u){return;}
 let uv=(vec2f(id.xy)+0.5)/256.0;
 let mass=clamp((scFbm(uv,vec4f(4.0,5.0,0.0,1.32))-0.5)*1.32+0.5,0.0,1.0);
 let detail=(scFbm(uv,vec4f(6.0,6.0,1.0,0.13))*2.0-1.0)*0.13;
 textureStore(outputMap,id.xy,vec4f(clamp(mass+detail+0.26-0.5,0.0,1.0),0.0,0.0,1.0));
}
`;
