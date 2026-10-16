#include "prism/ui/native/prism_new_tab_button.h"

#include <algorithm>
#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/views/frame/glass_frame_service.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/color/color_id.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/vector_icon_types.h"
#include "ui/views/background.h"

namespace {

constexpr gfx::PathElement kPlusPath[] = {gfx::CANVAS_DIMENSIONS,
                                          16,
                                          gfx::STROKE,
                                          1.7f,
                                          gfx::MOVE_TO,
                                          8,
                                          3.5f,
                                          gfx::LINE_TO,
                                          8,
                                          12.5f,
                                          gfx::MOVE_TO,
                                          3.5f,
                                          8,
                                          gfx::LINE_TO,
                                          12.5f,
                                          8};
const gfx::VectorIconRep kPlusReps[] = {{kPlusPath}};
constexpr gfx::VectorIcon kPlusIcon = {kPlusReps, 1, "prism-new-tab"};

} // namespace

PrismNewTabButton::PrismNewTabButton(PressedCallback callback,
                                     BrowserWindowInterface *browser)
    : NewTabButton(std::move(callback), kPlusIcon, Edge::kNone, Edge::kNone,
                   browser),
      browser_(browser) {}

PrismNewTabButton::~PrismNewTabButton() = default;

bool PrismNewTabButton::HasPrismFrame() const {
  const ui::ColorProvider *colors = GetColorProvider();
  if (!colors) {
    return false;
  }
  const SkColor frame = colors->GetColor(ui::kColorFrameActive);
  return frame == SkColorSetRGB(0x1C, 0x29, 0x32) ||
         frame == SkColorSetRGB(0xE2, 0xEB, 0xF0);
}

bool PrismNewTabButton::PaintPrismSurface() const {
  auto *const glass_frame_service = GlassFrameService::GetInstance();
  return HasPrismFrame() &&
         !(glass_frame_service &&
           glass_frame_service->IsBrowserWindowEligible(browser_));
}

void PrismNewTabButton::UpdateBackground() {
  if (!PaintPrismSurface()) {
    NewTabButton::UpdateBackground();
    return;
  }
  SetBackground(views::CreateSolidBackground(SK_ColorTRANSPARENT));
}

void PrismNewTabButton::OnPaintBackground(gfx::Canvas *canvas) {
  if (!PaintPrismSurface()) {
    NewTabButton::OnPaintBackground(canvas);
    return;
  }

  const bool dark = GetColorProvider()->GetColor(ui::kColorFrameActive) ==
                    SkColorSetRGB(0x1C, 0x29, 0x32);
  const float side = std::min(width(), height()) - 3.0f;
  const gfx::RectF surface((width() - side) / 2.0f, (height() - side) / 2.0f,
                           side, side);

  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  switch (GetState()) {
  case views::Button::STATE_HOVERED:
    fill.setColor(dark ? SkColorSetRGB(0x4A, 0x63, 0x70)
                       : SkColorSetRGB(0xF7, 0xFC, 0xFF));
    break;
  case views::Button::STATE_PRESSED:
    fill.setColor(dark ? SkColorSetRGB(0x5D, 0x78, 0x86)
                       : SkColorSetRGB(0xD2, 0xE3, 0xEB));
    break;
  default:
    fill.setColor(dark ? SkColorSetRGB(0x35, 0x49, 0x54)
                       : SkColorSetRGB(0xEC, 0xF5, 0xF9));
    break;
  }
  canvas->DrawRoundRect(surface, 10.0f, fill);

  cc::PaintFlags rim;
  rim.setAntiAlias(true);
  rim.setStyle(cc::PaintFlags::kStroke_Style);
  rim.setStrokeWidth(1.0f);
  rim.setColor(dark ? SkColorSetARGB(0xA8, 0x88, 0xA3, 0xB1)
                    : SkColorSetARGB(0xD0, 0xB5, 0xCD, 0xD9));
  canvas->DrawRoundRect(surface, 10.0f, rim);
}
