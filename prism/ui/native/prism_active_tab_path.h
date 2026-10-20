#ifndef PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_
#define PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_

#include "third_party/skia/include/core/SkPath.h"
#include "third_party/skia/include/core/SkPoint.h"
#include "third_party/skia/include/core/SkRect.h"

// Builds the active tab's visual outline in tab-local render units. Hit testing
// remains Chromium-owned and does not use this path.
SkPath MakePrismActiveTabPath(const SkRect& bounds, const SkPoint& tab_origin,
                              float scale, bool render_in_dips);

#endif  // PRISM_UI_NATIVE_PRISM_ACTIVE_TAB_PATH_H_
