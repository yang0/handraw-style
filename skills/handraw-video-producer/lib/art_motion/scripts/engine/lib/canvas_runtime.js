// Use a stable raster backend from first render. Texture readback must never switch
// a cached canvas from GPU to CPU between cold render, seek, QA and final encoding.
(() => {
 const get=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(kind,options){
  return get.call(this,kind,kind==='2d'?{...(options||{}),willReadFrequently:true}:options);
 };
})();
