#include "prism/ai/console_digest.h"

#include <algorithm>

namespace prism::ai {
namespace {

constexpr std::size_t kMaxEvents = 100;

ConsoleCategory Classify(std::u16string_view message) {
  if (message.find(u"TypeError") != message.npos) {
    return ConsoleCategory::kTypeError;
  }
  if (message.find(u"ReferenceError") != message.npos) {
    return ConsoleCategory::kReferenceError;
  }
  if (message.find(u"SyntaxError") != message.npos) {
    return ConsoleCategory::kSyntaxError;
  }
  if (message.find(u"RangeError") != message.npos) {
    return ConsoleCategory::kRangeError;
  }
  if (message.find(u"NetworkError") != message.npos) {
    return ConsoleCategory::kNetworkError;
  }
  return ConsoleCategory::kOther;
}

const char* SeverityName(ConsoleSeverity severity) {
  return severity == ConsoleSeverity::kError ? "error" : "warning";
}

const char* CategoryName(ConsoleCategory category) {
  switch (category) {
    case ConsoleCategory::kTypeError:
      return "TypeError";
    case ConsoleCategory::kReferenceError:
      return "ReferenceError";
    case ConsoleCategory::kSyntaxError:
      return "SyntaxError";
    case ConsoleCategory::kRangeError:
      return "RangeError";
    case ConsoleCategory::kNetworkError:
      return "NetworkError";
    case ConsoleCategory::kOther:
      return "Other";
  }
  return "Other";
}

}  // namespace

ConsoleDigest::ConsoleDigest() = default;
ConsoleDigest::~ConsoleDigest() = default;

void ConsoleDigest::Add(ConsoleSeverity severity,
                        std::u16string_view message,
                        int line) {
  if (events_.size() == kMaxEvents) {
    ++dropped_;
    return;
  }
  events_.push_back(
      {severity, Classify(message), std::clamp(line, 0, 1000000)});
}

std::string ConsoleDigest::FormatForModel() const {
  std::string result =
      "Captured console warnings/errors: " + std::to_string(events_.size()) +
      "\n";
  result += "Dropped after limit: " + std::to_string(dropped_) + "\n";
  for (const ConsoleEventMetadata& event : events_) {
    result += SeverityName(event.severity);
    result += " · ";
    result += CategoryName(event.category);
    result += " · line ";
    result += std::to_string(event.line);
    result += '\n';
  }
  return result;
}

}  // namespace prism::ai
