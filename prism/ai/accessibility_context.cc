#include "prism/ai/accessibility_context.h"

#include <algorithm>
#include <unordered_map>
#include <unordered_set>
#include <utility>

namespace prism::ai {
namespace {

constexpr std::size_t kMaxAxNodes = 1000;
constexpr std::size_t kMaxNameBytes = 4096;

const char* RoleName(AccessibilityRole role) {
  switch (role) {
    case AccessibilityRole::kStaticText:
      return "staticText";
    case AccessibilityRole::kHeading:
      return "heading";
    case AccessibilityRole::kButton:
      return "button";
    case AccessibilityRole::kLink:
      return "link";
    case AccessibilityRole::kCheckBox:
      return "checkbox";
    case AccessibilityRole::kRadioButton:
      return "radio";
    case AccessibilityRole::kSwitch:
      return "switch";
    case AccessibilityRole::kTextField:
      return "textField";
    case AccessibilityRole::kOther:
      return "other";
  }
  return "other";
}

bool IsInteractive(AccessibilityRole role) {
  return role == AccessibilityRole::kButton ||
         role == AccessibilityRole::kLink ||
         role == AccessibilityRole::kCheckBox ||
         role == AccessibilityRole::kRadioButton ||
         role == AccessibilityRole::kSwitch;
}

bool IsVisibleText(AccessibilityRole role) {
  return role == AccessibilityRole::kStaticText ||
         role == AccessibilityRole::kHeading;
}

}  // namespace

PageContextInput BuildPageContextInput(const AccessibilityTreeInput& tree) {
  PageContextInput output;
  if (tree.tab_id <= 0 || tree.root_id <= 0 || tree.nodes.empty()) {
    return output;
  }

  std::unordered_map<std::int64_t, const AccessibilityNode*> by_id;
  for (std::size_t index = 0; index < std::min(tree.nodes.size(), kMaxAxNodes);
       ++index) {
    const AccessibilityNode& node = tree.nodes[index];
    if (node.id <= 0 || !by_id.emplace(node.id, &node).second) {
      return {};
    }
  }
  if (!by_id.contains(tree.root_id)) {
    return output;
  }

  output.tab_id = tree.tab_id;
  output.origin = tree.origin;
  output.truncated = tree.nodes.size() > kMaxAxNodes;
  std::vector<std::int64_t> stack{tree.root_id};
  std::unordered_set<std::int64_t> visited;
  while (!stack.empty()) {
    const std::int64_t id = stack.back();
    stack.pop_back();
    if (!visited.insert(id).second) {
      continue;
    }
    if (visited.size() > kMaxAxNodes) {
      output.truncated = true;
      break;
    }
    const auto found = by_id.find(id);
    if (found == by_id.end()) {
      continue;
    }
    const AccessibilityNode& node = *found->second;
    if (node.hidden || node.ignored || node.editable || node.protected_field ||
        node.role == AccessibilityRole::kTextField) {
      continue;
    }

    if (IsVisibleText(node.role) || IsInteractive(node.role)) {
      ContextNode context;
      context.node_id = static_cast<std::uint64_t>(id);
      context.role = RoleName(node.role);
      context.visible = true;
      context.interactive = IsInteractive(node.role);
      std::size_t name_bytes = std::min(node.name.size(), kMaxNameBytes);
      if (node.name.size() > name_bytes) {
        output.truncated = true;
        while (name_bytes > 0 &&
               (static_cast<unsigned char>(node.name[name_bytes]) & 0xc0) ==
                   0x80) {
          --name_bytes;
        }
      }
      std::string name = node.name.substr(0, name_bytes);
      if (context.interactive) {
        context.label = std::move(name);
      } else {
        context.visible_text = std::move(name);
      }
      output.nodes.push_back(std::move(context));
    }

    const std::size_t child_count = std::min(node.children.size(), kMaxAxNodes);
    output.truncated |= node.children.size() > child_count;
    for (std::size_t index = child_count; index > 0; --index) {
      stack.push_back(node.children[index - 1]);
    }
  }
  return output;
}

}  // namespace prism::ai
