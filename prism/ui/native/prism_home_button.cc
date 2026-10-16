#include "prism/ui/native/prism_home_button.h"

#include <utility>

#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kHomePath[] = {gfx::CANVAS_DIMENSIONS,
                                          20,
                                          gfx::STROKE,
                                          1.8f,
                                          gfx::MOVE_TO,
                                          3.8f,
                                          9.0f,
                                          gfx::LINE_TO,
                                          10.0f,
                                          4.0f,
                                          gfx::LINE_TO,
                                          16.2f,
                                          9.0f,
                                          gfx::MOVE_TO,
                                          5.5f,
                                          8.0f,
                                          gfx::LINE_TO,
                                          5.5f,
                                          15.5f,
                                          gfx::LINE_TO,
                                          14.5f,
                                          15.5f,
                                          gfx::LINE_TO,
                                          14.5f,
                                          8.0f,
                                          gfx::MOVE_TO,
                                          8.5f,
                                          15.5f,
                                          gfx::LINE_TO,
                                          8.5f,
                                          11.0f,
                                          gfx::LINE_TO,
                                          11.5f,
                                          11.0f,
                                          gfx::LINE_TO,
                                          11.5f,
                                          15.5f};
const gfx::VectorIconRep kHomeReps[] = {{kHomePath}};
constexpr gfx::VectorIcon kHomeIcon = {kHomeReps, 1, "prism-home"};

}  // namespace

PrismHomeButton::PrismHomeButton(BrowserWindowInterface* browser,
                                 PressedCallback callback)
    : HomeButton(browser, std::move(callback)) {
  SetVectorIcons(kHomeIcon, kHomeIcon);
}

PrismHomeButton::~PrismHomeButton() = default;

void PrismHomeButton::PaintButtonContents(gfx::Canvas* canvas) {
  HomeButton::PaintButtonContents(canvas);
  PaintPrismNavigationSurface(*this, canvas);
}

BEGIN_METADATA(PrismHomeButton)
END_METADATA
