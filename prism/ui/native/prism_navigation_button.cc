#include "prism/ui/native/prism_navigation_button.h"

#include <utility>

#include "prism/ui/native/prism_navigation_surface.h"
#include "prism/ui/native/prism_toolbar_icons.h"
#include "ui/base/metadata/metadata_impl_macros.h"

PrismNavigationButton::PrismNavigationButton(Direction direction,
                                             PressedCallback callback,
                                             BrowserWindowInterface *browser)
    : BackForwardButton(direction, std::move(callback), browser) {
  const gfx::VectorIcon &icon =
      direction == Direction::kBack ? kPrismBackIcon : kPrismForwardIcon;
  SetVectorIcons(icon, icon);
}

PrismNavigationButton::~PrismNavigationButton() = default;

void PrismNavigationButton::PaintButtonContents(gfx::Canvas *canvas) {
  PaintPrismNavigationSurface(*this, canvas, /*in_navigation_rail=*/true);
}

BEGIN_METADATA(PrismNavigationButton)
END_METADATA
