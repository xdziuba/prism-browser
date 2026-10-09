#ifndef PRISM_AI_PAGE_CONTEXT_H_
#define PRISM_AI_PAGE_CONTEXT_H_

#include <cstdint>
#include <map>
#include <mutex>
#include <string>
#include <unordered_set>
#include <vector>

#include "prism/ai/browser_tools.h"

namespace prism::ai {

// A flattened, browser-supplied accessibility/visible-content node.
struct ContextNode {
  std::uint64_t node_id = 0;
  std::string role;
  std::string label;
  std::string visible_text;
  std::string form_value;
  bool visible = false;
  bool interactive = false;
  bool editable = false;
  bool sensitive = false;
  bool password = false;
};

struct PageContextInput {
  int tab_id = 0;
  std::string origin;
  std::string title;
  std::vector<ContextNode> nodes;
  bool truncated = false;
};

struct SemanticElement {
  ElementRef ref;
  std::string role;
  std::string label;
};

struct PageContextSnapshot {
  int tab_id = 0;
  std::uint64_t snapshot_id = 0;
  std::string origin;
  std::string title;
  std::string visible_text;
  std::vector<SemanticElement> elements;
  bool truncated = false;
};

class PageContextExtractor {
 public:
  PageContextSnapshot Extract(const PageContextInput& input);
  bool IsCurrent(const ElementRef& ref) const;
  void Invalidate(int tab_id);

 private:
  struct SnapshotState {
    std::uint64_t snapshot_id;
    std::unordered_set<std::uint64_t> node_ids;
  };

  mutable std::mutex mutex_;
  std::uint64_t next_snapshot_id_ = 1;
  std::map<int, SnapshotState> current_;
};

PageFindOutput FindInSnapshot(const PageContextSnapshot& snapshot,
                              const std::string& query);

}  // namespace prism::ai

#endif  // PRISM_AI_PAGE_CONTEXT_H_
