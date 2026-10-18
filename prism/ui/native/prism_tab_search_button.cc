#include "prism/ui/native/prism_tab_search_button.h"

#include <algorithm>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/views/frame/glass_frame_service.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/models/image_model.h"
#include "ui/color/color_id.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kTabSearchPath[] = {gfx::CANVAS_DIMENSIONS,
                                               16,
                                               gfx::STROKE,
                                               1.45f,
                                               gfx::MOVE_TO,
                                               2.3f,
                                               2.7f,
                                               gfx::LINE_TO,
                                               10.5f,
                                               2.7f,
                                               gfx::LINE_TO,
                                               10.5f,
                                               5.0f,
                                               gfx::MOVE_TO,
                                               3.8f,
                                               4.2f,
                                               gfx::LINE_TO,
                                               3.8f,
                                               10.5f,
                                               gfx::LINE_TO,
                                               6.4f,
                                               10.5f,
                                               gfx::CIRCLE,
                                               9.6f,
                                               9.2f,
                                               2.5f,
                                               gfx::MOVE_TO,
                                               11.5f,
                                               11.1f,
                                               gfx::LINE_TO,
                                               14.1f,
                                               13.7f};
constexpr gfx::VectorIconRep kTabSearchReps[] = {{kTabSearchPath}};
constexpr gfx::VectorIcon kTabSearchIcon = {kTabSearchReps, 1,
                                            "prism-tab-search"};

}  // namespace

PrismTabSearchButton::PrismTabSearchButton(BrowserWindowInterface* browser)
    : browser_(browser) {}

PrismTabSearchButton::~PrismTabSearchButton() = default;

void PrismTabSearchButton::UpdateIcon(const ui::ImageModel&) {
  TabStripFlatEdgeButton::UpdateIcon(
      ui::ImageModel::FromVectorIcon(kTabSearchIcon));
}

bool PrismTabSearchButton::PaintPrismSurface() const {
  const ui::ColorProvider* colors = GetColorProvider();
  if (!colors || paint_transparent_for_testing() || width() < 16 ||
      height() < 16) {
    return false;
  }
  const SkColor frame = colors->GetColor(ui::kColorFrameActive);
  const bool prism_frame = frame == SkColorSetRGB(0x1C, 0x29, 0x32) ||
                           frame == SkColorSetRGB(0xE2, 0xEB, 0xF0);
  auto* const glass_frame_service = GlassFrameService::GetInstance();
  return prism_frame &&
         !(glass_frame_service &&
           glass_frame_service->IsBrowserWindowEligible(browser_));
}

void PrismTabSearchButton::OnPaintBackground(gfx::Canvas* canvas) {
  if (!PaintPrismSurface()) {
    TabStripFlatEdgeButton::OnPaintBackground(canvas);
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
