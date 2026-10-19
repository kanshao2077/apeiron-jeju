// Compatibility path built on Three.js r180 Water and Sky (MIT).
import * as THREE from 'three';
import {Water} from './vendor/Water.js';
import {Sky} from './vendor/Sky.js';
import {lightRay,saveBlob} from './interaction.js';
export async function startFallback(state){
 const canvas=document.getElementById('c'),renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.75;
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,200000);
 camera.position.set(0,30,0);camera.rotation.x=-2.2*Math.PI/180;
 const normals=await new THREE.TextureLoader().loadAsync('./vendor/waternormals.jpg');normals.wrapS=normals.wrapT=THREE.RepeatWrapping;
 const water=new Water(new THREE.PlaneGeometry(200000,200000),{textureWidth:512,textureHeight:512,waterNormals:normals,sunDirection:new THREE.Vector3(-.4,.6,-.7),sunColor:0xfff4df,waterColor:0x008b89,distortionScale:1.7,size:2.0});
 water.rotation.x=-Math.PI/2;scene.add(water);
 const sky=new Sky();sky.scale.setScalar(160000);scene.add(sky);const su=sky.material.uniforms;
 su.turbidity.value=1.5;su.rayleigh.value=1.9;su.mieCoefficient.value=.003;su.mieDirectionalG.value=.8;
 su.sunPosition.value.set(-.5,.65,-.6);
 try{const photo=await new THREE.TextureLoader().loadAsync('./assets/sky.jpg');photo.mapping=THREE.EquirectangularReflectionMapping;photo.colorSpace=THREE.SRGBColorSpace;scene.background=photo;scene.backgroundRotation.y=-.63;scene.remove(sky);}catch{/* procedural Sky remains as a loading fallback */}
 const u=water.material.uniforms;u.touch={value:new THREE.Vector4()};u.ripple={value:new THREE.Vector4()};u.energy={value:1};u.tint={value:new THREE.Color(1,1,1)};
 water.material.fragmentShader=water.material.fragmentShader.replace('uniform vec3 waterColor;','uniform vec3 waterColor;\nuniform vec4 touch;\nuniform vec4 ripple;\nuniform float energy;\nuniform vec3 tint;');
 water.material.fragmentShader=water.material.fragmentShader.replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',`vec3 surfaceNormal = normalize( noise.xzy * vec3( .7, 1.0, .7 ) );
 vec2 td=worldPosition.xz-touch.xy;float focus=exp(-dot(td,td)/(touch.w*touch.w*2.))*touch.z;
 vec2 rd=worldPosition.xz-ripple.xy;float rr=length(rd);float ring=exp(-pow((rr-ripple.z*1.9)/.55,2.))*exp(-ripple.z*.85)*ripple.w;
 surfaceNormal=normalize(surfaceNormal+vec3(rd.x,0.,rd.y)/(rr+.01)*sin(rr*9.-ripple.z*14.)*ring*.055);`);
 water.material.fragmentShader=water.material.fragmentShader.replace('sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );','sunLight( surfaceNormal, eyeDirection, 450.0, energy*(2.0+focus*12.0+ring*3.0), 0.5, diffuseLight, specularLight );');
 water.material.fragmentShader=water.material.fragmentShader.replace('vec3 outgoingLight = albedo;',`vec3 deep=vec3(.004,.045,.09);vec3 shallow=vec3(.008,.24,.2);float depthMix=smoothstep(35.,220.,distance);
 vec3 outgoingLight=(mix(shallow,deep,depthMix)*.8+albedo*.55+specularLight*.55)*tint;`);
 function resize(){const dpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1450000/(innerWidth*innerHeight)));renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}resize();addEventListener('resize',resize);
 const target=new THREE.Color();let last=performance.now(),time=0,frames=0,fpsTime=0;
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;state.tick(dt);if(!state.paused&&!document.hidden)time+=dt*(.15+state.wind*.35);u.time.value=time;
 const ray=lightRay(state,camera.aspect);u.sunDirection.value.set(ray.x,ray.y,ray.z);u.touch.value.set(state.worldX,state.worldZ,state.charge,1.2+Math.hypot(state.worldX,state.worldZ)*.025);u.ripple.value.set(state.releaseX,state.releaseZ,state.releaseAge,state.releasePower);u.energy.value=.4+state.light*2.;
 target.setRGB(...(state.theme==='amber'?[1.3,.94,.65]:state.theme==='silver'?[.8,.96,1.2]:[.87,1.08,1.]));u.tint.value.lerp(target,1-Math.exp(-dt*1.8));u.size.value=1.6+state.wind*1.7;
 if(scene.background?.isTexture)scene.backgroundRotation.y=-.63+time*.00088;renderer.render(scene,camera);frames++;fpsTime+=dt;if(fpsTime>.5){document.body.dataset.fps=String(Math.round(frames/fpsTime));document.body.dataset.frame=String(Math.round(time*60));document.body.dataset.motionTime=time.toFixed(3);frames=0;fpsTime=0;}
 if(state.capture){state.capture=false;canvas.toBlob(saveBlob,'image/png');}}
 requestAnimationFrame(frame);document.dispatchEvent(new CustomEvent('sea-ready',{detail:'webgl'}));
}
