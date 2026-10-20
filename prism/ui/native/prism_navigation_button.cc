#include "prism/ui/native/prism_navigation_button.h"

#include <utility>

#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kBackPath[] = {gfx::CANVAS_DIMENSIONS,
                                          20,
                                          gfx::STROKE,
                                          1.8f,
                                          gfx::MOVE_TO,
                                          14,
                                          10,
                                          gfx::LINE_TO,
                                          6,
                                          10,
                                          gfx::MOVE_TO,
                                          10,
                                          6,
                                          gfx::LINE_TO,
                                          6,
                                          10,
                                          gfx::LINE_TO,
                                          10,
                                          14};
const gfx::VectorIconRep kBackReps[] = {{kBackPath}};
constexpr gfx::VectorIcon kBackIcon = {kBackReps, 1, "prism-back"};

constexpr gfx::PathElement kForwardPath[] = {gfx::CANVAS_DIMENSIONS,
                                             20,
                                             gfx::STROKE,
                                             1.8f,
                                             gfx::MOVE_TO,
                                             6,
                                             10,
                                             gfx::LINE_TO,
                                             14,
                                             10,
                                             gfx::MOVE_TO,
                                             10,
                                             6,
                                             gfx::LINE_TO,
                                             14,
                                             10,
                                             gfx::LINE_TO,
                                             10,
                                             14};
const gfx::VectorIconRep kForwardReps[] = {{kForwardPath}};
constexpr gfx::VectorIcon kForwardIcon = {kForwardReps, 1, "prism-forward"};

}  // namespace

PrismNavigationButton::PrismNavigationButton(Direction direction,
                                             PressedCallback callback,
                                             BrowserWindowInterface* browser)
    : BackForwardButton(direction, std::move(callback), browser) {
  const gfx::VectorIcon& icon =
      direction == Direction::kBack ? kBackIcon : kForwardIcon;
  SetVectorIcons(icon, icon);
}

PrismNavigationButton::~PrismNavigationButton() = default;

void PrismNavigationButton::PaintButtonContents(gfx::Canvas* canvas) {
  PaintPrismNavigationSurface(*this, canvas, /*in_navigation_rail=*/true);
}

BEGIN_METADATA(PrismNavigationButton)
END_METADATA
