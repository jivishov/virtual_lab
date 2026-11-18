"""Index the original Blender triangles and the studio instrument parts for local serving."""
import json
import sys
from pathlib import Path

import numpy as np

out = Path(__file__).resolve().parents[1]/"assets"
source = Path(sys.argv[1]) if len(sys.argv)>1 else out.parents[1]/"v2"/"assets"/"equipment.json"
data = json.loads(source.read_text(encoding="utf-8"))
details = json.loads((out.parent/"authoring"/"instrument-details.json").read_text())
data["groups"]["instrument"]["meshes"].extend(details)
data["meta"]["studioDetails"] = "authoring/instrument.py"
data["meta"]["triangleCount"] += sum(len(m["vertices"])//24 for m in details)
# The original export batches bottle threads and label ink together by color.
# Separate their triangles so the open neck reflects like unpainted glass.
for name in ("waterBottle","stockBottle","unknownBottle"):
    group = data["groups"][name]["meshes"]
    label = next(mesh for mesh in group if mesh["name"].startswith("Bottle label header"))
    triangles = np.asarray(label["vertices"]).reshape(-1,3,8)
    neck = np.mean(triangles[:,:,1],axis=1) > 1.18
    label["vertices"] = triangles[~neck].ravel().tolist()
    group.append({"name":"Clear moulded neck threads","vertices":triangles[neck].ravel().tolist(),
                  "material":{"color":"#ccdada","glass":1,"metal":0,"rough":.09,"opacity":.32,"thickness":.16}})
with (out/"equipment.bin").open("wb") as buf:
    for group in data["groups"].values():
        for mesh in group["meshes"]:
            values = np.array(mesh.pop("vertices"), dtype="<f4").reshape(-1,8)
            vertices, indices = np.unique(values, axis=0, return_inverse=True)
            mesh["offset"] = buf.tell()
            mesh["vertexCount"] = len(vertices)
            mesh["indexCount"] = len(values)
            buf.write(vertices.tobytes())
            buf.write(indices.astype("<u4").tobytes())
(out/"equipment.json").write_text(json.dumps(data,separators=(",",":")),encoding="utf-8")
