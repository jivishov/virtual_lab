"""Rebuild the editable copper apparatus and the reference renderer's indexed mesh pack."""
import json
from math import cos, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent / "spectrophotometry_v2" / "authoring"))
from export_finish import export_meshes

ASSETS = HERE.parent / "assets"
ASSETS.mkdir(exist_ok=True)
scene = bpy.context.scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
scene.name = "Copper analysis apparatus"
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.cycles.use_denoising = False
bpy.context.preferences.filepaths.save_version = 0
kits = {}


def finish(name, color, rough=.42, metal=0, glass=0):
    mat = bpy.data.materials.new(name)
    mat["runtime"] = json.dumps(dict(color=color, rough=rough, metal=metal, glass=glass,
                                     opacity=.19 if glass else 1, thickness=.03 if glass else .2))
    mat.diffuse_color = tuple((int(color[i:i+2], 16)/255)**2.2 for i in (1, 3, 5)) + (1,)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = mat.diffuse_color
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Transmission Weight"].default_value = glass
    shader.inputs["IOR"].default_value = 1.47
    return mat


shell = finish("Warm grey enamel", "#c9cfc6")
teal = finish("Dark teal moulding", "#294449", .35)
steel = finish("Brushed stainless steel", "#c6cdca", .27, .86)
rubber = finish("Charcoal rubber", "#222b2c", .67)
gold = finish("Machined brass face", "#d5a346", .29, .83)
goldedge = finish("Alloy cut edges", "#b78532", .39, .73)
glass = finish("Borosilicate", "#cee5e6", .11, glass=1)
ink = finish("Cream enamel markings", "#e8e6d6")
amber = finish("Ochre control", "#dba35a", .45)
lcd = finish("Balance display glass", "#182e30", .17)
red = finish("Flask calibration red", "#a83934", .48)


def part(obj, name, material):
    obj.name = name
    obj.data.materials.append(material)
    return obj


