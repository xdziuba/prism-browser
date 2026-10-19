#ifndef PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

inline constexpr gfx::PathElement kSidePanelPinPath[] = {gfx::CANVAS_DIMENSIONS,
                                                         20,
                                                         gfx::STROKE,
                                                         1.6f,
                                                         gfx::MOVE_TO,
                                                         7.0f,
                                                         3.0f,
                                                         gfx::LINE_TO,
                                                         13.0f,
                                                         3.0f,
                                                         gfx::LINE_TO,
                                                         12.0f,
                                                         7.0f,
                                                         gfx::LINE_TO,
                                                         14.5f,
                                                         10.0f,
                                                         gfx::LINE_TO,
                                                         5.5f,
                                                         10.0f,
                                                         gfx::LINE_TO,
                                                         8.0f,
                                                         7.0f,
                                                         gfx::CLOSE,
                                                         gfx::MOVE_TO,
                                                         10.0f,
                                                         10.0f,
                                                         gfx::LINE_TO,
                                                         10.0f,
                                                         18.0f};
inline constexpr gfx::VectorIconRep kSidePanelPinReps[] = {{kSidePanelPinPath}};
inline constexpr gfx::VectorIcon kSidePanelPinIcon = {kSidePanelPinReps, 1,
                                                      "prism-side-panel-pin"};

inline constexpr gfx::PathElement kSidePanelUnpinPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.6f,
    gfx::MOVE_TO,
    7.0f,
    3.0f,
    gfx::LINE_TO,
    13.0f,
    3.0f,
    gfx::LINE_TO,
    12.0f,
    7.0f,
    gfx::LINE_TO,
    14.5f,
    10.0f,
    gfx::LINE_TO,
    5.5f,
    10.0f,
    gfx::LINE_TO,
    8.0f,
    7.0f,
    gfx::CLOSE,
    gfx::MOVE_TO,
    10.0f,
    10.0f,
    gfx::LINE_TO,
    10.0f,
    18.0f,
    gfx::MOVE_TO,
    3.5f,
    3.5f,
    gfx::LINE_TO,
    16.5f,
    16.5f};
inline constexpr gfx::VectorIconRep kSidePanelUnpinReps[] = {
    {kSidePanelUnpinPath}};
inline constexpr gfx::VectorIcon kSidePanelUnpinIcon = {
    kSidePanelUnpinReps, 1, "prism-side-panel-unpin"};

inline constexpr gfx::PathElement kSidePanelClosePath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.6f,
    gfx::MOVE_TO,
    5.0f,
    5.0f,
    gfx::LINE_TO,
    15.0f,
    15.0f,
    gfx::MOVE_TO,
    15.0f,
    5.0f,
    gfx::LINE_TO,
    5.0f,
    15.0f};
inline constexpr gfx::VectorIconRep kSidePanelCloseReps[] = {
    {kSidePanelClosePath}};
inline constexpr gfx::VectorIcon kSidePanelCloseIcon = {
    kSidePanelCloseReps, 1, "prism-side-panel-close"};

} // namespace prism

#endif // PRISM_UI_NATIVE_PRISM_SIDE_PANEL_HEADER_ICONS_H_
