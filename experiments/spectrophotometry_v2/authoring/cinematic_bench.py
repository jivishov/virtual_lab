"""Build the cinematic spectrophotometer study. Run with Blender in background mode."""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector
import numpy as np

ROOT = Path(STUDIO_ROOT) if "STUDIO_ROOT" in globals() else Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "authoring"))
from export_finish import export_meshes

OUT = ROOT / "assets" / "cinematic"
scene = bpy.data.scenes.new("Cinematic instrument")
bpy.context.window.scene = scene


def material(name, hex_color, rough=.4, metal=0, pattern=0):
    color = [int(hex_color[i:i+2],16)/255 for i in (1,3,5)]
    linear = [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in color]
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear,1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = m.diffuse_color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m["runtime"] = json.dumps(dict(color=hex_color,rough=rough,metal=metal,pattern=pattern))
    return m


def attach_mesh(name, verts, faces, mat):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return obj


def turned(name, profile, mat, flutes=0):
    # Rings run from the rear of the knob toward its front. The Y-up web mesh
    # uses +Z toward the operator, which maps to -Y in Blender.
    count = flutes*4 if flutes else 96
    vertices = []
    for depth, radius, relief in profile:
        for i in range(count):
            a = 2*math.pi*i/count
            r = radius - relief*(1-math.cos(flutes*a))/2
            vertices.append((r*math.cos(a),-depth,r*math.sin(a)))
    faces = [list(reversed(range(count)))]
    for ring in range(len(profile)-1):
        for i in range(count):
            j = (i+1)%count
            lo, hi = ring*count, (ring+1)*count
            faces.append((lo+i,lo+j,hi+j,hi+i))
    faces.append(list(range(len(vertices)-count,len(vertices))))
    obj = attach_mesh(name,vertices,faces,mat)
    for f in obj.data.polygons[1:-1]:
        f.use_smooth=True
    return obj


black = material("Anodised knurled grip","#354349",.30,.74)
rim = material("Lathe-cut aluminium","#b7c1c3",.24,.92)
face = material("Graphite dial face","#364348",.37,.55)
index = material("Inlaid dial index","#f0e5c8",.42,.08)
parts = [
    turned("Retaining collar",[(-.048,.151,0),(-.043,.158,0),(-.032,.158,0),(-.029,.151,0)],rim),
    turned("Knurled barrel",[(-.038,.137,.001),(-.031,.148,.003),(.010,.148,.006),
           (.034,.148,.006),(.040,.144,.003),(.043,.138,0)],black,44),
    turned("Machined front chamfer",[(.039,.139,0),(.044,.140,0),(.049,.134,0),(.050,.130,0)],rim),
    turned("Inset dial face",[(.048,.131,0),(.051,.129,0),(.052,.123,0)],face),
]
w,h,d=.012,.066,.003
verts=[(x,-y,z+.088) for x,y,z in [(-w/2,.052,-h/2),(w/2,.052,-h/2),(w/2,.052,h/2),(-w/2,.052,h/2),
                                    (-w/2,.052+d,-h/2),(w/2,.052+d,-h/2),(w/2,.052+d,h/2),(-w/2,.052+d,h/2)]]
marker=attach_mesh("Ivory index insert",verts,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],index)
parts.append(marker)
export_meshes(parts,OUT,"dial")
axle=bpy.data.objects.new("Wavelength shaft",None)
scene.collection.objects.link(axle)
axle.location=(1.24,-1.212,.73)
for obj in parts:
    obj.parent=axle
axle.rotation_euler.y=math.radians(72)  # 630 nm on the studio's 400–700 nm scale

# Reopen the exact runtime geometry to inspect the fit against the real enclosure.
def instrument_parts(directory, stem, group=None, parent=None):
    data=json.loads((directory/(stem+".json")).read_text(encoding="utf-8"))
    batch=data["groups"][group]["meshes"] if group else data
    binary=(directory/(stem+".bin")).read_bytes()
    for item in batch:
        spec=item["material"]
        vertices=np.frombuffer(binary,dtype="<f4",count=item["vertexCount"]*8,offset=item["offset"]).reshape(-1,8)
        indices=np.frombuffer(binary,dtype="<u4",count=item["indexCount"],offset=item["offset"]+vertices.nbytes).reshape(-1,3)
        coords=np.column_stack((vertices[:,0],-vertices[:,2],vertices[:,1]))
        if group=="instrument" and item["name"]=="Dial index":
            # Raise the model lettering clear of the upper lip of the display bezel.
            coords[coords[:,2]>1.05,2]+=.032
        coords,remap=np.unique(coords,axis=0,return_inverse=True)
        faces=remap[indices]
        tri=coords[faces]
        area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
        faces=faces[area>1e-11]
        palette={"Front enclosure":"#bfc7c0","Teal front fascia":"#23383c","Graphite moulded ABS":"#1e2c30",
                 "Sample chamber lid":"#26373a"}
        mat=material(item["name"],palette.get(item["name"],spec["color"]),spec.get("rough",.42),spec.get("metal",0))
        obj=attach_mesh(item["name"],coords.tolist(),faces.tolist(),mat)
        obj.parent=parent
        obj.data.validate()
        obj.data.polygons.foreach_set("use_smooth",np.ones(len(obj.data.polygons),dtype=bool))
        obj.data.set_sharp_from_angle(angle=math.radians(32))


