#ifndef PRISM_UI_NATIVE_PRISM_OMNIBOX_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_OMNIBOX_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

// A compact, open cross sized for the omnibox's existing clear action.
inline constexpr gfx::PathElement kOmniboxClearPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.65f,
    gfx::MOVE_TO,
    4.5f,
    4.5f,
    gfx::LINE_TO,
    15.5f,
    15.5f,
    gfx::MOVE_TO,
    15.5f,
    4.5f,
    gfx::LINE_TO,
    4.5f,
    15.5f};
inline constexpr gfx::VectorIconRep kOmniboxClearReps[] = {
    {kOmniboxClearPath}};
inline constexpr gfx::VectorIcon kOmniboxClearIcon = {
    kOmniboxClearReps, 1, "prism-omnibox-clear"};

}  // namespace prism

#endif  // PRISM_UI_NATIVE_PRISM_OMNIBOX_ICONS_H_
