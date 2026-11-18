"""Build the optical console and detachable power lead in Blender.

Run Blender in background mode with --factory-startup --python instrument.py.
Coordinates in the construction helpers follow the instrument (Y up, front +Z).
"""
import json
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0


def finish(name, color, rough, metal=0, pattern=0):
    material = bpy.data.materials.new(name)
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    material.diffuse_color = [v ** 2.2 for v in rgb] + [1]
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = material.diffuse_color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    material["runtime"] = json.dumps(dict(color=color, rough=rough, metal=metal, pattern=pattern))
    return material


case = finish("Graphite moulded ABS", "#293538", .36, pattern=10)
boot = finish("Cord jacket and light seal", "#253033", .58, pattern=10)
steel = finish("Brushed stainless fastener", "#bbc5c3", .27, .87)
rim = finish("Anodised instrument trim", "#929b95", .31, .72)


def xyz(p):
    return p[0], -p[2], p[1]


def attach(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        edge = obj.modifiers.new("Machined edge radius", "BEVEL")
        edge.width, edge.segments = bevel, 3
        normals = obj.modifiers.new("Face normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
    return obj


def block(name, center, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(center))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return attach(obj, name, mat, bevel)


def console(name, bounds, bottom, surface, mat, bevel):
    left, right, back, front = bounds
    corners = [(left, front), (right, front), (right, back), (left, back)]
    verts = [xyz((x, y(z), z)) for y in (bottom, surface) for x, z in corners]
    faces = [(3, 2, 1, 0), (4, 5, 6, 7)] + [(i, (i+1)%4, (i+1)%4+4, i+4) for i in range(4)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return attach(obj, name, mat, bevel)


def face(z):
    return 1.397 - .15*z


console("Sealed monitor housing", (-1.52, .35, -.67, .58), lambda z: 1.272, face, case, .026)
console("Rolled monitor bezel", (-1.465, .295, -.608, .514), face, lambda z: face(z)+.013, rim, .009)
console("Recessed display gasket", (-1.445, .275, -.588, .494), lambda z: face(z)+.009,
        lambda z: face(z)+.023, boot, .007)

# Curve follows the top of the bench, with its strain-relief boot seated in the case.
block("Recessed IEC socket", (1.13, .47, -1.157), (.38, .27, .045), case, .022)
block("Power plug", (1.13, .47, -1.27), (.26, .19, .24), boot, .028)
for i in range(4):
    block("Flexible strain relief", (1.13, .47, -1.401-i*.038),
          (.16-i*.013, .14-i*.013, .042), boot, .013)
cord = bpy.data.curves.new("Flexible mains cable", "CURVE")
cord.dimensions, cord.resolution_u, cord.bevel_depth, cord.bevel_resolution = "3D", 14, .040, 4
curve = cord.splines.new("BEZIER")
route = [(1.13,.47,-1.46),(1.18,.43,-1.74),(1.42,.16,-1.99),(1.77,.018,-2.12),
         (2.11,.018,-2.42),(2.03,.018,-2.78),(1.76,.045,-3.02),(1.68,.018,-3.12),
         (1.67,-.12,-3.13)]
curve.bezier_points.add(len(route)-1)
for point, position in zip(curve.bezier_points, route):
    point.co = xyz(position)
    point.handle_left_type = point.handle_right_type = "AUTO"
lead = bpy.data.objects.new("Power cable", cord)
bpy.context.collection.objects.link(lead)
attach(lead, "Power cable", boot)
bpy.ops.mesh.primitive_torus_add(major_segments=48, minor_segments=10, major_radius=.105,
                                 minor_radius=.019, location=xyz((1.67,-.006,-3.13)))
attach(bpy.context.object, "Bench cable entry", boot)
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.10, depth=.009,
                                    location=xyz((1.67,-.012,-3.13)))
attach(bpy.context.object, "Cable entry liner", boot)

for z in (-.76, -.57, -.38, -.19, 0, .19, .38, .57, .76):
    block("Vent aperture", (1.606,.79,z), (.009,.25,.055), boot, .004)
    block("Stamped vent lip", (1.609,.919,z), (.015,.016,.060), rim, .004)

for x in (-1.397, .227):
    for z in (-.525, .434):
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=.028, depth=.011,
                                            location=xyz((x,face(z)+.028,z)))
        obj = attach(bpy.context.object, "Flush screw", steel, .002)
        slot=block("Driver slot", (x,face(z)+.035,z), (.033,.002,.006), boot)
        slot.rotation_euler.z = .58

bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"authoring"/"instrument-details.blend"), compress=True)

# Export evaluated surfaces grouped by finish; animated equipment remains a parent at runtime.
deps = bpy.context.evaluated_depsgraph_get()
parts = {}
for obj in bpy.context.scene.objects:
    evaluated = obj.evaluated_get(deps)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    world = obj.matrix_world
    normal_matrix = world.to_3x3().inverted().transposed()
    mat = obj.data.materials[0]
    data = parts.setdefault(mat.name, {"name": mat.name, "material": json.loads(mat["runtime"]), "vertices":[]})
    for tri in mesh.loop_triangles:
        for loop in tri.loops:
            vertex = mesh.vertices[mesh.loops[loop].vertex_index]
            p = world @ vertex.co
            n = (normal_matrix @ mesh.corner_normals[loop].vector).normalized()
            data["vertices"].extend(round(v,5) for v in (p.x,p.z,-p.y,n.x,n.z,-n.y,p.x,p.z))
    evaluated.to_mesh_clear()

(ROOT/"authoring"/"instrument-details.json").write_text(json.dumps(list(parts.values()), separators=(",",":")))
