#ifndef PRISM_AI_ACCESSIBILITY_CONTEXT_H_
#define PRISM_AI_ACCESSIBILITY_CONTEXT_H_

#include <cstdint>
#include <string>
#include <vector>

#include "prism/ai/page_context.h"

namespace prism::ai {

enum class AccessibilityRole {
  kOther,
  kStaticText,
  kHeading,
  kButton,
  kLink,
  kCheckBox,
  kRadioButton,
  kSwitch,
  kTextField,
};

struct AccessibilityNode {
  std::int64_t id = 0;
  std::vector<std::int64_t> children;
  AccessibilityRole role = AccessibilityRole::kOther;
  std::string name;
  bool hidden = false;
  bool ignored = false;
  bool editable = false;
  bool protected_field = false;
};

struct AccessibilityTreeInput {
  int tab_id = 0;
  std::int64_t root_id = 0;
  std::string origin;
  std::vector<AccessibilityNode> nodes;
};

// Converts a root-linked, browser-supplied AX tree into the narrow input
// accepted by PageContextExtractor. Unreachable and sensitive nodes are
// dropped.
PageContextInput BuildPageContextInput(const AccessibilityTreeInput& tree);

}  // namespace prism::ai

#endif  // PRISM_AI_ACCESSIBILITY_CONTEXT_H_
