#include "prism/ai/console_digest.h"

#include <cassert>
#include <string>

int main() {
  prism::ai::ConsoleDigest digest;
  digest.Add(
      prism::ai::ConsoleSeverity::kError,
      u"TypeError: secret sk-test-never-send Authorization: Bearer token", 42);
  digest.Add(prism::ai::ConsoleSeverity::kWarning, u"Cookie: password=hunter2",
             -15);
  const std::string output = digest.FormatForModel();
  assert(output.find("TypeError") != std::string::npos);
  assert(output.find("warning") != std::string::npos);
  assert(output.find("line 42") != std::string::npos);
  assert(output.find("line 0") != std::string::npos);
  assert(output.find("sk-test") == std::string::npos);
  assert(output.find("hunter2") == std::string::npos);
  assert(output.find("Bearer") == std::string::npos);
  for (int i = 0; i < 110; ++i) {
    digest.Add(prism::ai::ConsoleSeverity::kError, u"secret", i);
  }
  assert(digest.events().size() == 100);
  assert(digest.dropped() == 12);
  assert(digest.FormatForModel().find("Dropped after limit: 12") !=
         std::string::npos);
}
