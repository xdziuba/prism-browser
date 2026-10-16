#include "prism/ui/native/prism_browser_app_menu_button.h"

#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/image_model.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kMenuPath[] = {gfx::CANVAS_DIMENSIONS,
                                          20,
                                          gfx::STROKE,
                                          1.8f,
                                          gfx::MOVE_TO,
                                          5.0f,
                                          6.0f,
                                          gfx::LINE_TO,
                                          15.0f,
                                          6.0f,
                                          gfx::MOVE_TO,
                                          5.0f,
                                          10.0f,
                                          gfx::LINE_TO,
                                          15.0f,
                                          10.0f,
                                          gfx::MOVE_TO,
                                          5.0f,
                                          14.0f,
                                          gfx::LINE_TO,
                                          12.5f,
                                          14.0f};
const gfx::VectorIconRep kMenuReps[] = {{kMenuPath}};
constexpr gfx::VectorIcon kMenuIcon = {kMenuReps, 1, "prism-app-menu"};

}  // namespace

PrismBrowserAppMenuButton::PrismBrowserAppMenuButton(ToolbarView* toolbar_view)
    : BrowserAppMenuButton(toolbar_view) {}

PrismBrowserAppMenuButton::~PrismBrowserAppMenuButton() = default;

void PrismBrowserAppMenuButton::UpdateIcon() {
  BrowserAppMenuButton::UpdateIcon();
  if (IsLabelPresentAndVisible()) {
    return;
  }

  for (auto state : kButtonStates) {
    SetImageModel(state,
                  ui::ImageModel::FromVectorIcon(
                      kMenuIcon, ToolbarButton::GetForegroundColor(state),
                      GetIconSize()));
  }
}

void PrismBrowserAppMenuButton::PaintButtonContents(gfx::Canvas* canvas) {
  BrowserAppMenuButton::PaintButtonContents(canvas);
  if (!IsLabelPresentAndVisible()) {
    PaintPrismNavigationSurface(*this, canvas);
  }
}

BEGIN_METADATA(PrismBrowserAppMenuButton)
END_METADATA
