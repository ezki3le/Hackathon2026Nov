// World units are widths of tile 12/2109/1403 (6.39 km). The local overview
// spans three tiles on each axis, with the original detailed tile at its centre.
const halfExtent = 1.5;
const gridSize = 768;
const reliefScale = 3 / 6390;

async function loadRaster(path) {
  const image = new Image();
  image.src = new URL(path, import.meta.url);
  await image.decode();
  const buffer = document.createElement('canvas');
  buffer.width = image.width;
  buffer.height = image.height;
  const context = buffer.getContext('2d');
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, image.width, image.height).data;
  return {image, size: image.width, rgba};
}

function interpolate(grid, size, x, y) {
  x = Math.max(0, Math.min(size - 1, x));
  y = Math.max(0, Math.min(size - 1, y));
  const i = Math.floor(x), j = Math.floor(y), k = j * size + i;
  const next = Math.min(i + 1, size - 1) - i, down = j < size - 1 ? size : 0;
  const a = grid[k] + (x - i) * (grid[k + next] - grid[k]);
  const b = grid[k + down] + (x - i) * (grid[k + down + next] - grid[k + down]);
  return a + (y - j) * (b - a);
}

function unpack(raster) {
  const rgb = raster.rgba;
  return Float32Array.from({length: raster.size ** 2}, (_, i) =>
    (rgb[4*i] * 256 + rgb[4*i+1] + rgb[4*i+2] / 256 - 32768 - 270) * reliefScale);
}

function blendEdges(detail, overview) {
  const size = detail.size;
  const buffer = document.createElement('canvas');
  buffer.width = buffer.height = size;
  const ctx = buffer.getContext('2d');
  ctx.drawImage(detail.image, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  for (const [x, y] of [[size, 0], [0, size]]) {
    const fade = ctx.createLinearGradient(0, 0, x, y);
    for (const [stop, color] of [[0,'transparent'], [.045,'black'], [.955,'black'], [1,'transparent']]) fade.addColorStop(stop, color);
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.globalCompositeOperation = 'destination-over';
  const third = overview.size / 3;
  ctx.drawImage(overview.image, third, third, third, third, 0, 0, size, size);
  return {image: buffer, size, rgba: ctx.getImageData(0, 0, size, size).data};
}

export async function loadTerrain() {
  const [photo, plan, widePhoto, widePlan, dem, wideDem] = await Promise.all([
    'vue-aerienne.jpg','plan.png','alentours-aerien.jpg','alentours-plan.jpg',
    'altitudes.png','alentours-altitudes.png'
  ].map(loadRaster));
  const local = unpack(dem), wide = unpack(wideDem);
  const grid = new Float32Array(gridSize ** 2);
  let low = Infinity, high = -Infinity;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const center = x >= 256 && x < 512 && y >= 256 && y < 512;
      const height = center ? local[(y - 256) * 256 + x - 256] :
        interpolate(wide, wideDem.size, (x + .5) / 2 - .5, (y + .5) / 2 - .5);
      grid[y * gridSize + x] = height;
      low = Math.min(low, height);
      high = Math.max(high, height);
    }
  }
  return {
    aerial: {detail: blendEdges(photo, widePhoto), overview: widePhoto},
    plan: {detail: blendEdges(plan, widePlan), overview: widePlan},
    height: (u, v) => interpolate(grid, gridSize, (u + halfExtent) * 256 - .5, (v + halfExtent) * 256 - .5),
    low, high
  };
}

// Clip the ray origin + distance * direction to one axis of the dataset.
function clipAxis(range, origin, direction) {
  if (Math.abs(direction) < 1e-8) return Math.abs(origin) <= halfExtent;
  const first = (-halfExtent - origin) / direction, last = (halfExtent - origin) / direction;
  range[0] = Math.max(range[0], Math.min(first, last));
  range[1] = Math.min(range[1], Math.max(first, last));
  return range[0] < range[1];
}

export function drawMap(ctx, data, layer, camera, zoom) {
  const {w, h, scale, a, b, c, s} = camera;
  const {detail, overview} = data[layer];
  const showDetail = zoom > .65;
  if (!s) {
    ctx.clearRect(0, 0, w, h);
    const span = 3 * scale;
    ctx.drawImage(overview.image, (w-span)/2, (h-span)/2, span, span);
    if (showDetail) ctx.drawImage(detail.image, (w-scale)/2, (h-scale)/2, scale, scale);
    return;
  }
  // A screen column cuts a profile through the height field at the current bearing.
  // Rasterise from far to near so that nearer terrain occludes the slopes behind it.
  const frame = ctx.createImageData(w, h), out = frame.data;
  const far = (-h/(2*scale) + data.low*s)/c, near = (h/(2*scale) + data.high*s)/c;
  const step = Math.max(1/256, 1.5/scale);
  for (let x = 0; x < w; x++) {
    const cross = (x+.5-w/2)/scale;
    const u0 = cross*a, v0 = -cross*b, range = [far, near];
    if (!clipAxis(range,u0,b) || !clipAxis(range,v0,a)) continue;
    let q = range[0], elevation = data.height(u0+b*q,v0+a*q);
    let y = h/2 + scale*(c*q-s*elevation);
    while (q < range[1]) {
      const next = Math.min(range[1], q+step);
      const z = data.height(u0+b*next,v0+a*next);
      const end = h/2 + scale*(c*next-s*z);
      const startRow = Math.max(0,Math.ceil(y-.5)), endRow = Math.min(h,Math.ceil(end-.5));
      if (startRow < endRow) {
        const light = 1 + s*Math.max(-.32,Math.min(.24,.5*(z-elevation)/(next-q)));
        const dq = (next-q)/(end-y);
        let sample = q + (startRow+.5-y)*dq;
        for (let row=startRow; row<endRow; row++,sample+=dq) {
          const u = u0+b*sample, v = v0+a*sample;
          const central = showDetail && Math.abs(u)<.5 && Math.abs(v)<.5;
          const raster = central ? detail : overview;
          const span = central ? 1 : 3, size = raster.size;
          const tx = Math.max(0,Math.min(size-1,Math.floor((u/span+.5)*size)));
          const ty = Math.max(0,Math.min(size-1,Math.floor((v/span+.5)*size)));
          const src = 4*(ty*size+tx), dst = 4*(row*w+x);
          out[dst] = raster.rgba[src]*light;
          out[dst+1] = raster.rgba[src+1]*light;
          out[dst+2] = raster.rgba[src+2]*light;
          out[dst+3] = 255;
        }
      }
      q=next; elevation=z; y=end;
    }
  }
  ctx.putImageData(frame,0,0);
}
