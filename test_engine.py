import base64
import json
from pathlib import Path
import numpy as np
from PIL import Image
from engine import vectorize

def fixture():
    im=np.array(Image.open(Path(__file__).with_name('sample.png')))
    crop=im[10:135,10:235]
    h,w=crop.shape[:2]
    enc=lambda a:base64.b64encode(a.tobytes()).decode()
    return dict(shape=[h,w],origin=[10,10],rgba=enc(crop),mask=enc(np.ones((h,w),np.uint8)),mode='Object',smooth=45,detail=45,minimum=12,tol=2,color=[40,174,255],edge=50)

if __name__=='__main__':
    cfg=fixture()
    obj=vectorize(cfg)
    assert sorted(map(len,obj))==[1,2]
    for group in obj:
        for ring in group:
            assert len(ring)<75 and ring[0][0]==ring[-1][-1]
    cfg['mode']='Color'
    assert len(vectorize(cfg))==1
    cfg['mode']='Edge'
    assert vectorize(cfg)
    print(json.dumps(obj))

