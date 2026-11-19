from pathlib import Path
import base64
from xml.etree import ElementTree as ET
import numpy as np
from PIL import Image,ImageDraw
from test_engine import fixture
from engine import vectorize

root=Path(__file__).parent
im=Image.new('RGB',(4096,2160),'white')
d=ImageDraw.Draw(im)
d.rounded_rectangle((1500,800,1800,1100),35,fill='black')
d.ellipse((1575,875,1725,1025),fill='white')
im.save(root/'logo-4k.png')
cfg=fixture()
def region(image,box,mode):
    rgba=np.array(image.convert('RGBA').crop(box))
    h,w=rgba.shape[:2]
    cfg.update(shape=[h,w],origin=list(box[:2]),mode=mode,color=[0,0,0],
               rgba=base64.b64encode(rgba.tobytes()).decode(),
               mask=base64.b64encode(bytes([255])*(w*h)).decode())
    return vectorize(cfg)
a=region(im,(1450,750,1850,1150),'Color')
assert len(a)==1 and len(a[0])==2 and a==vectorize(cfg)
photo=Image.open(root/'photo.jpg')
a=region(photo,(80,20,445,525),'Object')
assert a
svg=ET.parse(root/'Example-artboard.svg')
assert len(svg.findall('.//{http://www.w3.org/2000/svg}path'))==2
print('PASS 4K crop, holes, deterministic repeat, photo GrabCut, Illustrator SVG')

