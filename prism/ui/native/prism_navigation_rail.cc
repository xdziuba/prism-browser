#include "prism/ui/native/prism_navigation_rail.h"

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/view.h"

void PaintPrismNavigationRail(const views::View& toolbar,
                              const ToolbarButton* back,
                              const ToolbarButton* forward,
                              const ToolbarButton* reload,
                              gfx::Canvas* canvas) {
  const ui::ColorProvider* colors = toolbar.GetColorProvider();
  if (!colors || toolbar.GetNativeTheme()->preferred_contrast() ==
                     ui::NativeTheme::PreferredContrast::kMore) {
    return;
  }

  const SkColor toolbar_color = colors->GetColor(kColorToolbar);
  const bool dark = toolbar_color == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar_color == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  if (!back || !reload || !back->GetVisible() || !reload->GetVisible() ||
      back->width() < 16 || reload->width() < 16) {
    return;
  }

  gfx::Rect bounds = back->bounds();
  if (forward && forward->GetVisible()) {
    bounds.Union(forward->bounds());
  }
  bounds.Union(reload->bounds());
  if (bounds.width() < 48 || bounds.width() > 200 || bounds.height() < 22) {
    return;
  }

  const gfx::RectF rail(bounds.x() + 1.0f, bounds.y() + 2.5f,
                        bounds.width() - 2.0f, bounds.height() - 5.0f);
  cc::PaintFlags paint;
  paint.setAntiAlias(true);
  paint.setColor(dark ? SkColorSetRGB(0x31, 0x44, 0x4E)
                      : SkColorSetRGB(0xE9, 0xF2, 0xF6));
  canvas->DrawRoundRect(rail, 13.0f, paint);

  paint.setStyle(cc::PaintFlags::kStroke_Style);
  paint.setStrokeWidth(1.0f);
  paint.setColor(dark ? SkColorSetARGB(0xA0, 0x84, 0xA0, 0xAE)
                      : SkColorSetARGB(0xC0, 0xB0, 0xC8, 0xD3));
  canvas->DrawRoundRect(rail, 13.0f, paint);
}
