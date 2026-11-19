var slvSource, slvPreview, slvEmbedded, slvDoc;
function slvRead(){
 try{
 var d=app.activeDocument,s=d.selection;
 if(s.length!=1 || !/^(PlacedItem|RasterItem)$/.test(s[0].typename))throw Error("Select one PNG/JPG or embedded raster.");
 slvDoc=d;slvSource=s[0];slvEmbedded=slvSource.typename=="RasterItem";
 if(!slvEmbedded)return slvSource.file.fsName;
 var tmp=app.documents.add(DocumentColorSpace.RGB),f=File(Folder.temp+"/slv-"+new Date().getTime()+".png");
 try{
 var item=slvSource.duplicate(tmp.layers[0],ElementPlacement.PLACEATBEGINNING);
 tmp.artboards[0].artboardRect=item.geometricBounds;
 var o=new ExportOptionsPNG24();o.artBoardClipping=true;o.transparency=true;
 tmp.exportFile(f,ExportType.PNG24,o);
 }finally{tmp.close(SaveOptions.DONOTSAVECHANGES);d.activate();}
 slvPreview=slvSource.geometricBounds.join(",");return f.fsName;
 }catch(e){return "ERROR "+e;}
}
function slvApply(objects,w,h,fill,stroke){
 var layer;
 try{
 var d=app.activeDocument;if(d!=slvDoc)throw Error("Reload selected image.");
 var s=slvSource,g=s.geometricBounds,m=s.matrix;
 if(slvEmbedded && g.join(",")!=slvPreview)throw Error("Reload moved raster.");
 var box=slvEmbedded?g:s.boundingBox;
 function point(p){
 var x=(p[0]/w-.5)*(box[2]-box[0]), y=(p[1]/h-.5)*(box[1]-box[3]);
 return [(g[0]+g[2])/2+(slvEmbedded?x:m.mValueA*x-m.mValueC*y),(g[1]+g[3])/2+(slvEmbedded?-y:-m.mValueB*x+m.mValueD*y)];
 }
 function color(v){var c=new RGBColor();c.red=parseInt(v.substr(1,2),16);c.green=parseInt(v.substr(3,2),16);c.blue=parseInt(v.substr(5,2),16);return c;}
 layer=d.layers.add();layer.name="Smart Local Vectorizer";
 for(var i=0;i<objects.length;i++){
 var loops=objects[i], container=loops.length>1?layer.compoundPathItems.add():layer;
 for(var j=0;j<loops.length;j++){
 var path=container.pathItems.add(),curves=loops[j];
 for(var k=0;k<curves.length;k++){
 var q=path.pathPoints.add();q.anchor=point(curves[k][0]);q.leftDirection=point(curves[(k+curves.length-1)%curves.length][2]);q.rightDirection=point(curves[k][1]);
 }
 path.closed=true;path.evenodd=true;path.filled=!!fill;if(fill)path.fillColor=color(fill);path.stroked=!!stroke;if(stroke)path.strokeColor=color(stroke);
 }}
 app.redraw();return "Applied "+objects.length+" objects";
 }catch(e){if(layer)layer.remove();return "ERROR "+e;}
}

