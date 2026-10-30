#include "prism/ui/native/prism_navigation_rail_background.h"

#include "cc/paint/paint_flags.h"
#include "cc/paint/paint_shader.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "chrome/browser/ui/views/toolbar/toolbar_view.h"
#include "prism/ui/native/prism_navigation_rail.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/ui_base_features.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/scoped_canvas.h"
#include "ui/native_theme/native_theme.h"

namespace {

void PaintPrismToolbarMaterial(const PrismNavigationRailBackground& background,
                               const views::View& view,
                               gfx::Canvas* canvas) {
  const ui::ColorProvider* colors = view.GetColorProvider();
  if (!background.is_visible() || !colors || features::IsGlassFrameEnabled() ||
      view.GetNativeTheme()->preferred_contrast() ==
          ui::NativeTheme::PreferredContrast::kMore ||
      view.height() < 24) {
    return;
  }

  const SkColor toolbar_color = colors->GetColor(kColorToolbar);
  const bool dark = toolbar_color == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar_color == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  gfx::ScopedCanvas scope(canvas);
  canvas->ClipPath(background.GetBackgroundPath(), true);

  const SkPoint vertical[2] = {SkPoint::Make(0, 0),
                               SkPoint::Make(0, view.height())};
  const float vertical_stops[3] = {0.0f, 0.48f, 1.0f};
  const SkColor4f surface[3] = {
      SkColor4f::FromColor(dark ? SkColorSetARGB(0x24, 0xFF, 0xFF, 0xFF)
                                : SkColorSetARGB(0xD0, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(dark ? SkColorSetARGB(0x09, 0xB8, 0xD4, 0xE1)
                                : SkColorSetARGB(0x18, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(dark ? SkColorSetARGB(0x0E, 0, 0, 0)
                                : SkColorSetARGB(0x12, 0x6F, 0x9E, 0xB9)),
  };
  cc::PaintFlags flags;
  flags.setShader(cc::PaintShader::MakeLinearGradient(
      vertical, surface, vertical_stops, 3, SkTileMode::kClamp));
  canvas->DrawRect(gfx::RectF(view.GetLocalBounds()), flags);

  const SkPoint horizontal[2] = {SkPoint::Make(0, 0),
                                 SkPoint::Make(view.width(), 0)};
  const float rim_stops[3] = {0.0f, 0.42f, 1.0f};
  const SkColor4f rim[3] = {
      SkColor4f::FromColor(SkColorSetARGB(0, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(dark ? SkColorSetARGB(0x72, 0xCE, 0xE7, 0xF1)
                                : SkColorSetARGB(0xE0, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(SkColorSetARGB(0, 0xFF, 0xFF, 0xFF)),
  };
  flags.setShader(cc::PaintShader::MakeLinearGradient(
      horizontal, rim, rim_stops, 3, SkTileMode::kClamp));
  canvas->DrawRect(gfx::RectF(0, 0, view.width(), 1.0f), flags);
}

}  // namespace

PrismNavigationRailBackground::PrismNavigationRailBackground(
    ToolbarView& toolbar,
    BrowserView& browser_view)
    : CustomCornersBackground(toolbar,
                              browser_view,
                              CustomCornersBackground::ToolbarTheme(),
                              CustomCornersBackground::FrameTheme()) {}

PrismNavigationRailBackground::~PrismNavigationRailBackground() = default;

void PrismNavigationRailBackground::SetButtons(ToolbarButton* back,
                                               ToolbarButton* forward,
                                               ToolbarButton* reload) {
  back_ = back;
  forward_ = forward;
  reload_ = reload;
}

void PrismNavigationRailBackground::Paint(gfx::Canvas* canvas,
                                          views::View* view) const {
  CustomCornersBackground::Paint(canvas, view);
  PaintPrismToolbarMaterial(*this, *view, canvas);
  PaintPrismNavigationRail(*view, back_, forward_, reload_, canvas);
}