def box(name, loc, dims, material, radius=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = part(bpy.context.object, name, material)
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        bevel = obj.modifiers.new("Moulded edges", "BEVEL")
        bevel.width = radius
        bevel.segments = 3
        obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
    return obj


def lathe(name, profile, material, *, spout=False, segments=64):
    verts, faces = [], []
    for radius, height in profile:
        for k in range(segments):
            angle = 2*pi*k/segments
            lip = max(0, cos(angle))**60 if spout and height > .66 else 0
            r = max(.00001, radius) + .09*lip
            verts.append((r*cos(angle), r*sin(angle), height+.024*lip))
    for ring in range(len(profile)-1):
        for k in range(segments):
            a, b = ring*segments+k, ring*segments+(k+1)%segments
            faces.append((a,b,b+segments,a+segments))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for face in mesh.polygons:
        face.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    return part(obj, name, material)


def kit(key, make):
    before = set(scene.objects)
    make()
    objects = sorted(set(scene.objects)-before, key=lambda obj:obj.name)
    collection = bpy.data.collections.new(key)
    scene.collection.children.link(collection)
    for obj in objects:
        for old in list(obj.users_collection):
            old.objects.unlink(obj)
        collection.objects.link(obj)
    kits[key] = objects


def balance():
    for x in (-.60,.60):
        for y in (-.38,.38):
            box("Levelling foot", (x,y,.042), (.16,.13,.084), rubber, .018)
    box("Balance lower housing",(0,0,.158),(1.65,1.18,.19),teal,.065)
    box("Balance enamel cover",(0,0,.263),(1.60,1.14,.14),shell,.056)
    box("Display recess",(0,-.389,.338),(1.30,.27,.025),rubber)
    box("Backlit LCD",(-.16,-.39,.355),(.84,.19,.022),lcd,.018)
    for x, mat in ((.35,amber),(.52,teal)):
        box("Membrane key",(x,-.39,.361),(.135,.14,.029),mat)
    pan = lathe("Stainless weighing pan",[(.001,.327),(.23,.327),(.26,.37),(.52,.392),
                (.53,.427),(.50,.447),(.47,.433),(.001,.433)],steel)
    pan.location.y = .16


def brass():
    # Thin curled swarf in a single weighed aliquot.
    for i, (dx,dy,turn) in enumerate([(-.095,-.015,.32),(.063,.034,1.72),(.015,-.078,2.1)]):
        verts, faces = [], []
        for j in range(45):
            t = j/44*2*pi*1.36
            x, y = (cos(t)*.10, (j/44-.5)*.21)
            z = .085 + sin(t)*.075
            for width, thickness in [(-.028,0),(.028,0),(.028,.011),(-.028,.011)]:
                verts.append((dx+x*cos(turn)-(y+width)*sin(turn),dy+x*sin(turn)+(y+width)*cos(turn),z+thickness))
            if j:
                for k in range(4):
                    a=(j-1)*4+k; b=(j-1)*4+(k+1)%4
                    faces.append((a,b,b+4,a+4))
        faces.extend([(3,2,1,0),(176,177,178,179)])
        mesh=bpy.data.meshes.new("Curled ribbon")
        mesh.from_pydata(verts,[],faces)
        mesh.update()
        obj=bpy.data.objects.new("Brass turning",mesh)
        scene.collection.objects.link(obj)
        part(obj,"Brass turning",gold)
        obj.data.materials.append(goldedge)
        for idx,poly in enumerate(mesh.polygons):
            poly.material_index = int(idx%4==1 or idx%4==3)


def beaker():
    lathe("50 mL beaker, rolled spout",[(.001,.015),(.293,.015),(.336,.038),(.352,.075),
          (.367,.676),(.383,.698),(.377,.718),(.356,.718),(.346,.700),(.331,.077),
          (.303,.052),(.001,.052)],glass,spout=True)
    for i in range(1,6):
        box("Etched graduation",(.075,-.34,.11+i*.086),(.106 if i%2 else .155,.009,.009),ink,.002)


def flask():
    outer=[(.001,.008),(.265,.008),(.385,.055),(.447,.174),(.454,.30),(.407,.455),
           (.28,.62),(.16,.762),(.100,.865),(.098,1.467),(.119,1.48),(.118,1.52)]
    inner=[(.089,1.52),(.082,1.48),(.082,.875),(.142,.773),(.264,.627),(.39,.45),
           (.434,.298),(.426,.18),(.365,.076),(.255,.039),(.001,.039)]
    lathe("Class A volumetric flask",outer+inner,glass)
    lathe("100 mL calibration ring",[(.098,1.104),(.100,1.106),(.100,1.122),(.098,1.124)],red)


def rack():
    box("Rack moulded foot",(0,0,.062),(2.28,.58,.117),teal,.04)
    for z in (.173,.32):
        for y in (-.191,.191):
            box("Rack rail",(0,y,z),(2.23,.109,.062),steel,.009)
        for s in range(6):
            box("Cuvette well divider",((s-2.5)*.421,0,z),(.113,.32,.062),teal,.012)
    for x in (-1.07,1.07):
        box("Rack upright",(x,0,.19),(.10,.43,.27),teal)
    box("Sample position strip",(0,-.283,.083),(2.08,.024,.107),ink,.004)


def hood():
    for x in (-.79,.79):
        box("Hood side glazing",(x,0,.81),(.026,1.19,1.56),glass,.005)
        box("Sash frame",(x,-.586,.82),(.042,.051,1.59),steel,.005)
    box("Extraction plenum",(0,.552,.85),(1.60,.12,1.67),shell)
    for z in (.39,.48,.57,.66):
        box("Extraction grille",(0,.482,z),(1.31,.023,.019),rubber,.003)
    box("Hood canopy",(0,0,1.65),(1.69,1.23,.117),teal,.026)
    box("Upper safety sash",(0,-.58,1.39),(1.53,.025,.42),glass,.003)
    box("Sash handle",(0,-.586,1.177),(1.55,.05,.036),steel,.007)
    box("Spill tray",(0,0,.026),(1.60,1.18,.048),teal)


for key, fun in [("balance",balance),("brass",brass),("beaker",beaker),
                 ("flask",flask),("rack",rack),("hood",hood)]:
    kit(key,fun)

manifest = {}
packed = bytearray()
from tempfile import TemporaryDirectory
with TemporaryDirectory() as temp:
    for key, objects in kits.items():
        export_meshes(objects,temp,key)
        entries = json.loads((Path(temp)/(key+".json")).read_text())
        for entry in entries:
            entry["offset"] += len(packed)
        manifest[key]=entries
        packed.extend((Path(temp)/(key+".bin")).read_bytes())
(ASSETS/"apparatus.bin").write_bytes(packed)
(ASSETS/"apparatus.json").write_text(json.dumps(manifest,indent=2)+"\n")

# Arrange editable objects for inspection after the local-coordinate export.
positions = {"balance":(-2,0,0),"brass":(-2,.16,.434),"flask":(.37,-.3,0),
             "beaker":(-.4,1,.05),"hood":(-.4,1,0),"rack":(1.67,.39,0)}
for key, objects in kits.items():
    for obj in objects:
        obj.location += Vector(positions[key])
scene.world.color=(.38,.38,.38)
def aim(obj, at):
    obj.rotation_euler=(Vector(at)-obj.location).to_track_quat("-Z","Y").to_euler()
for name, pos, power, size in [("Window softbox",(-3,-4,6),570,5),("Overhead fill",(4,2,5),450,4)]:
    bpy.ops.object.light_add(type="AREA",location=pos)
    light=bpy.context.object
    light.name=name; light.data.energy=power; light.data.shape="DISK"; light.data.size=size
    aim(light,(0,0,.4))
for name,pos in [("Bench overview",(3.15,-7.0,3.55)),("Reverse inspection",(-4.3,6,3.2))]:
    bpy.ops.object.camera_add(location=pos)
    cam=bpy.context.object; cam.name=name; aim(cam,(0,.25,.58)); cam.data.lens=48
scene.camera=bpy.data.objects["Bench overview"]
scene.render.resolution_x=1050
scene.render.resolution_y=620
scene.render.resolution_percentage=100
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        area.spaces.active.region_3d.view_perspective="CAMERA"
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"apparatus.blend"),compress=True)
print(f"Exported {len(kits)} editable groups, {len(packed):,} bytes")
