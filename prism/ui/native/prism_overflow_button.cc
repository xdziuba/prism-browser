#include "prism/ui/native/prism_overflow_button.h"

#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kOverflowPath[] = {gfx::CANVAS_DIMENSIONS,
                                              20,
                                              gfx::STROKE,
                                              1.8f,
                                              gfx::MOVE_TO,
                                              5.5f,
                                              6.0f,
                                              gfx::LINE_TO,
                                              9.0f,
                                              10.0f,
                                              gfx::LINE_TO,
                                              5.5f,
                                              14.0f,
                                              gfx::MOVE_TO,
                                              10.5f,
                                              6.0f,
                                              gfx::LINE_TO,
                                              14.0f,
                                              10.0f,
                                              gfx::LINE_TO,
                                              10.5f,
                                              14.0f};
const gfx::VectorIconRep kOverflowReps[] = {{kOverflowPath}};
constexpr gfx::VectorIcon kOverflowIcon = {kOverflowReps, 1,
                                           "prism-toolbar-overflow"};

}  // namespace

PrismOverflowButton::PrismOverflowButton() {
  SetVectorIcons(kOverflowIcon, kOverflowIcon);
  SetFlipCanvasOnPaintForRTLUI(true);
}

PrismOverflowButton::~PrismOverflowButton() = default;

void PrismOverflowButton::PaintButtonContents(gfx::Canvas* canvas) {
  OverflowButton::PaintButtonContents(canvas);
  PaintPrismNavigationSurface(*this, canvas);
}

BEGIN_METADATA(PrismOverflowButton)
END_METADATA
