// Экспоненциальное сглаживание точек (EMA). alpha: 1 = без сглаживания, меньше = плавнее.
export function createSmoother(alpha = 0.5) {
  let prev = null;
  return {
    reset() { prev = null; },
    next(points) {
      if (!points) { prev = null; return null; }
      if (!prev || prev.length !== points.length) {
        prev = points.map((p) => ({ ...p }));
        return prev;
      }
      prev = points.map((p, i) => ({
        x: prev[i].x + alpha * (p.x - prev[i].x),
        y: prev[i].y + alpha * (p.y - prev[i].y),
        z: prev[i].z + alpha * ((p.z ?? 0) - prev[i].z),
        visibility: p.visibility ?? 1,
      }));
      return prev;
    },
  };
}

// Селфи-вид: зеркалим по X, чтобы координаты совпадали с зеркальным видео на экране.
export function mirror(points) {
  return points?.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z ?? 0, visibility: p.visibility ?? 1 })) ?? null;
}
