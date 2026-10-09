#include "prism/ai/page_context.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <string_view>
#include <utility>

namespace prism::ai {
namespace {

constexpr std::size_t kMaxNodes = 500;
constexpr std::size_t kMaxElements = 200;
constexpr std::size_t kMaxTextBytes = 32768;
constexpr std::size_t kMaxTitleBytes = 512;
constexpr std::size_t kMaxOriginBytes = 2048;

std::string_view BoundedInput(std::string_view text,
                              std::size_t limit,
                              bool& truncated) {
  if (text.size() <= limit) {
    return text;
  }
  std::size_t end = limit;
  while (end > 0 && (static_cast<unsigned char>(text[end]) & 0xc0) == 0x80) {
    --end;
  }
  truncated = true;
  return text.substr(0, end);
}

bool IsTokenChar(char value) {
  const unsigned char ch = static_cast<unsigned char>(value);
  return std::isalnum(ch) || ch == '_' || ch == '-' || ch == '.';
}

bool EqualAsciiInsensitive(char left, char right) {
  return std::tolower(static_cast<unsigned char>(left)) ==
         std::tolower(static_cast<unsigned char>(right));
}

bool StartsWithInsensitive(std::string_view text,
                           std::size_t position,
                           std::string_view prefix) {
  if (position + prefix.size() > text.size()) {
    return false;
  }
  for (std::size_t i = 0; i < prefix.size(); ++i) {
    if (!EqualAsciiInsensitive(text[position + i], prefix[i])) {
      return false;
    }
  }
  return true;
}

bool IsBase64Url(char value) {
  const unsigned char ch = static_cast<unsigned char>(value);
  return std::isalnum(ch) || ch == '_' || ch == '-';
}

std::size_t JwtEnd(std::string_view text, std::size_t start) {
  if (start > 0 && IsTokenChar(text[start - 1])) {
    return start;
  }
  std::size_t cursor = start;
  for (int part = 0; part < 3; ++part) {
    const std::size_t segment_start = cursor;
    while (cursor < text.size() && IsBase64Url(text[cursor])) {
      ++cursor;
    }
    if (cursor - segment_start < 8) {
      return start;
    }
    if (part != 2) {
      if (cursor >= text.size() || text[cursor] != '.') {
        return start;
      }
      ++cursor;
    }
  }
  if (cursor < text.size() && IsTokenChar(text[cursor])) {
    return start;
  }
  return cursor;
}

std::string RedactInline(std::string_view text) {
  constexpr std::array<std::string_view, 5> kSecretKeys = {
      "session_token", "access_token", "api_key", "sessionid", "jwt"};
  std::string result;
  result.reserve(text.size());
  for (std::size_t i = 0; i < text.size();) {
    if ((i == 0 || !IsTokenChar(text[i - 1])) &&
        StartsWithInsensitive(text, i, "bearer ")) {
      result.append("Bearer [redacted]");
      i += 7;
      while (i < text.size() &&
             !std::isspace(static_cast<unsigned char>(text[i])) &&
             text[i] != '"' && text[i] != '\'') {
        ++i;
      }
      continue;
    }
    bool replaced = false;
    for (std::string_view key : kSecretKeys) {
      if ((i != 0 && IsTokenChar(text[i - 1])) ||
          !StartsWithInsensitive(text, i, key)) {
        continue;
      }
      const std::size_t separator = i + key.size();
      if (separator >= text.size() ||
          (text[separator] != '=' && text[separator] != ':')) {
        continue;
      }
      result.append(text.substr(i, key.size() + 1));
      result.append("[redacted]");
      i = separator + 1;
      while (i < text.size() &&
             !std::isspace(static_cast<unsigned char>(text[i])) &&
             text[i] != '&' && text[i] != '"' && text[i] != '\'') {
        ++i;
      }
      replaced = true;
      break;
    }
    if (replaced) {
      continue;
    }
    const std::size_t jwt_end = JwtEnd(text, i);
    if (jwt_end != i) {
      result.append("[redacted token]");
      i = jwt_end;
      continue;
    }
    result.push_back(text[i]);
    ++i;
  }
  return result;
}

std::string RedactKnownSecrets(std::string_view text) {
  constexpr std::array<std::string_view, 4> kHeaders = {
      "authorization:", "proxy-authorization:", "cookie:", "set-cookie:"};
  std::string result;
  for (std::size_t start = 0; start < text.size();) {
    const std::size_t end = text.find('\n', start);
    const std::size_t line_end =
        end == std::string_view::npos ? text.size() : end;
    std::string_view line = text.substr(start, line_end - start);
    std::size_t first = 0;
    while (first < line.size() &&
           std::isspace(static_cast<unsigned char>(line[first]))) {
      ++first;
    }
    bool header = false;
    for (std::string_view prefix : kHeaders) {
      header |= StartsWithInsensitive(line, first, prefix);
    }
    result.append(header ? "[redacted header]" : RedactInline(line));
    if (end == std::string_view::npos) {
      break;
    }
    result.push_back('\n');
    start = end + 1;
  }
  return result;
}

void AppendLimited(std::string& output,
                   std::string_view text,
                   std::size_t limit,
                   bool& truncated) {
  if (output.size() >= limit) {
    truncated |= !text.empty();
    return;
  }
  const std::size_t available = limit - output.size();
  if (text.size() <= available) {
    output.append(text);
    return;
  }
  std::size_t end = available;
  while (end > 0 && end < text.size() &&
         (static_cast<unsigned char>(text[end]) & 0xc0) == 0x80) {
    --end;
  }
  output.append(text.substr(0, end));
  truncated = true;
}

}  // namespace

PageContextExtractor::PageContextExtractor() = default;
PageContextExtractor::~PageContextExtractor() = default;

PageContextSnapshot PageContextExtractor::Extract(
    const PageContextInput& input) {
  PageContextSnapshot output;
  if (input.tab_id <= 0) {
    return output;
  }
  output.truncated = input.truncated;
  std::lock_guard lock(mutex_);
  output.tab_id = input.tab_id;
  output.snapshot_id = next_snapshot_id_++;
  SnapshotState current{output.snapshot_id, {}};
  AppendLimited(
      output.origin,
      RedactKnownSecrets(BoundedInput(input.origin, 4096, output.truncated)),
      kMaxOriginBytes, output.truncated);
  AppendLimited(
      output.title,
      RedactKnownSecrets(BoundedInput(input.title, 1024, output.truncated)),
      kMaxTitleBytes, output.truncated);

  std::size_t visited = 0;
  for (const ContextNode& node : input.nodes) {
    if (visited++ >= kMaxNodes) {
      output.truncated = true;
      break;
    }
    if (!node.visible || node.sensitive || node.password || node.node_id == 0) {
      continue;
    }
    if (!node.editable && !node.visible_text.empty()) {
      if (!output.visible_text.empty()) {
        AppendLimited(output.visible_text, "\n", kMaxTextBytes,
                      output.truncated);
      }
      AppendLimited(output.visible_text,
                    RedactKnownSecrets(BoundedInput(node.visible_text, 65536,
                                                    output.truncated)),
                    kMaxTextBytes, output.truncated);
    }
    if (!node.interactive || current.node_ids.contains(node.node_id)) {
      continue;
    }
    if (output.elements.size() >= kMaxElements) {
      output.truncated = true;
      continue;
    }
    current.node_ids.insert(node.node_id);
    std::string role;
    std::string label;
    AppendLimited(
        role,
        RedactKnownSecrets(BoundedInput(node.role, 256, output.truncated)), 128,
        output.truncated);
    AppendLimited(
        label,
        RedactKnownSecrets(BoundedInput(node.label, 1024, output.truncated)),
        512, output.truncated);
    output.elements.push_back({{input.tab_id, output.snapshot_id, node.node_id},
                               std::move(role),
                               std::move(label)});
  }
  current_[input.tab_id] = std::move(current);
  return output;
}

bool PageContextExtractor::IsCurrent(const ElementRef& ref) const {
  std::lock_guard lock(mutex_);
  const auto it = current_.find(ref.tab_id);
  return it != current_.end() && it->second.snapshot_id == ref.snapshot_id &&
         it->second.node_ids.contains(ref.node_id);
}

void PageContextExtractor::Invalidate(int tab_id) {
  std::lock_guard lock(mutex_);
  current_.erase(tab_id);
}

PageFindOutput FindInSnapshot(const PageContextSnapshot& snapshot,
                              const std::string& query) {
  PageFindOutput output;
  output.tab_id = snapshot.tab_id;
  output.snapshot_id = snapshot.snapshot_id;
  output.truncated = snapshot.truncated;
  if (query.empty()) {
    return output;
  }
  constexpr std::size_t kMaxMatches = 20;
  constexpr std::size_t kContextBytes = 40;
  constexpr std::size_t kMaxMatchBytes = 128;
  std::size_t cursor = 0;
  while ((cursor = snapshot.visible_text.find(query, cursor)) !=
         std::string::npos) {
    if (output.matches.size() >= kMaxMatches) {
      output.truncated = true;
      break;
    }
    std::size_t start = cursor > kContextBytes ? cursor - kContextBytes : 0;
    while (start < cursor &&
           (static_cast<unsigned char>(snapshot.visible_text[start]) & 0xc0) ==
               0x80) {
      ++start;
    }
    std::size_t end = std::min(
        snapshot.visible_text.size(),
        cursor + std::min(query.size(), kMaxMatchBytes) + kContextBytes);
    while (end > cursor && end < snapshot.visible_text.size() &&
           (static_cast<unsigned char>(snapshot.visible_text[end]) & 0xc0) ==
               0x80) {
      --end;
    }
    output.matches.push_back(
        {cursor, snapshot.visible_text.substr(start, end - start)});
    cursor += query.size();
  }
  return output;
}

}  // namespace prism::ai
