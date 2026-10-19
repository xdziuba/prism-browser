#include "prism/ui/native/prism_omnibox_clear_button.h"

#include <algorithm>
#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/pointer/touch_ui_controller.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/animation/ink_drop.h"
#include "ui/views/controls/button/image_button_factory.h"

PrismOmniboxClearButton::PrismOmniboxClearButton(PressedCallback callback)
    : views::ImageButton(std::move(callback)) {
  views::ConfigureVectorImageButton(this);
  // Prism paints its own state surface; a second ink drop can cover the glyph
  // in forced contrast.
  views::InkDrop::Get(this)->SetMode(views::InkDropHost::InkDropMode::OFF);
}

PrismOmniboxClearButton::~PrismOmniboxClearButton() = default;

void PrismOmniboxClearButton::OnPaintBackground(gfx::Canvas* canvas) {
  views::ImageButton::OnPaintBackground(canvas);

  const ui::ColorProvider* colors = GetColorProvider();
  if (!colors || width() < 20 || height() < 20 ||
      ui::TouchUiController::Get()->touch_ui() ||
      (GetState() != views::Button::STATE_HOVERED &&
       GetState() != views::Button::STATE_PRESSED)) {
    return;
  }

  const float side = std::min(width(), height()) - 2.0f;
  const gfx::RectF surface((width() - side) / 2.0f, (height() - side) / 2.0f,
                           side, side);
  if (GetNativeTheme()->preferred_contrast() ==
      ui::NativeTheme::PreferredContrast::kMore) {
    cc::PaintFlags outline;
    outline.setAntiAlias(true);
    outline.setStyle(cc::PaintFlags::kStroke_Style);
    outline.setStrokeWidth(1.0f);
    outline.setColor(colors->GetColor(kColorLocationBarClearAllButtonIcon));
    canvas->DrawRoundRect(surface, 8.0f, outline);
    return;
  }

  const SkColor toolbar = colors->GetColor(kColorToolbar);
  const bool dark = toolbar == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  const bool pressed = GetState() == views::Button::STATE_PRESSED;
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  fill.setColor(dark ? (pressed ? SkColorSetRGB(0x5C, 0x77, 0x85)
                                : SkColorSetRGB(0x48, 0x61, 0x6F))
                     : (pressed ? SkColorSetRGB(0xC8, 0xDC, 0xE6)
                                : SkColorSetRGB(0xDF, 0xEB, 0xF0)));
  canvas->DrawRoundRect(surface, 8.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xB0, 0x84, 0xA0, 0xAE)
                    : SkColorSetARGB(0xB0, 0xB0, 0xC8, 0xD3));
  canvas->DrawRoundRect(surface, 8.0f, rim);
}

BEGIN_METADATA(PrismOmniboxClearButton)
END_METADATA
