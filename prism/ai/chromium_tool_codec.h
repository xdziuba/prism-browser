#ifndef PRISM_AI_CHROMIUM_TOOL_CODEC_H_
#define PRISM_AI_CHROMIUM_TOOL_CODEC_H_

#include <optional>
#include <string>
#include <string_view>

#include "base/values.h"
#include "prism/ai/browser_tools.h"

namespace prism::ai {

// Browser-process boundary between untrusted model JSON and typed tool calls.
class ChromiumToolCodec {
 public:
  static base::Value::List FunctionDefinitions();
  static std::optional<ToolCall> Decode(std::string_view name,
                                        std::string_view arguments_json);
  static std::optional<std::string> Serialize(const Submission& submission);
};

}  // namespace prism::ai

#endif  // PRISM_AI_CHROMIUM_TOOL_CODEC_H_
