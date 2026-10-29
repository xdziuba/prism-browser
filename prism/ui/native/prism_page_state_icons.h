#ifndef PRISM_UI_NATIVE_PRISM_PAGE_STATE_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_PAGE_STATE_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

// A restrained alert mark for Chromium's WARNING page-security level.
inline constexpr gfx::PathElement kPageWarningPath[] = {gfx::CANVAS_DIMENSIONS,
                                                        20,
                                                        gfx::STROKE,
                                                        1.65f,
                                                        gfx::MOVE_TO,
                                                        10.0f,
                                                        3.1f,
                                                        gfx::LINE_TO,
                                                        17.4f,
                                                        16.2f,
                                                        gfx::LINE_TO,
                                                        2.6f,
                                                        16.2f,
                                                        gfx::CLOSE,
                                                        gfx::MOVE_TO,
                                                        10.0f,
                                                        7.7f,
                                                        gfx::LINE_TO,
                                                        10.0f,
                                                        11.5f,
                                                        gfx::CIRCLE,
                                                        10.0f,
                                                        13.8f,
                                                        0.65f};
inline constexpr gfx::VectorIconRep kPageWarningReps[] = {{kPageWarningPath}};
inline constexpr gfx::VectorIcon kPageWarningIcon = {kPageWarningReps, 1,
                                                     "prism-page-warning"};

}  // namespace prism

#endif  // PRISM_UI_NATIVE_PRISM_PAGE_STATE_ICONS_H_
