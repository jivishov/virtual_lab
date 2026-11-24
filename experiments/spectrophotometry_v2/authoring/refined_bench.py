"""Build the optional console finish and the panoramic daylight laboratory in Blender.

Run in a fresh Blender session. The two new scenes are saved in their own .blend.
Render the Daylight lab scene and pass its PNG to bake_room.py --output-dir assets/refined.
"""
import json
import math
from pathlib import Path
import random

import bpy
from mathutils import Vector
import numpy as np

ROOT = Path(STUDIO_ROOT) if "STUDIO_ROOT" in globals() else Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "refined"
OUT.mkdir(parents=True, exist_ok=True)
PI = math.pi


def finish(name, hex_color, rough=.52, metal=0, emission=0):
    srgb = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    rgba = [v / 12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in srgb] + [1]
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = rgba
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = emission
    mat["runtime"] = json.dumps(dict(color=hex_color, rough=rough, metal=metal))
    return mat


def block(name, pos, size, mat, radius=0, angle=0):
    x,y,z = (v*.5 for v in size)
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),
           (-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata(verts,[],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    obj=bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler.z=angle
    mesh.materials.append(mat)
    if radius:
        edge=obj.modifiers.new("Edge radius","BEVEL")
        edge.width,edge.segments=radius,3
        obj.modifiers.new("Face normals","WEIGHTED_NORMAL")
    return obj


def cylinder(name,pos,radius,height,mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=28,radius=radius,depth=height,location=pos)
    obj=bpy.context.object
    obj.name=name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth=len(face.vertices)==4
    return obj


def tube(name,points,radius,mat):
    curve=bpy.data.curves.new(name,"CURVE")
    curve.dimensions="3D"
    curve.resolution_u=12
    curve.bevel_depth,curve.bevel_resolution=radius,3
    spline=curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for knot,pos in zip(spline.bezier_points,points):
        knot.co=pos
        knot.handle_left_type=knot.handle_right_type="AUTO"
    obj=bpy.data.objects.new(name,curve)
    scene.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj


console=bpy.data.scenes.new("Console finish")
bpy.context.window.scene=scene=console
gasket=finish("Key gasket","#203238",.56)
zero=finish("Reference key enamel","#245766",.36)
read=finish("Acquisition key enamel","#e9ad61",.37)
ivory=finish("Light legend","#f5f6df",.72)
graphite=finish("Dark legend","#192d34",.76)
trim=finish("Brushed chamber collar","#a5bbbe",.33,.74)


def instrument_block(name,x,y,z,w,h,d,mat,bevel):
    return block(name,(x,-z,y),(w,d,h),mat,bevel)


for name,x,cap,ink in [("ZERO",.35,zero,ivory),("READ",.76,read,graphite)]:
    instrument_block(name+" seal",x,.68,1.182,.312,.169,.043,gasket,.018)
    instrument_block(name+" cap",x,.68,1.202,.283,.145,.029,cap,.012)
    font=bpy.data.curves.new(name+" legend","FONT")
    font.body=name
    font.size=.092
    font.align_x=font.align_y="CENTER"
    font.resolution_u=4
    obj=bpy.data.objects.new(name+" legend",font)
    scene.collection.objects.link(obj)
    obj.location=(x,-1.2175,.679)
    obj.rotation_euler.x=PI/2
    font.materials.append(ink)

# Flush registration marks sit outside the opening, clear of its 0.545 x 0.625 seat.
for side in (-1,1):
    for end in (-1,1):
        instrument_block("Chamber corner",.85+side*.303,1.300,.10+end*.287,.025,.009,.106,trim,.003)
        instrument_block("Chamber corner",.85+side*.263,1.300,.10+end*.329,.101,.009,.023,trim,.003)

bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
batches={}
for obj in console.objects:
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    material=obj.data.materials[0]
    verts=batches.setdefault(material.name,[])
    world=evaluated.matrix_world
    normal=world.to_3x3().inverted().transposed()
    for tri in mesh.loop_triangles:
        for i in tri.loops:
            v=world @ mesh.vertices[mesh.loops[i].vertex_index].co
            n=(normal @ mesh.corner_normals[i].vector).normalized()
            verts.append((v.x,v.z,-v.y,n.x,n.z,-n.y,v.x,v.z))
    evaluated.to_mesh_clear()

manifest=[]
with (OUT/"console.bin").open("wb") as stream:
    for name,values in batches.items():
        vertices,indices=np.unique(np.round(values,6).astype("<f4"),axis=0,return_inverse=True)
        manifest.append(dict(name=name,material=json.loads(bpy.data.materials[name]["runtime"]),
                             offset=stream.tell(),vertexCount=len(vertices),indexCount=indices.size))
        stream.write(vertices.tobytes())
        stream.write(indices.astype("<u4").tobytes())
(OUT/"console.json").write_text(json.dumps(manifest,separators=(",",":")),encoding="utf-8")

room=bpy.data.scenes.new("Daylight lab")
bpy.context.window.scene=scene=room
plaster=finish("Warm mineral plaster","#d8d8cd",.84)
ceiling=finish("Acoustic ceiling","#e4e5df",.89)
floor=finish("Pale linoleum","#9da49e",.64)
tile=finish("Glazed celadon tile","#9cb8b0",.30)
grout=finish("Tile grout","#c5cec4",.72)
cab=finish("Mist grey enamel","#9daea8",.44)
wood=finish("Maple shelf edges","#ba9972",.5)
top=finish("Honed phenolic resin","#374a4b",.47)
steel=finish("Satin stainless steel","#a9b5b4",.29,.79)
frame=finish("Deep anodised bronze","#435454",.40,.55)
diffuser=finish("Opal diffuser","#fff3d8",.36,emission=2.5)
paper=finish("Reagent label paper","#e4e1ce",.70)
amber=finish("Amber reagent glass","#895737",.24,.04)
cobalt=finish("Blue reagent glass","#3b6275",.21,.04)
outside=finish("Courtyard limestone","#c5c8b6",.85)
windows=finish("Distant glazing","#849fa3",.31,.15)

def surface_grain(mat, scales, variation, depth):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    base = list(bsdf.inputs["Base Color"].default_value)
    coords = nodes.new("ShaderNodeTexCoord")
    stretch = nodes.new("ShaderNodeVectorMath")
    stretch.operation = "MULTIPLY"
    stretch.inputs[1].default_value = scales
    links.new(coords.outputs["Object"], stretch.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 1
    noise.inputs["Detail"].default_value = 3
    links.new(stretch.outputs[0], noise.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    for point, factor in zip(ramp.color_ramp.elements, (1-variation, 1+variation)):
        point.color = [min(1, channel*factor) for channel in base[:3]]+[1]
    links.new(noise.outputs["Fac"], ramp.inputs[0])
    links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .22
    bump.inputs["Distance"].default_value = depth
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


surface_grain(wood,(5,240,160),.40,.0012)
surface_grain(floor,(105,110,65),.28,.0018)
surface_grain(top,(160,160,70),.19,.0009)
surface_grain(plaster,(65,65,65),.09,.0016)

block("Floor",(0,0,-.08),(10.6,8.9,.16),floor)
block("Ceiling",(0,0,3.63),(10.6,8.9,.16),ceiling)
room_walls={"north":((0,4.36),0,10.35),"west":((-5.16,0),PI/2,8.72),
            "south":((0,-4.36),PI,10.35),"east":((5.16,0),-PI/2,8.72)}


def wall_point(wall,u,inset,z):
    (cx,cy),angle,_=room_walls[wall]
    return (cx+u*math.cos(angle)+inset*math.sin(angle),cy+u*math.sin(angle)-inset*math.cos(angle),z)


def wall_block(wall,name,u,inset,z,w,d,h,mat,bevel=0):
    return block(name,wall_point(wall,u,inset,z),(w,d,h),mat,bevel,room_walls[wall][1])


for wall,(_,angle,span) in room_walls.items():
    wall_block(wall,"Baseboard",0,.058,.064,span,.054,.128,frame,.007)
    if wall in ("north","west"):
        wall_block(wall,"Spandrel",0,0,.59,span,.16,1.18,plaster)
        wall_block(wall,"Window head",0,0,3.36,span,.16,.46,plaster)
        for side in (-1,1):
            wall_block(wall,"Window jamb",side*(span/2-.23),0,2.155,.46,.16,1.95,plaster)
        opening=span-.92
        for z in (1.19,2.77,3.12):
            wall_block(wall,"Window sash",0,.045,z,opening,.12,.045,frame,.006)
        for i in range(7):
            u=(i/6-.5)*opening
            wall_block(wall,"Window mullion",u,.055,2.155,.048,.13,1.96,frame,.005)
        wall_block(wall,"Window sill",0,.085,1.145,opening+.08,.35,.065,wood,.010)
    else:
        wall_block(wall,"Plastered wall",0,0,1.78,span,.16,3.56,plaster)

for wall,span in [("north",8.72),("west",6.75),("east",5.24)]:
    wall_block(wall,"Recessed plinth",0,.37,.075,span-.14,.53,.15,frame,.012)
    wall_block(wall,"Cabinet carcass",0,.39,.51,span,.65,.78,frame,.013)
    count=round(span/.73)
    for i in range(count):
        u=((i+.5)/count-.5)*span
        for z,h in [(.427,.514),(.792,.185)]:
            wall_block(wall,"Drawer front",u,.722,z,span/count-.014,.030,h,cab,.008)
            wall_block(wall,"Drawer pull",u,.759,z+h*.32,.173,.043,.019,steel,.006)
    if wall=="north":
        # Four countertop pieces enclose a real recessed basin.
        c,hw=1.34,.37
        for a,b in [(-span/2,c-hw),(c+hw,span/2)]:
            wall_block(wall,"Countertop",(a+b)/2,.425,.939,b-a,.77,.066,top,.009)
        for inset,depth in [(.1225,.165),(.7325,.155)]:
            wall_block(wall,"Sink rail",c,inset,.939,2*hw,depth,.066,top,.004)
        wall_block(wall,"Basin floor",c,.43,.755,.74,.45,.025,steel,.009)
        for side in (-1,1):
            wall_block(wall,"Basin side",c+side*.361,.43,.85,.020,.47,.19,steel)
            wall_block(wall,"Basin return",c,.43+side*.217,.85,.74,.020,.19,steel)
        tube("Gooseneck tap",[wall_point(wall,c,.16,.965),wall_point(wall,c,.16,1.27),
                              wall_point(wall,c,.28,1.34),wall_point(wall,c,.40,1.23)],.018,steel)
    else:
        wall_block(wall,"Countertop",0,.425,.939,span,.77,.066,top,.012)

wall_block("east","Splashback backing",0,.095,1.315,5.24,.035,.70,grout)
for row in range(4):
    for i in range(22):
        wall_block("east","Glazed tile",(i-10.5)*.238,.122,1.049+row*.173,.235,.018,.170,tile,.002)
for z in (1.68,2.21):
    wall_block("east","Maple shelf",0,.23,z,4.64,.39,.049,wood,.008)
    for u in (-1.8,-.62,.62,1.8):
        wall_block("east","Shelf bracket",u,.12,z-.10,.03,.16,.18,frame,.008)
    for i,u in enumerate((-1.85,-1.62,-.88,-.66,.62,.84,1.46)):
        h=.23+.035*(i%3)
        xx,yy,_=wall_point("east",u,.24,z)
        cylinder("Reagent bottle",(xx,yy,z+.03+h/2),.060,h,cobalt if i in (2,3) else amber)
        cylinder("Paper label",(xx,yy,z+.04+h*.48),.061,h*.40,paper)
        cylinder("Bottle neck",(xx,yy,z+.03+h+.016),.031,.045,cobalt if i in (2,3) else amber)
        cylinder("Bottle cap",(xx,yy,z+.03+h+.045),.036,.030,frame)

# An interior observation window and oak door on the return wall.
wall_block("south","Observation frame",-.92,.11,1.72,3.72,.07,1.45,frame,.012)
wall_block("south","Observation glass",-.92,.155,1.72,3.62,.02,1.35,windows)
wall_block("south","Observation mullion",-.92,.179,1.72,.045,.030,1.35,frame)
wall_block("south","Oak door",2.18,.105,1.105,1.1,.07,2.21,wood,.012)
wall_block("south","Door vision panel",2.18,.151,1.56,.49,.022,.72,windows,.008)
wall_block("south","Door handle",2.59,.214,1.02,.18,.065,.028,steel,.008)
for y in (-2.6,.2,2.65):
    for x in (-2.6,2.6):
        block("Linear luminaire",(x,y,3.48),(2.82,.20,.12),frame,.018)
        block("Opal task light",(x,y,3.413),(2.74,.157,.018),diffuser,.006)

block("Courtyard paving",(0,0,-.26),(60,60,.2),outside)
block("Campus wing",(-16,6,2.53),(1.5,23,5.5),outside,.035)
block("Courtyard ribbon windows",(-15.23,6,2.85),(.055,21.6,1.3),windows)
for i in range(16):
    block("Far mullion",(-15.19,-4.8+i*1.44,2.85),(.08,.085,1.32),frame)
bark=finish("Birch bark","#b2a99a",.87)
foliage=[finish("Birch foliage "+str(i),color,.73) for i,color in
         enumerate(("#557347","#73914d","#859d58","#a0ad62"))]
for mat in foliage:
    shader=mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Subsurface Weight"].default_value=.12
    shader.inputs["Subsurface Scale"].default_value=.001


def birch(seed):
    rng=random.Random(seed)
    twigs=bpy.data.curves.new("Silver birch branches","CURVE")
    twigs.dimensions="3D"
    twigs.bevel_depth,twigs.bevel_resolution=.09,1
    twigs.materials.append(bark)
    verts,faces,shades=[],[],[]

    def limb(start,end,radii):
        segment=twigs.splines.new("POLY")
        segment.points.add(1)
        for pt,pos,r in zip(segment.points,(start,end),radii):
            pt.co=(*pos,1)
            pt.radius=r

    def leaves(center):
        for _ in range(40):
            p=center+Vector((rng.gauss(0,.22),rng.gauss(0,.22),rng.gauss(-.05,.15)))
            turn=rng.random()*2*PI
            along=Vector((math.cos(turn),math.sin(turn),rng.uniform(-.9,.38)))*rng.uniform(.042,.080)
            across=Vector((-math.sin(turn),math.cos(turn),rng.uniform(-.45,.45)))*rng.uniform(.020,.036)
            i=len(verts)
            verts.extend([p-along,p+across,p+along,p-across])
            faces.append((i,i+1,i+2,i+3))
            shades.append(rng.randrange(len(foliage)))

    base=Vector((0,0,-.15))
    tip=Vector((rng.uniform(-.32,.32),rng.uniform(-.32,.32),5.3))
    limb(base,tip,(1.3,.055))
    for j in range(41):
        h=1.25+3.95*j/41
        angle=j*2.39996+rng.uniform(-.32,.32)
        reach=(1.1+math.sin(PI*(h-1)/4.5))*(1.12-.64*(h/5.3)**3)*rng.uniform(.78,1.12)
        start=base.lerp(tip,h/5.3)
        elbow=start+Vector((math.cos(angle)*reach*.56,math.sin(angle)*reach*.56,.62))
        limb(start,elbow,(.31,.14))
        for _ in range(6):
            a=angle+rng.uniform(-.72,.72)
            end=elbow+Vector((math.cos(a)*reach*rng.uniform(.38,.91),math.sin(a)*reach*rng.uniform(.38,.91),rng.uniform(.03,.68)))
            limb(elbow,end,(.13,.023))
            leaves(end)
    mesh=bpy.data.meshes.new("Silver birch leaves")
    mesh.from_pydata(verts,[],faces)
    for mat in foliage:
        mesh.materials.append(mat)
    mesh.polygons.foreach_set("material_index",shades)
    return (twigs,mesh)


trees=[birch(630+i) for i in range(3)]
rng=random.Random(630)
for i,(x,y) in enumerate([(-9,8),(-5,13),(.2,10),(6.3,14),(10,10),(-11,3),(-9,-4),(-13,-8)]):
    rot,scale=rng.random()*2*PI,rng.uniform(.85,1.18)
    for data in trees[i%3]:
        obj=bpy.data.objects.new(data.name,data)
        room.collection.objects.link(obj)
        obj.location=(x,y,-.08)
        obj.rotation_euler.z=rot
        obj.scale=(scale,)*3

world=bpy.data.worlds.new("Daylight")
world.use_nodes=True
sky=world.node_tree.nodes.new("ShaderNodeTexSky")
sky.sky_type="HOSEK_WILKIE"
sky.sun_direction=Vector((-.5,.7,.6)).normalized()
sky.turbidity=2.8
world.node_tree.links.new(sky.outputs[0],world.node_tree.nodes.get("Background").inputs["Color"])
world.node_tree.nodes.get("Background").inputs["Strength"].default_value=1.7
room.world=world
sun=bpy.data.lights.new("Courtyard sunlight","SUN")
sun.energy,sun.angle,sun.color=2.6,.065,(1,.91,.74)
sunbeam=bpy.data.objects.new("Courtyard sunlight",sun)
room.collection.objects.link(sunbeam)
sunbeam.rotation_euler=Vector((.59,-.81,-.70)).to_track_quat("-Z","Y").to_euler()
for name,pos,target,energy,size,color in [
    ("Window daylight",(-4.2,1.0,2.62),(1,0,.65),440,4.5,(.84,.93,1)),
    ("North glazing",(1.0,3.42,2.5),(0,0,1),485,5.0,(.94,.97,1)),
    ("Overhead fill",(1,-1,3.43),(0,0,0),320,4.6,(1,.88,.74))]:
    lamp=bpy.data.lights.new(name,"AREA")
    lamp.energy,lamp.shape,lamp.size,lamp.color=energy,"DISK",size,color
    obj=bpy.data.objects.new(name,lamp)
    room.collection.objects.link(obj)
    obj.location=pos
    obj.rotation_euler=(Vector(target)-Vector(pos)).to_track_quat("-Z","Y").to_euler()
cam=bpy.data.cameras.new("Bench panorama")
cam.type,cam.panorama_type="PANO","EQUIRECTANGULAR"
camera=bpy.data.objects.new("Bench panorama",cam)
room.collection.objects.link(camera)
camera.location=(0,0,1.50)
camera.rotation_euler=(PI/2,0,-1.95)
room.camera=camera
room.render.engine="CYCLES"
room.cycles.samples=18
room.cycles.max_bounces=5
room.cycles.use_denoising=True
room.render.resolution_x,room.render.resolution_y=3072,1536
room.render.resolution_percentage=100
room.render.image_settings.file_format="PNG"
room.view_settings.view_transform="AgX"
bpy.context.view_layer.update()
bpy.data.libraries.write(str(ROOT/"authoring"/"refined-bench.blend"),{room,console},fake_user=True,compress=True)
print("Saved",len(room.objects),"room objects and",len(console.objects),"console objects in two editable scenes.")
