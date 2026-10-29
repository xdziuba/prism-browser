#ifndef PRISM_UI_NATIVE_PRISM_TAB_AUDIO_ICONS_H_
#define PRISM_UI_NATIVE_PRISM_TAB_AUDIO_ICONS_H_

#include "ui/gfx/vector_icon_types.h"

namespace prism {

inline constexpr gfx::PathElement kTabAudioPlayingPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.6f,
    gfx::MOVE_TO,
    3.6f,
    8.0f,
    gfx::LINE_TO,
    6.3f,
    8.0f,
    gfx::LINE_TO,
    10.0f,
    5.1f,
    gfx::LINE_TO,
    10.0f,
    14.9f,
    gfx::LINE_TO,
    6.3f,
    12.0f,
    gfx::LINE_TO,
    3.6f,
    12.0f,
    gfx::CLOSE,
    gfx::MOVE_TO,
    12.2f,
    7.4f,
    gfx::CUBIC_TO,
    13.5f,
    8.7f,
    13.5f,
    11.3f,
    12.2f,
    12.6f,
    gfx::MOVE_TO,
    14.3f,
    5.4f,
    gfx::CUBIC_TO,
    17.3f,
    8.0f,
    17.3f,
    12.0f,
    14.3f,
    14.6f,
};
inline constexpr gfx::VectorIconRep kTabAudioPlayingReps[] = {
    {kTabAudioPlayingPath}};
inline constexpr gfx::VectorIcon kTabAudioPlayingIcon = {
    kTabAudioPlayingReps, 1, "prism-tab-audio-playing"};

inline constexpr gfx::PathElement kTabAudioMutedPath[] = {
    gfx::CANVAS_DIMENSIONS,
    20,
    gfx::STROKE,
    1.6f,
    gfx::MOVE_TO,
    3.6f,
    8.0f,
    gfx::LINE_TO,
    6.3f,
    8.0f,
    gfx::LINE_TO,
    10.0f,
    5.1f,
    gfx::LINE_TO,
    10.0f,
    14.9f,
    gfx::LINE_TO,
    6.3f,
    12.0f,
    gfx::LINE_TO,
    3.6f,
    12.0f,
    gfx::CLOSE,
    gfx::MOVE_TO,
    12.5f,
    8.0f,
    gfx::LINE_TO,
    16.5f,
    12.0f,
    gfx::MOVE_TO,
    16.5f,
    8.0f,
    gfx::LINE_TO,
    12.5f,
    12.0f,
};
inline constexpr gfx::VectorIconRep kTabAudioMutedReps[] = {
    {kTabAudioMutedPath}};
inline constexpr gfx::VectorIcon kTabAudioMutedIcon = {kTabAudioMutedReps, 1,
                                                       "prism-tab-audio-muted"};

}  // namespace prism

#endif  // PRISM_UI_NATIVE_PRISM_TAB_AUDIO_ICONS_H_
