#include "prism/ui/native/prism_navigation_surface.h"

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"

void PaintPrismNavigationSurface(const ToolbarButton& button,
                                 gfx::Canvas* canvas,
                                 bool in_navigation_rail) {
  const ui::ColorProvider* colors = button.GetColorProvider();
  if (!colors || button.width() < 16 || button.height() < 16) {
    return;
  }

  const SkColor toolbar = colors->GetColor(kColorToolbar);
  const bool dark = toolbar == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  if (in_navigation_rail &&
      (button.GetState() == ToolbarButton::STATE_NORMAL ||
       button.GetState() == ToolbarButton::STATE_DISABLED)) {
    return;
  }

  const gfx::RectF capsule(3.5f, 3.0f, button.width() - 7.0f,
                           button.height() - 6.0f);
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  switch (button.GetState()) {
    case ToolbarButton::STATE_HOVERED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x48, 0x61, 0x6F)
                         : SkColorSetARGB(0xFF, 0xDF, 0xEB, 0xF0));
      break;
    case ToolbarButton::STATE_PRESSED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x5C, 0x77, 0x85)
                         : SkColorSetARGB(0xFF, 0xC8, 0xDC, 0xE6));
      break;
    case ToolbarButton::STATE_NORMAL:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x36, 0x49, 0x54)
                         : SkColorSetARGB(0xFF, 0xEB, 0xF3, 0xF6));
      break;
    case ToolbarButton::STATE_DISABLED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x31, 0x40, 0x49)
                         : SkColorSetARGB(0xFF, 0xF2, 0xF6, 0xF8));
      break;
    case ToolbarButton::STATE_COUNT:
      return;
  }
  canvas->DrawRoundRect(capsule, 11.0f, fill);

  cc::PaintFlags edge;
  edge.setAntiAlias(true);
  edge.setStyle(cc::PaintFlags::kStroke_Style);
  edge.setStrokeWidth(1.0f);
  edge.setColor(dark ? SkColorSetARGB(0xB0, 0x84, 0xA0, 0xAE)
                     : SkColorSetARGB(0xB0, 0xB0, 0xC8, 0xD3));
  canvas->DrawRoundRect(capsule, 11.0f, edge);
}
