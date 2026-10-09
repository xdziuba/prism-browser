#include "prism/ai/chromium_tool_codec.h"

#include <algorithm>
#include <cstdint>
#include <optional>
#include <string>
#include <utility>

#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "prism/ai/page_context.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace prism::ai {
namespace {

constexpr std::size_t kMaxArgumentsBytes = 16384;
constexpr std::size_t kMaxListedTabs = 200;
constexpr std::size_t kMaxElements = 200;
constexpr std::size_t kMaxVisibleTextBytes = 32768;
constexpr std::size_t kMaxFindMatches = 20;

base::Value::Dict Property(const char* type) {
  base::Value::Dict property;
  property.Set("type", type);
  return property;
}

base::Value::Dict Function(const char* name,
                           const char* description,
                           base::Value::Dict properties,
                           base::Value::List required) {
  base::Value::Dict parameters;
  parameters.Set("type", "object");
  parameters.Set("properties", std::move(properties));
  parameters.Set("required", std::move(required));
  parameters.Set("additionalProperties", false);
  base::Value::Dict function;
  function.Set("type", "function");
  function.Set("name", name);
  function.Set("description", description);
  function.Set("strict", true);
  function.Set("parameters", std::move(parameters));
  return function;
}

std::optional<std::string> HttpOrigin(std::string_view raw) {
  const GURL url(raw);
  if (!url.is_valid() || !url.SchemeIsHTTPOrHTTPS()) {
    return std::nullopt;
  }
  return url::Origin::Create(url).Serialize();
}

const char* ReasonName(Reason reason) {
  switch (reason) {
    case Reason::kNone:
      return "none";
    case Reason::kAiDisabled:
      return "ai_disabled";
    case Reason::kIncognito:
      return "incognito";
    case Reason::kCapabilityNotGranted:
      return "capability_not_granted";
    case Reason::kInvalidTarget:
      return "invalid_target";
    case Reason::kRedactionUnavailable:
      return "redaction_unavailable";
    case Reason::kSensitiveTarget:
      return "sensitive_target";
    case Reason::kApprovalRequired:
      return "approval_required";
    case Reason::kUserRejected:
      return "user_rejected";
    case Reason::kStopped:
      return "stopped";
    case Reason::kHostFailure:
      return "host_failure";
    case Reason::kUnknownAction:
      return "unknown_action";
  }
  return "unknown";
}

base::Value::Dict Status(Submission const& submission) {
  base::Value::Dict result;
  switch (submission.state) {
    case ActionState::kCompleted:
      result.Set("status", "completed");
      break;
    case ActionState::kDenied:
      result.Set("status", "denied");
      break;
    case ActionState::kCancelled:
      result.Set("status", "cancelled");
      break;
    case ActionState::kFailed:
      result.Set("status", "failed");
      break;
    default:
      return {};
  }
  result.Set("reason", ReasonName(submission.reason));
  return result;
}

}  // namespace

base::Value::List ChromiumToolCodec::FunctionDefinitions() {
  base::Value::List functions;
  functions.Append(
      Function("browser_tabs_list", "List tabs in this window.", {}, {}));
  {
    base::Value::Dict properties;
    properties.Set("url", Property("string"));
    base::Value::List required;
    required.Append("url");
    functions.Append(Function("browser_tabs_open",
                              "Open an HTTP(S) URL after user approval.",
                              std::move(properties), std::move(required)));
  }
  for (const char* name : {"browser_tabs_close", "browser_tabs_activate",
                           "browser_page_snapshot"}) {
    base::Value::Dict properties;
    properties.Set("tab_id", Property("integer"));
    base::Value::List required;
    required.Append("tab_id");
    functions.Append(Function(name, "Operate on a tab by session tab ID.",
                              std::move(properties), std::move(required)));
  }
  {
    base::Value::Dict properties;
    properties.Set("tab_id", Property("integer"));
    properties.Set("query", Property("string"));
    base::Value::List required;
    required.Append("tab_id");
    required.Append("query");
    functions.Append(Function("browser_page_find",
                              "Find text in a redacted page snapshot.",
                              std::move(properties), std::move(required)));
  }
  return functions;
}

