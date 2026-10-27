#ifndef PRISM_UI_NATIVE_PRISM_TOOLBAR_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_TOOLBAR_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

inline constexpr gfx::PathElement kPrismBackPath[] = {gfx::CANVAS_DIMENSIONS,
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
inline const gfx::VectorIconRep kPrismBackReps[] = {{kPrismBackPath}};
inline constexpr gfx::VectorIcon kPrismBackIcon = {kPrismBackReps, 1,
                                                   "prism-back"};

inline constexpr gfx::PathElement kPrismForwardPath[] = {gfx::CANVAS_DIMENSIONS,
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
inline const gfx::VectorIconRep kPrismForwardReps[] = {{kPrismForwardPath}};
inline constexpr gfx::VectorIcon kPrismForwardIcon = {kPrismForwardReps, 1,
                                                      "prism-forward"};

inline constexpr gfx::PathElement kPrismHomePath[] = {gfx::CANVAS_DIMENSIONS,
                                                      20,
                                                      gfx::STROKE,
                                                      1.8f,
                                                      gfx::MOVE_TO,
                                                      3.8f,
                                                      9.0f,
                                                      gfx::LINE_TO,
                                                      10.0f,
                                                      4.0f,
                                                      gfx::LINE_TO,
                                                      16.2f,
                                                      9.0f,
                                                      gfx::MOVE_TO,
                                                      5.5f,
                                                      8.0f,
                                                      gfx::LINE_TO,
                                                      5.5f,
                                                      15.5f,
                                                      gfx::LINE_TO,
                                                      14.5f,
                                                      15.5f,
                                                      gfx::LINE_TO,
                                                      14.5f,
                                                      8.0f,
                                                      gfx::MOVE_TO,
                                                      8.5f,
                                                      15.5f,
                                                      gfx::LINE_TO,
                                                      8.5f,
                                                      11.0f,
                                                      gfx::LINE_TO,
                                                      11.5f,
                                                      11.0f,
                                                      gfx::LINE_TO,
                                                      11.5f,
                                                      15.5f};
inline const gfx::VectorIconRep kPrismHomeReps[] = {{kPrismHomePath}};
inline constexpr gfx::VectorIcon kPrismHomeIcon = {kPrismHomeReps, 1,
                                                   "prism-home"};

#endif // PRISM_UI_NATIVE_PRISM_TOOLBAR_ICONS_H_
