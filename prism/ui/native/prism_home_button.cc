#include "prism/ui/native/prism_home_button.h"

#include <utility>

#include "prism/ui/native/prism_navigation_surface.h"
#include "prism/ui/native/prism_toolbar_icons.h"
#include "ui/base/metadata/metadata_impl_macros.h"

PrismHomeButton::PrismHomeButton(BrowserWindowInterface *browser,
                                 PressedCallback callback)
    : HomeButton(browser, std::move(callback)) {
  SetVectorIcons(kPrismHomeIcon, kPrismHomeIcon);
}

PrismHomeButton::~PrismHomeButton() = default;

void PrismHomeButton::PaintButtonContents(gfx::Canvas *canvas) {
  HomeButton::PaintButtonContents(canvas);
  PaintPrismNavigationSurface(*this, canvas);
}

BEGIN_METADATA(PrismHomeButton)
END_METADATA
