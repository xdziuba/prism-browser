#include "prism/ui/native/prism_side_panel_header_button.h"

#include <algorithm>
#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/animation/ink_drop.h"
#include "ui/views/controls/button/image_button_factory.h"

namespace {

void ConfigurePrismButton(views::ImageButton* button) {
  views::ConfigureVectorImageButton(button);
  // The generic ink drop can cover the glyph in forced contrast.
  views::InkDrop::Get(button)->SetMode(views::InkDropHost::InkDropMode::OFF);
  button->SetHasInkDropActionOnClick(false);
}

void PaintPrismSurface(const views::Button& button, gfx::Canvas* canvas) {
  const ui::ColorProvider* colors = button.GetColorProvider();
  if (!colors || button.width() < 20 || button.height() < 20) {
    return;
  }

  const auto state = button.GetState();
  const bool active = state == views::Button::STATE_HOVERED ||
                      state == views::Button::STATE_PRESSED;
  const float side = std::min(button.width(), button.height()) - 4.0f;
  const gfx::RectF surface((button.width() - side) / 2.0f,
                           (button.height() - side) / 2.0f, side, side);
  const bool forced = button.GetNativeTheme()->preferred_contrast() ==
                      ui::NativeTheme::PreferredContrast::kMore;
  const SkColor toolbar = colors->GetColor(kColorToolbar);
  const bool dark = !forced && toolbar == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = !forced && toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    if (active) {
      cc::PaintFlags outline;
      outline.setAntiAlias(true);
      outline.setStyle(cc::PaintFlags::kStroke_Style);
      outline.setStrokeWidth(1.0f);
      outline.setColor(colors->GetColor(kColorSidePanelHeaderButtonIcon));
      canvas->DrawRoundRect(surface, 9.0f, outline);
    }
    return;
  }

  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  if (dark) {
    fill.setColor(state == views::Button::STATE_PRESSED
                      ? SkColorSetRGB(0x5C, 0x77, 0x85)
                  : active ? SkColorSetRGB(0x48, 0x61, 0x6F)
                           : SkColorSetRGB(0x36, 0x49, 0x54));
  } else {
    fill.setColor(state == views::Button::STATE_PRESSED
                      ? SkColorSetRGB(0xC8, 0xDC, 0xE6)
                  : active ? SkColorSetRGB(0xDF, 0xEB, 0xF0)
                           : SkColorSetRGB(0xEB, 0xF3, 0xF6));
  }
  canvas->DrawRoundRect(surface, 9.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xB0, 0x84, 0xA0, 0xAE)
                    : SkColorSetARGB(0xB0, 0xB0, 0xC8, 0xD3));
  canvas->DrawRoundRect(surface, 9.0f, rim);
}

}  // namespace

PrismSidePanelHeaderButton::PrismSidePanelHeaderButton(PressedCallback callback)
    : views::ImageButton(std::move(callback)) {
  ConfigurePrismButton(this);
}

PrismSidePanelHeaderButton::~PrismSidePanelHeaderButton() = default;

void PrismSidePanelHeaderButton::OnPaintBackground(gfx::Canvas* canvas) {
  views::ImageButton::OnPaintBackground(canvas);
  PaintPrismSurface(*this, canvas);
}

PrismSidePanelHeaderPinButton::PrismSidePanelHeaderPinButton(
    PressedCallback callback)
    : views::ToggleImageButton(std::move(callback)) {
  ConfigurePrismButton(this);
}

PrismSidePanelHeaderPinButton::~PrismSidePanelHeaderPinButton() = default;

void PrismSidePanelHeaderPinButton::OnPaintBackground(gfx::Canvas* canvas) {
  views::ToggleImageButton::OnPaintBackground(canvas);
  PaintPrismSurface(*this, canvas);
}

BEGIN_METADATA(PrismSidePanelHeaderButton)
END_METADATA

BEGIN_METADATA(PrismSidePanelHeaderPinButton)
END_METADATA