std::optional<ToolCall> ChromiumToolCodec::Decode(
    std::string_view name,
    std::string_view arguments_json) {
  if (arguments_json.size() > kMaxArgumentsBytes) {
    return std::nullopt;
  }
  std::optional<base::Value> parsed =
      base::JSONReader::Read(arguments_json, base::JSON_PARSE_RFC);
  if (!parsed || !parsed->is_dict()) {
    return std::nullopt;
  }
  const base::Value::Dict& arguments = parsed->GetDict();
  std::optional<ToolCall> call;
  if (name == "browser_tabs_list" && arguments.empty()) {
    call = TabsList{};
  } else if (name == "browser_tabs_open" && arguments.size() == 1) {
    if (const std::string* url = arguments.FindString("url")) {
      call = TabsOpen{*url};
    }
  } else if (arguments.size() == 1) {
    const std::optional<int> tab_id = arguments.FindInt("tab_id");
    if (tab_id) {
      if (name == "browser_tabs_close") {
        call = TabsClose{*tab_id};
      } else if (name == "browser_tabs_activate") {
        call = TabsActivate{*tab_id};
      } else if (name == "browser_page_snapshot") {
        call = PageSnapshot{*tab_id};
      }
    }
  } else if (name == "browser_page_find" && arguments.size() == 2) {
    const std::optional<int> tab_id = arguments.FindInt("tab_id");
    const std::string* query = arguments.FindString("query");
    if (tab_id && query) {
      call = PageFind{*tab_id, *query};
    }
  }
  if (!call || !HasValidArguments(*call)) {
    return std::nullopt;
  }
  return call;
}

std::optional<std::string> ChromiumToolCodec::Serialize(
    const Submission& submission) {
  if (submission.ticket || (submission.state != ActionState::kCompleted &&
                            submission.state != ActionState::kDenied &&
                            submission.state != ActionState::kCancelled &&
                            submission.state != ActionState::kFailed)) {
    return std::nullopt;
  }
  base::Value::Dict result = Status(submission);
  if (submission.state != ActionState::kCompleted) {
    return base::WriteJson(base::Value(std::move(result)));
  }
  if (const auto* tabs = std::get_if<TabsListOutput>(&submission.output)) {
    if (tabs->tabs.size() > kMaxListedTabs) {
      return std::nullopt;
    }
    base::Value::List listed;
    for (const TabSummary& tab : tabs->tabs) {
      if (tab.id <= 0) {
        return std::nullopt;
      }
      base::Value::Dict record;
      record.Set("id", tab.id);
      record.Set("active", tab.active);
      if (const auto origin = HttpOrigin(tab.origin)) {
        record.Set("origin", *origin);
      }
      listed.Append(std::move(record));
    }
    result.Set("tabs", std::move(listed));
    result.Set("truncated", tabs->truncated);
  } else if (const auto* ack =
                 std::get_if<ActionAcknowledgement>(&submission.output)) {
    switch (ack->kind) {
      case AcknowledgementKind::kOpenRequested:
        result.Set("action", "open_requested");
        break;
      case AcknowledgementKind::kCloseRequested:
        result.Set("action", "close_requested");
        break;
      case AcknowledgementKind::kActivated:
        result.Set("action", "activated");
        break;
    }
  } else if (const auto* snapshot =
                 std::get_if<std::shared_ptr<const PageContextSnapshot>>(
                     &submission.output)) {
    if (!*snapshot || (*snapshot)->tab_id <= 0 ||
        (*snapshot)->visible_text.size() > kMaxVisibleTextBytes ||
        (*snapshot)->elements.size() > kMaxElements) {
      return std::nullopt;
    }
    result.Set("tab_id", (*snapshot)->tab_id);
    result.Set("snapshot_id", base::NumberToString((*snapshot)->snapshot_id));
    if (const auto origin = HttpOrigin((*snapshot)->origin)) {
      result.Set("origin", *origin);
    }
    result.Set("visible_text", (*snapshot)->visible_text);
    result.Set("truncated", (*snapshot)->truncated);
    base::Value::List elements;
    for (const SemanticElement& element : (*snapshot)->elements) {
      if (element.ref.tab_id != (*snapshot)->tab_id ||
          element.ref.snapshot_id != (*snapshot)->snapshot_id ||
          element.role.size() > 128 || element.label.size() > 512) {
        return std::nullopt;
      }
      base::Value::Dict record;
      record.Set("node_id", base::NumberToString(element.ref.node_id));
      record.Set("role", element.role);
      record.Set("label", element.label);
      elements.Append(std::move(record));
    }
    result.Set("elements", std::move(elements));
  } else if (const auto* found =
                 std::get_if<PageFindOutput>(&submission.output)) {
    if (found->tab_id <= 0 || found->matches.size() > kMaxFindMatches) {
      return std::nullopt;
    }
    result.Set("tab_id", found->tab_id);
    result.Set("snapshot_id", base::NumberToString(found->snapshot_id));
    result.Set("truncated", found->truncated);
    base::Value::List matches;
    for (const PageFindMatch& match : found->matches) {
      if (match.byte_offset > kMaxVisibleTextBytes ||
          match.snippet.size() > 4096) {
        return std::nullopt;
      }
      base::Value::Dict record;
      record.Set("byte_offset", static_cast<int>(match.byte_offset));
      record.Set("snippet", match.snippet);
      matches.Append(std::move(record));
    }
    result.Set("matches", std::move(matches));
  } else {
    return std::nullopt;
  }
  return base::WriteJson(base::Value(std::move(result)));
}

}  // namespace prism::ai
