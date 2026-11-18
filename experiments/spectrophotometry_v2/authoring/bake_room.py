"""Bake the clean studio panorama and a matching roughness-filtered reflection atlas."""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

out = Path(__file__).resolve().parents[1] / "assets"
# Invert the display transform before integrating reflected light. Window and lamp
# highlights are an artistic exposure estimate from the supplied image.
photo = np.asarray(Image.open(sys.argv[1]).convert("RGB"),dtype=np.float32)/255
# Match both ends of the equirectangular texture for a continuous rear orbit.
band = max(16, round(photo.shape[1]*.035))
u = np.linspace(0,1,band,dtype=np.float32)[None,:,None]
blend = .5*(1-u*u*(3-2*u))
left, right = photo[:,:band].copy(), photo[:,-band:][:,::-1].copy()
photo[:,:band] = left*(1-blend)+right*blend
photo[:,-band:] = (right*(1-blend)+left*blend)[:,::-1]
y = photo**2.2
a, b = 2.51-2.43*y, .03-.59*y
hdr = np.maximum(0,(-b + np.sqrt(b*b + .56*a*y))/(2*a))
hdr = np.ascontiguousarray(np.minimum(hdr,12))


def encode(values):
    return Image.fromarray(np.uint8(np.rint(255 * np.sqrt(np.clip(np.log2(1 + np.maximum(values, 0))/6, 0, 1)))))


Image.fromarray(np.uint8(np.rint(photo*255))).save(out/"clean-lab.webp", quality=94, method=6)

# Each row of the atlas stores a rougher GGX lobe, integrated in linear radiance.
base = cv2.resize(hdr, (1024,512), interpolation=cv2.INTER_AREA)
atlas = np.zeros((512,512,3), np.float32)
rng = np.random.default_rng(630)
row = 0
for level in range(6):
    width, height = 512 >> level, 256 >> level
    y, x = np.mgrid[:height, :width]
    lon, lat = (x+.5)/width*(2*np.pi)-np.pi, (y+.5)/height*np.pi
    norm = np.stack((np.sin(lat)*np.sin(lon),np.cos(lat),-np.sin(lat)*np.cos(lon)),-1)
    east = np.stack((np.cos(lon),np.zeros_like(lon),np.sin(lon)),-1)
    north = np.cross(norm,east)
    total, weight = np.zeros_like(norm), np.zeros((height,width,1))
    count = 1 if level == 0 else 160
    alpha = max(.007,(level/5)**2)
    for i, v in enumerate(rng.permutation(count)):
        u = (v+.5)/count
        cos_h = np.sqrt((1-u)/(1+(alpha*alpha-1)*u))
        sin_h, phi = np.sqrt(1-cos_h*cos_h), i*2.3999632297
        half = cos_h*norm + sin_h*(np.cos(phi)*east+np.sin(phi)*north)
        ray = 2*cos_h*half-norm
        nl = max(0, 2*cos_h*cos_h-1)
        if nl == 0:
            continue
        px = ((np.arctan2(ray[:,:,0],-ray[:,:,2])/(2*np.pi)+.5)*1024-.5).astype(np.float32)
        py = np.clip(np.arccos(np.clip(ray[:,:,1],-1,1))/np.pi*512-.5,0,511).astype(np.float32)
        total += cv2.remap(base,px,py,cv2.INTER_LINEAR,borderMode=cv2.BORDER_WRAP)*nl
        weight += nl
    atlas[row:row+height,:width] = total/weight
    row += height
encode(atlas).save(out/"room-reflections.webp", lossless=True, method=6)