instrument_parts(ROOT/"assets","equipment","instrument")
instrument_parts(ROOT/"assets"/"refined","console")
hinge=bpy.data.objects.new("Sample lid hinge",None)
scene.collection.objects.link(hinge)
hinge.location=(.85,.38,1.25)
hinge.rotation_euler.x=-1.4
instrument_parts(ROOT/"assets","equipment","instrument_lid",hinge)

# These two faces show the live app's startup canvases in the editable lighting study.
display_image=bpy.data.images.load(str(ROOT/"authoring"/"cinematic-displays.png"))
display_image.pack()
display_image.filepath="//cinematic-displays.png"
display=material("Polarised display cover","#112b31",.25)
shader=display.node_tree.nodes.get("Principled BSDF")
pixels=display.node_tree.nodes.new("ShaderNodeTexImage")
pixels.image=display_image
display.node_tree.links.new(pixels.outputs["Color"],shader.inputs["Base Color"])
display.node_tree.links.new(pixels.outputs["Color"],shader.inputs["Emission Color"])
shader.inputs["Emission Strength"].default_value=.42

def display_face(name,center,width,height,up,region):
    right=Vector((width*.5,0,0))
    top=Vector(up).normalized()*(height*.5)
    ctr=Vector(center)
    obj=attach_mesh(name,[ctr-right-top,ctr+right-top,ctr+right+top,ctr-right+top],[(0,1,2,3)],display)
    uv=obj.data.uv_layers.new()
    x,y,w,h=region
    for i,(u,v) in enumerate([(x,y+h),(x+w,y+h),(x+w,y),(x,y)]):
        uv.data[i].uv=(u/664,1-v/532)

display_face("Absorbance display",(-.65,-1.222,.84),1.19,.33,(0,0,1),(2,2,660,184))
display_face("Transmittance display",(-.585,.047,1.43005),1.64,1.015,(0,1,.15),(2,190,640,340))

# The same panorama goes into the WebGL room and the lighting study.
plate=bpy.data.images.load(str(OUT/"clean-lab.webp"))
plate.name="Window light • cinematic room"
plate.pack()
plate.filepath="//../assets/cinematic/clean-lab.webp"
world=bpy.data.worlds.new("Cinematic room light")
world.use_nodes=True
nodes,links=world.node_tree.nodes,world.node_tree.links
env=nodes.new("ShaderNodeTexEnvironment")
env.image=plate
mapping=nodes.new("ShaderNodeMapping")
mapping.inputs["Rotation"].default_value[2]=math.radians(-23.4)
links.new(nodes.new("ShaderNodeTexCoord").outputs["Generated"],mapping.inputs["Vector"])
links.new(mapping.outputs["Vector"],env.inputs["Vector"])
links.new(env.outputs["Color"],nodes.get("Background").inputs["Color"])
nodes.get("Background").inputs["Strength"].default_value=.58
scene.world=world

def area(name,position,target,power,color,size,height):
    lamp=bpy.data.lights.new(name,"AREA")
    lamp.shape,lamp.size,lamp.size_y,lamp.energy,lamp.color="RECTANGLE",size,height,power,color
    obj=bpy.data.objects.new(name,lamp)
    scene.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(Vector(target)-Vector(position)).to_track_quat("-Z","Y").to_euler()

area("Late window",(-4.7,1.8,2.9),(0,0,.6),510,(1,.76,.51),3.4,1.8)
area("Cool ceiling bounce",(2.8,-3.5,4.1),(0,0,.6),255,(.68,.84,1),4.5,3)
area("Glazing edge",(-3.8,-2.4,2),(0,0,.7),64,(.84,.94,1),.38,2.0)

worktop=material("Honed graphite resin","#303b3b",.40,.05)
attach_mesh("Resin work surface",[(-18,-18,-.01),(18,-18,-.01),(18,18,-.01),(-18,18,-.01)],[(0,1,2,3)],worktop)

for name,where,aim,lens in [("Instrument three-quarter",(-3.2,-6.4,3.6),(0,0,.77),52),
                             ("Control detail",(2.3,-3.9,1.36),(.81,-1.15,.73),78)]:
    camera=bpy.data.objects.new(name,bpy.data.cameras.new(name))
    scene.collection.objects.link(camera)
    camera.location=where
    camera.rotation_euler=(Vector(aim)-Vector(where)).to_track_quat("-Z","Y").to_euler()
    camera.data.lens=lens
    if scene.camera is None:
        scene.camera=camera
scene.render.engine="CYCLES"
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=1280,800,100
scene.view_settings.view_transform="AgX"
bpy.context.view_layer.update()
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=="VIEW_3D":
            area.spaces.active.region_3d.view_perspective="CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"authoring"/"cinematic-bench.blend"),compress=True,copy=True)
print("Saved cinematic instrument, packed panorama and",len(parts),"fitted dial parts.")
