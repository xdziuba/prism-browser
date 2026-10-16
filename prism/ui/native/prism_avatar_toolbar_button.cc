#include "prism/ui/native/prism_avatar_toolbar_button.h"

#include "prism/ui/native/prism_navigation_surface.h"
#include "ui/base/metadata/metadata_impl_macros.h"

PrismAvatarToolbarButton::PrismAvatarToolbarButton(
    BrowserWindowInterface* browser)
    : AvatarToolbarButton(browser) {}

PrismAvatarToolbarButton::~PrismAvatarToolbarButton() = default;

void PrismAvatarToolbarButton::PaintButtonContents(gfx::Canvas* canvas) {
  AvatarToolbarButton::PaintButtonContents(canvas);
  if (!IsLabelPresentAndVisible()) {
    PaintPrismNavigationSurface(*this, canvas);
  }
}

BEGIN_METADATA(PrismAvatarToolbarButton)
END_METADATA
