#ifndef PRISM_AI_CONSOLE_DIGEST_H_
#define PRISM_AI_CONSOLE_DIGEST_H_

#include <cstddef>
#include <string>
#include <string_view>
#include <vector>

namespace prism::ai {

enum class ConsoleSeverity { kWarning, kError };
enum class ConsoleCategory {
  kTypeError,
  kReferenceError,
  kSyntaxError,
  kRangeError,
  kNetworkError,
  kOther,
};

struct ConsoleEventMetadata {
  ConsoleSeverity severity;
  ConsoleCategory category;
  int line;
};

// Contains fixed labels and line numbers only. Raw console strings never enter
// retained state or the model prompt.
class ConsoleDigest {
 public:
  ConsoleDigest();
  ~ConsoleDigest();

  void Add(ConsoleSeverity severity, std::u16string_view message, int line);
  const std::vector<ConsoleEventMetadata>& events() const { return events_; }
  std::size_t dropped() const { return dropped_; }
  std::string FormatForModel() const;

 private:
  std::vector<ConsoleEventMetadata> events_;
  std::size_t dropped_ = 0;
};

}  // namespace prism::ai

#endif  // PRISM_AI_CONSOLE_DIGEST_H_
