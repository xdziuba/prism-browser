#include "prism/ui/native/prism_navigation_rail_background.h"

#include "cc/paint/paint_flags.h"
#include "cc/paint/paint_shader.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/views/toolbar/toolbar_button.h"
#include "chrome/browser/ui/views/toolbar/toolbar_view.h"
#include "prism/ui/native/prism_navigation_rail.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/ui_base_features.h"
#include "ui/color/color_id.h"
#include "ui/color/color_provider.h"
#include "ui/color/color_provider_key.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/scoped_canvas.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/widget/widget.h"

namespace {

void PaintPrismToolbarMaterial(const PrismNavigationRailBackground &background,
                               const views::View &view, gfx::Canvas *canvas) {
  const ui::ColorProvider *colors = view.GetColorProvider();
  if (!background.is_visible() || !colors || features::IsGlassFrameEnabled() ||
      !view.GetNativeTheme() ||
      view.GetNativeTheme()->preferred_contrast() !=
          ui::NativeTheme::PreferredContrast::kNoPreference ||
      view.GetNativeTheme()->prefers_reduced_transparency() ||
      view.GetNativeTheme()->forced_colors() !=
          ui::ColorProviderKey::ForcedColors::kNone ||
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

  const bool active =
      !view.GetWidget() || view.GetWidget()->ShouldPaintAsActive();
  cc::PaintFlags frame;
  frame.setColor(colors->GetColor(active ? ui::kColorFrameActive
                                         : ui::kColorFrameInactive));
  canvas->DrawRect(gfx::RectF(view.GetLocalBounds()), frame);

  const gfx::RectF capsule(4.0f, 3.0f, view.width() - 8.0f,
                           view.height() - 8.0f);
  constexpr float kCapsuleRadius = 15.0f;
  cc::PaintFlags shadow;
  shadow.setAntiAlias(true);
  shadow.setColor(dark ? SkColorSetARGB(0x68, 0x0A, 0x16, 0x1D)
                       : SkColorSetARGB(0x36, 0x68, 0x84, 0x91));
  gfx::RectF shadow_bounds = capsule;
  shadow_bounds.Offset(0, 1.0f);
  canvas->DrawRoundRect(shadow_bounds, kCapsuleRadius, shadow);

  const SkPoint vertical[2] = {SkPoint::Make(0, capsule.y()),
                               SkPoint::Make(0, capsule.bottom())};
  const float vertical_stops[3] = {0.0f, 0.42f, 1.0f};
  const SkColor4f surface[3] = {
      SkColor4f::FromColor(dark ? SkColorSetRGB(0x44, 0x55, 0x60)
                                : SkColorSetRGB(0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(dark ? SkColorSetRGB(0x34, 0x44, 0x4E)
                                : SkColorSetRGB(0xF5, 0xF9, 0xFB)),
      SkColor4f::FromColor(dark ? SkColorSetRGB(0x29, 0x38, 0x42)
                                : SkColorSetRGB(0xE4, 0xEE, 0xF3)),
  };
  cc::PaintFlags flags;
  flags.setAntiAlias(true);
  flags.setShader(cc::PaintShader::MakeLinearGradient(
      vertical, surface, vertical_stops, 3, SkTileMode::kClamp));
  canvas->DrawRoundRect(capsule, kCapsuleRadius, flags);

  cc::PaintFlags edge;
  edge.setAntiAlias(true);
  edge.setStyle(cc::PaintFlags::kStroke_Style);
  edge.setStrokeWidth(1.0f);
  edge.setColor(dark ? SkColorSetARGB(0x78, 0xA7, 0xC0, 0xCC)
                     : SkColorSetARGB(0xA0, 0xB0, 0xC6, 0xD0));
  canvas->DrawRoundRect(capsule, kCapsuleRadius, edge);

  const SkPoint horizontal[2] = {SkPoint::Make(capsule.x(), 0),
                                 SkPoint::Make(capsule.right(), 0)};
  const float rim_stops[3] = {0.0f, 0.42f, 1.0f};
  const SkColor4f rim[3] = {
      SkColor4f::FromColor(SkColorSetARGB(0, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(dark ? SkColorSetARGB(0x72, 0xCE, 0xE7, 0xF1)
                                : SkColorSetARGB(0xE0, 0xFF, 0xFF, 0xFF)),
      SkColor4f::FromColor(SkColorSetARGB(0, 0xFF, 0xFF, 0xFF)),
  };
  flags.setShader(cc::PaintShader::MakeLinearGradient(
      horizontal, rim, rim_stops, 3, SkTileMode::kClamp));
  canvas->DrawRoundRect(
      gfx::RectF(capsule.x() + 1, capsule.y() + 1, capsule.width() - 2, 1),
      0.5f, flags);
}

} // namespace

PrismNavigationRailBackground::PrismNavigationRailBackground(
    ToolbarView &toolbar, BrowserView &browser_view)
    : CustomCornersBackground(toolbar, browser_view,
                              CustomCornersBackground::ToolbarTheme(),
                              CustomCornersBackground::FrameTheme()) {}

PrismNavigationRailBackground::~PrismNavigationRailBackground() = default;

void PrismNavigationRailBackground::SetButtons(ToolbarButton *back,
                                               ToolbarButton *forward,
                                               ToolbarButton *reload) {
  back_ = back;
  forward_ = forward;
  reload_ = reload;
}

void PrismNavigationRailBackground::Paint(gfx::Canvas *canvas,
                                          views::View *view) const {
  CustomCornersBackground::Paint(canvas, view);
  PaintPrismToolbarMaterial(*this, *view, canvas);
  PaintPrismNavigationRail(*view, back_, forward_, reload_, canvas);
}
