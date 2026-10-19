#ifndef PRISM_UI_NATIVE_PRISM_AI_ACTION_ICON_H_
#define PRISM_UI_NATIVE_PRISM_AI_ACTION_ICON_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

inline constexpr gfx::PathElement kAiActionPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.5f,
    gfx::MOVE_TO,
    10.0f,
    2.5f,
    gfx::LINE_TO,
    17.5f,
    16.5f,
    gfx::LINE_TO,
    2.5f,
    16.5f,
    gfx::CLOSE,
    gfx::MOVE_TO,
    10.0f,
    8.0f,
    gfx::LINE_TO,
    5.5f,
    16.5f,
    gfx::MOVE_TO,
    10.0f,
    8.0f,
    gfx::LINE_TO,
    14.5f,
    16.5f,
};
inline constexpr gfx::VectorIconRep kAiActionReps[] = {{kAiActionPath}};
inline constexpr gfx::VectorIcon kAiActionIcon = {kAiActionReps, 1,
                                                  "prism-ai-action"};

} // namespace prism

#endif // PRISM_UI_NATIVE_PRISM_AI_ACTION_ICON_H_
