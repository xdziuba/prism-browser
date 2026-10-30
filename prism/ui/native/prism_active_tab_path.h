#ifndef PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_
#define PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_

#include "third_party/skia/include/core/SkPath.h"
#include "third_party/skia/include/core/SkPoint.h"
#include "third_party/skia/include/core/SkRect.h"

namespace gfx {
class Canvas;
class Rect;
}  // namespace gfx

// Builds the active tab's visual outline in tab-local render units. Hit testing
// remains Chromium-owned and does not use this path.
SkPath MakePrismActiveTabPath(const SkRect& bounds,
                              const SkPoint& tab_origin,
                              float scale,
                              bool render_in_dips);

// Builds the visual highlight of an ordinary inactive tab. The hit path stays
// Chromium-owned and wider than this surface.
SkPath MakePrismInactiveTabHighlightPath(const SkRect& bounds,
                                         const SkPoint& tab_origin,
                                         float scale,
                                         bool render_in_dips);

// Adds light inside Chromium's already-clipped active-tab fill. The caller
// decides whether the tab and resolved color are eligible for Prism styling.
void PaintPrismActiveTabMaterial(gfx::Canvas* canvas,
                                 const gfx::Rect& bounds,
                                 bool dark);

#endif  // PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_
