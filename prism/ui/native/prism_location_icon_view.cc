#include "prism/ui/native/prism_location_icon_view.h"

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/background.h"

PrismLocationIconView::PrismLocationIconView(
    const gfx::FontList& font_list,
    IconLabelBubbleView::Delegate* parent_delegate,
    LocationIconView::Delegate* delegate)
    : LocationIconView(font_list, parent_delegate, delegate) {}

PrismLocationIconView::~PrismLocationIconView() = default;

bool PrismLocationIconView::UsePrismMaterial() const {
  const ui::ColorProvider* colors = GetColorProvider();
  if (!colors || GetNativeTheme()->preferred_contrast() ==
                     ui::NativeTheme::PreferredContrast::kMore) {
    return false;
  }

  const SkColor toolbar = colors->GetColor(kColorToolbar);
  return toolbar == SkColorSetRGB(0x2C, 0x39, 0x42) ||
         toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
}

gfx::RoundedCornersF PrismLocationIconView::GetCornerRadii() const {
  if (UsePrismMaterial()) {
    return gfx::RoundedCornersF(9.0f);
  }
  return LocationIconView::GetCornerRadii();
}

void PrismLocationIconView::OnPaintBackground(gfx::Canvas* canvas) {
  LocationIconView::OnPaintBackground(canvas);

  const views::Background* background = GetBackground();
  if (!UsePrismMaterial() || !GetShowText() || !background ||
      background->color() == SK_ColorTRANSPARENT || width() < 28 ||
      height() < 20) {
    return;
  }

  const ui::ColorProvider* colors = GetColorProvider();
  if (background->color() ==
      colors->GetColor(kColorOmniboxSecurityChipDangerousBackground)) {
    return;
  }

  const bool dark =
      colors->GetColor(kColorToolbar) == SkColorSetRGB(0x2C, 0x39, 0x42);
  const gfx::RectF bounds(0.5f, 0.5f, width() - 1.0f, height() - 1.0f);
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  fill.setColor(dark ? SkColorSetRGB(0x34, 0x47, 0x52)
                     : SkColorSetRGB(0xE6, 0xF1, 0xF5));
  canvas->DrawRoundRect(bounds, 9.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xA0, 0x84, 0xA0, 0xAE)
                    : SkColorSetARGB(0xB0, 0xB0, 0xC8, 0xD3));
  canvas->DrawRoundRect(bounds, 9.0f, rim);

  rim.setColor(dark ? SkColorSetARGB(0x70, 0xD6, 0xE6, 0xEE)
                    : SkColorSetARGB(0xC0, 0xFF, 0xFF, 0xFF));
  canvas->DrawLine(gfx::PointF(9.0f, 1.5f), gfx::PointF(width() - 9.0f, 1.5f),
                   rim);
}

BEGIN_METADATA(PrismLocationIconView)
END_METADATA
