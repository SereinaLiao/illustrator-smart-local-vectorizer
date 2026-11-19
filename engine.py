"""Read an ROI-sized RGBA crop, selection mask and settings as JSON on stdin."""
import base64
import json
import sys

import cv2
import numpy as np


def fit(points, tolerance):
    """Least-squares cubic at chord-length parameters, split at worst residual."""
    if len(points) == 2:
        a, b = points
        return [[a, a+(b-a)/3, b-(b-a)/3, b]]
    lengths = np.linalg.norm(np.diff(points, axis=0), axis=1).cumsum()
    t = np.r_[0, lengths/lengths[-1]][:, None]
    u = 1-t
    a, b = points[[0, -1]]
    design = np.hstack([3*u*u*t, 3*u*t*t])
    fixed = u**3*a+t**3*b
    controls = np.linalg.lstsq(design, points-fixed, rcond=None)[0]
    error = np.linalg.norm(fixed+design@controls-points, axis=1)
    i = int(error.argmax())
    if error[i] <= tolerance:
        return [[a, *controls, b]]
    return fit(points[:i+1], tolerance)+fit(points[i:], tolerance)


def circular_segments(points, tolerance):
    if len(points) < 32:
        return None
    local = points - points.mean(axis=0)
    system = np.column_stack((2*local, np.ones(len(local))))
    solution = np.linalg.lstsq(system, (local**2).sum(axis=1), rcond=None)[0]
    center = points.mean(axis=0) + solution[:2]
    vectors = points - center
    distances = np.linalg.norm(vectors, axis=1)
    radius = distances.mean()
    residual = abs(distances-radius)
    if radius < 6 or residual.max() > min(.85, tolerance) or residual.std() > .35:
        return None
    area = cv2.contourArea(local.astype(np.float32), oriented=True)
    if abs(abs(area)/(np.pi*radius**2)-1) > .04:
        return None
    count = 4
    while .000273*radius*(4/count)**6 > min(.02, tolerance*.1):
        count *= 2
    step = np.sign(area)*2*np.pi/count
    angles = step*np.arange(count)
    radial = np.column_stack((np.cos(angles), np.sin(angles)))
    anchors = center + radius*radial
    handles = radius*(4/3)*np.tan(step/4)*radial[:, ::-1]*[-1, 1]
    return np.stack((anchors, anchors+handles, np.roll(anchors-handles,-1,axis=0),
                     np.roll(anchors,-1,axis=0)),axis=1).round(5).tolist()


def ring(contour, cfg):
    p = contour[:, 0].astype(float)+np.array(cfg['origin'])+.5
    eps = (.45+cfg['smooth']/25)/(1+cfg['detail']/40)
    circle = circular_segments(p, eps)
    if circle is not None:
        return circle
    approx = cv2.approxPolyDP(contour, max(2, eps*3), True)[:, 0]
    cuts = {0, len(p)//2}
    if cfg.get('corners', True):
        for i, v in enumerate(approx):
            a, b = approx[i-1]-v, approx[(i+1)%len(approx)]-v
            if a@b > -.75*np.linalg.norm(a)*np.linalg.norm(b):
                cuts.add(int(np.flatnonzero((contour[:, 0]==v).all(axis=1))[0]))
    p = np.vstack([p,p[0]])
    ends = sorted(cuts|{len(p)-1})
    return np.asarray([c for a,b in zip(ends,ends[1:]) for c in fit(p[a:b+1],eps)]).round(5).tolist()


def vectorize(cfg):
    h,w = cfg['shape']
    rgba = np.frombuffer(base64.b64decode(cfg['rgba']), np.uint8).reshape(h,w,4)
    rgb = np.ascontiguousarray(rgba[:,:,:3])
    roi = np.frombuffer(base64.b64decode(cfg['mask']),np.uint8).reshape(h,w)>0
    mode = cfg['mode']
    if mode=='Color':
        mask = np.max(abs(rgb.astype(int)-cfg['color']),axis=2)<=cfg['tol']
    elif mode=='Edge':
        edge = cv2.Canny(cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY),cfg['edge'],2*cfg['edge'])
        mask = cv2.morphologyEx(edge,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))>0
    else:
        if (rgba[:,:,3]==0).any():
            mask = rgba[:,:,3]>0
        else:
            padded=cv2.copyMakeBorder(rgb,2,2,2,2,cv2.BORDER_REPLICATE)
            labels=np.zeros(padded.shape[:2],np.uint8)
            cv2.grabCut(padded,labels,(2,2,w,h),None,None,4,cv2.GC_INIT_WITH_RECT)
            mask=(labels[2:-2,2:-2]&1)>0
    valid = rgba[:,:,3]>0
    if mode=="Edge":
        valid = cv2.dilate(valid.astype(np.uint8),np.ones((3,3),np.uint8))>0
    mask &= roi & valid
    if cfg.get('seed') is not None:
        x,y=cfg['seed']
        _,labels=cv2.connectedComponents(mask.astype(np.uint8))
        mask &= labels==labels[y,x]
    contours,hierarchy=cv2.findContours(mask.astype(np.uint8),cv2.RETR_CCOMP,cv2.CHAIN_APPROX_NONE)
    objects=[]
    for i,c in enumerate(contours):
        if hierarchy[0,i,3]>=0 or cv2.contourArea(c)<max(1,cfg['minimum']):
            continue
        loops=[ring(c,cfg)]
        j=hierarchy[0,i,2]
        while j>=0:
            if cv2.contourArea(contours[j])>=1:
                loops.append(ring(contours[j],cfg))
            j=hierarchy[0,j,0]
        objects.append(loops)
    return objects


if __name__=='__main__':
    json.dump(vectorize(json.load(sys.stdin)),sys.stdout,separators=(',',':'))



