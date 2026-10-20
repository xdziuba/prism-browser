#include "prism/ui/native/prism_active_tab_path.h"

#include <algorithm>

#include "third_party/skia/include/core/SkMatrix.h"
#include "third_party/skia/include/core/SkPathBuilder.h"
#include "third_party/skia/include/core/SkRRect.h"

SkPath MakePrismActiveTabPath(const SkRect& bounds, const SkPoint& tab_origin,
                              float scale, bool render_in_dips) {
  const SkRect surface =
      SkRect::MakeLTRB(bounds.left() + scale, bounds.top() + scale,
                       bounds.right() - scale, bounds.bottom() - scale);
  if (surface.isEmpty()) {
    return SkPath();
  }

  const float max_radius = std::min(surface.width(), surface.height()) * 0.5f;
  const float top_radius = std::min(11.0f * scale, max_radius);
  const float bottom_radius = std::min(8.0f * scale, max_radius);
  const SkVector radii[4] = {
      SkVector(top_radius, top_radius),
      SkVector(top_radius, top_radius),
      SkVector(bottom_radius, bottom_radius),
      SkVector(bottom_radius, bottom_radius),
  };

  SkPathBuilder path;
  path.addRRect(SkRRect::MakeRectRadii(surface, radii));
  path.offset(-tab_origin.x(), -tab_origin.y());
  if (render_in_dips && scale != 1.0f) {
    path.transform(SkMatrix::Scale(1.0f / scale, 1.0f / scale));
  }
  return path.detach();
}
