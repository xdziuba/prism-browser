#ifndef PRISM_UI_NATIVE_PRISM_BOOKMARK_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_BOOKMARK_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

inline constexpr gfx::PathElement kBookmarkOutlinePath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.65f,
    gfx::MOVE_TO,
    10.0f,
    2.7f,
    gfx::LINE_TO,
    12.25f,
    7.3f,
    gfx::LINE_TO,
    17.35f,
    8.05f,
    gfx::LINE_TO,
    13.65f,
    11.7f,
    gfx::LINE_TO,
    14.55f,
    16.9f,
    gfx::LINE_TO,
    10.0f,
    14.45f,
    gfx::LINE_TO,
    5.45f,
    16.9f,
    gfx::LINE_TO,
    6.35f,
    11.7f,
    gfx::LINE_TO,
    2.65f,
    8.05f,
    gfx::LINE_TO,
    7.75f,
    7.3f,
    gfx::CLOSE};
inline constexpr gfx::VectorIconRep kBookmarkOutlineReps[] = {
    {kBookmarkOutlinePath}};
inline constexpr gfx::VectorIcon kBookmarkOutlineIcon = {
    kBookmarkOutlineReps, 1, "prism-bookmark-outline"};

inline constexpr gfx::PathElement kBookmarkFilledPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::MOVE_TO,
    10.0f,
    2.7f,
    gfx::LINE_TO,
    12.25f,
    7.3f,
    gfx::LINE_TO,
    17.35f,
    8.05f,
    gfx::LINE_TO,
    13.65f,
    11.7f,
    gfx::LINE_TO,
    14.55f,
    16.9f,
    gfx::LINE_TO,
    10.0f,
    14.45f,
    gfx::LINE_TO,
    5.45f,
    16.9f,
    gfx::LINE_TO,
    6.35f,
    11.7f,
    gfx::LINE_TO,
    2.65f,
    8.05f,
    gfx::LINE_TO,
    7.75f,
    7.3f,
    gfx::CLOSE};
inline constexpr gfx::VectorIconRep kBookmarkFilledReps[] = {
    {kBookmarkFilledPath}};
inline constexpr gfx::VectorIcon kBookmarkFilledIcon = {
    kBookmarkFilledReps, 1, "prism-bookmark-filled"};

}  // namespace prism

#endif  // PRISM_UI_NATIVE_PRISM_BOOKMARK_ICONS_H_
