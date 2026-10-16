#include "prism/ui/native/prism_navigation_button.h"

#include <utility>

#include "cc/paint/paint_flags.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "third_party/skia/include/core/SkColor.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/color/color_provider.h"
#include "ui/gfx/canvas.h"
#include "ui/gfx/geometry/rect_f.h"
#include "ui/gfx/vector_icon_types.h"

namespace {

constexpr gfx::PathElement kBackPath[] = {gfx::CANVAS_DIMENSIONS,
                                          20,
                                          gfx::STROKE,
                                          1.8f,
                                          gfx::MOVE_TO,
                                          14,
                                          10,
                                          gfx::LINE_TO,
                                          6,
                                          10,
                                          gfx::MOVE_TO,
                                          10,
                                          6,
                                          gfx::LINE_TO,
                                          6,
                                          10,
                                          gfx::LINE_TO,
                                          10,
                                          14};
const gfx::VectorIconRep kBackReps[] = {{kBackPath}};
constexpr gfx::VectorIcon kBackIcon = {kBackReps, 1, "prism-back"};

constexpr gfx::PathElement kForwardPath[] = {gfx::CANVAS_DIMENSIONS,
                                             20,
                                             gfx::STROKE,
                                             1.8f,
                                             gfx::MOVE_TO,
                                             6,
                                             10,
                                             gfx::LINE_TO,
                                             14,
                                             10,
                                             gfx::MOVE_TO,
                                             10,
                                             6,
                                             gfx::LINE_TO,
                                             14,
                                             10,
                                             gfx::LINE_TO,
                                             10,
                                             14};
const gfx::VectorIconRep kForwardReps[] = {{kForwardPath}};
constexpr gfx::VectorIcon kForwardIcon = {kForwardReps, 1, "prism-forward"};

}  // namespace

PrismNavigationButton::PrismNavigationButton(Direction direction,
                                             PressedCallback callback,
                                             BrowserWindowInterface* browser)
    : BackForwardButton(direction, std::move(callback), browser) {
  const gfx::VectorIcon& icon =
      direction == Direction::kBack ? kBackIcon : kForwardIcon;
  SetVectorIcons(icon, icon);
}

PrismNavigationButton::~PrismNavigationButton() = default;

void PrismNavigationButton::PaintButtonContents(gfx::Canvas* canvas) {
  const ui::ColorProvider* colors = GetColorProvider();
  if (!colors || width() < 16 || height() < 16) {
    return;
  }

  const SkColor toolbar = colors->GetColor(kColorToolbar);
  const bool dark = toolbar == SkColorSetRGB(0x2C, 0x39, 0x42);
  const bool light = toolbar == SkColorSetRGB(0xF5, 0xF9, 0xFB);
  if (!dark && !light) {
    return;
  }

  const gfx::RectF capsule(3.5f, 3.0f, width() - 7.0f, height() - 6.0f);
  cc::PaintFlags fill;
  fill.setAntiAlias(true);
  switch (GetState()) {
    case STATE_HOVERED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x48, 0x61, 0x6F)
                         : SkColorSetARGB(0xFF, 0xDF, 0xEB, 0xF0));
      break;
    case STATE_PRESSED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x5C, 0x77, 0x85)
                         : SkColorSetARGB(0xFF, 0xC8, 0xDC, 0xE6));
      break;
    case STATE_NORMAL:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x36, 0x49, 0x54)
                         : SkColorSetARGB(0xFF, 0xEB, 0xF3, 0xF6));
      break;
    case STATE_DISABLED:
      fill.setColor(dark ? SkColorSetARGB(0xFF, 0x31, 0x40, 0x49)
                         : SkColorSetARGB(0xFF, 0xF2, 0xF6, 0xF8));
      break;
    case STATE_COUNT:
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

BEGIN_METADATA(PrismNavigationButton)
END_METADATA
