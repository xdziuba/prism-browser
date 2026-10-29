#include "prism/ui/native/prism_tab_audio_button.h"

#include <algorithm>

#include "cc/paint/paint_flags.h"
#include "components/tabs/public/tab_alert.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_id.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"

PrismTabAudioButton::PrismTabAudioButton(Delegate* delegate)
    : AlertIndicatorButton(delegate) {}

PrismTabAudioButton::~PrismTabAudioButton() = default;

void PrismTabAudioButton::OnPaintBackground(gfx::Canvas* canvas) {
  AlertIndicatorButton::OnPaintBackground(canvas);
  const ui::ColorProvider* colors = GetColorProvider();
  const auto alert = showing_alert_state();
  if (!colors || !alert ||
      (*alert != tabs::TabAlert::kAudioPlaying &&
       *alert != tabs::TabAlert::kAudioMuting) ||
      (GetState() != views::Button::STATE_HOVERED &&
       GetState() != views::Button::STATE_PRESSED)) {
    return;
  }

  const SkColor frame = colors->GetColor(ui::kColorFrameActive);
  const bool dark = frame == SkColorSetRGB(0x1C, 0x29, 0x32);
  const bool light = frame == SkColorSetRGB(0xE2, 0xEB, 0xF0);
  if (!dark && !light) {
    return;
  }

  const float side = std::min(width(), height()) - 2.0f;
  if (side <= 0.0f) {
    return;
  }
  const gfx::RectF surface((width() - side) / 2.0f, (height() - side) / 2.0f,
                           side, side);
  const bool pressed = GetState() == views::Button::STATE_PRESSED;
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  fill.setColor(dark ? (pressed ? SkColorSetRGB(0x5D, 0x78, 0x86)
                                : SkColorSetRGB(0x45, 0x5D, 0x6A))
                     : (pressed ? SkColorSetRGB(0xC8, 0xDD, 0xE7)
                                : SkColorSetRGB(0xDF, 0xEC, 0xF2)));
  canvas->DrawRoundRect(surface, 5.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xA8, 0x88, 0xA3, 0xB1)
                    : SkColorSetARGB(0xA8, 0xB1, 0xC9, 0xD5));
  canvas->DrawRoundRect(surface, 5.0f, rim);
}

BEGIN_METADATA(PrismTabAudioButton)
END_METADATA
