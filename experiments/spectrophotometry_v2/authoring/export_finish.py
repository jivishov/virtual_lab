"""Pack Blender material batches for the studio's Y-up indexed mesh renderer."""
import json
from pathlib import Path

import bpy
import numpy as np


def export_meshes(objects, output, stem):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    bpy.context.view_layer.update()
    graph = bpy.context.evaluated_depsgraph_get()
    batches = {}
    for obj in objects:
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        world = evaluated.matrix_world
        normal = world.to_3x3().inverted().transposed()
        for face in mesh.loop_triangles:
            material = mesh.materials[face.material_index]
            vertices = batches.setdefault(material, [])
            for i in face.loops:
                v = world @ mesh.vertices[mesh.loops[i].vertex_index].co
                n = (normal @ mesh.corner_normals[i].vector).normalized()
                vertices.append((v.x,v.z,-v.y,n.x,n.z,-n.y,v.x,v.z))
        evaluated.to_mesh_clear()

    manifest = []
    with (output / (stem+".bin")).open("wb") as stream:
        for material, values in batches.items():
            vertices, indices = np.unique(np.round(values,6).astype("<f4"), axis=0, return_inverse=True)
            manifest.append(dict(name=material.name, material=json.loads(material["runtime"]),
                                 offset=stream.tell(), vertexCount=len(vertices), indexCount=indices.size))
            stream.write(vertices.tobytes())
            stream.write(indices.astype("<u4").tobytes())
    (output / (stem+".json")).write_text(json.dumps(manifest,separators=(",",":")),encoding="utf-8")
