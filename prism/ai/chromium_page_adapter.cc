#include "prism/ai/chromium_page_adapter.h"

#include <memory>
#include <utility>

#include "base/functional/bind.h"
#include "base/time/time.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "components/sessions/content/session_tab_helper.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/navigation_entry.h"
#include "content/public/browser/web_contents.h"
#include "mojo/public/cpp/bindings/callback_helpers.h"
#include "prism/ai/accessibility_context.h"
#include "ui/accessibility/ax_mode.h"
#include "ui/accessibility/ax_node_data.h"
#include "ui/accessibility/ax_tree_update.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace prism::ai {
namespace {

constexpr std::size_t kMaxSnapshotNodes = 1000;

AccessibilityRole MapRole(ax::mojom::Role role) {
  switch (role) {
    case ax::mojom::Role::kStaticText:
      return AccessibilityRole::kStaticText;
    case ax::mojom::Role::kHeading:
      return AccessibilityRole::kHeading;
    case ax::mojom::Role::kButton:
      return AccessibilityRole::kButton;
    case ax::mojom::Role::kLink:
      return AccessibilityRole::kLink;
    case ax::mojom::Role::kCheckBox:
      return AccessibilityRole::kCheckBox;
    case ax::mojom::Role::kRadioButton:
      return AccessibilityRole::kRadioButton;
    case ax::mojom::Role::kSwitch:
      return AccessibilityRole::kSwitch;
    case ax::mojom::Role::kTextField:
    case ax::mojom::Role::kTextFieldWithComboBox:
    case ax::mojom::Role::kSearchBox:
    case ax::mojom::Role::kSpinButton:
      return AccessibilityRole::kTextField;
    default:
      return AccessibilityRole::kOther;
  }
}

}  // namespace

ChromiumPageAdapter::ChromiumPageAdapter(
    base::WeakPtr<BrowserWindowInterface> browser)
    : browser_(std::move(browser)) {}

ChromiumPageAdapter::~ChromiumPageAdapter() = default;

content::WebContents* ChromiumPageAdapter::FindTab(int tab_id) const {
  if (!browser_ || browser_->IsDeleteScheduled()) {
    return nullptr;
  }
  TabStripModel* tabs = browser_->GetTabStripModel();
  if (!tabs) {
    return nullptr;
  }
  for (int index = 0; index < tabs->count(); ++index) {
    content::WebContents* contents = tabs->GetWebContentsAt(index);
    if (contents &&
        sessions::SessionTabHelper::IdForTab(contents).id() == tab_id) {
      return contents;
    }
  }
  return nullptr;
}

Inspection ChromiumPageAdapter::Inspect(const ToolCall& call) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  Inspection result;
  int tab_id = 0;
  if (const auto* snapshot = std::get_if<PageSnapshot>(&call)) {
    tab_id = snapshot->tab_id;
  } else if (const auto* find = std::get_if<PageFind>(&call)) {
    tab_id = find->tab_id;
  }
  if (tab_id <= 0 || !browser_ || browser_->IsDeleteScheduled()) {
    return result;
  }
  result.incognito = browser_->GetProfile()->IsOffTheRecord();
  if (result.incognito) {
    return result;
  }
  content::WebContents* contents = FindTab(tab_id);
  result.valid = contents &&
                 contents->GetLastCommittedURL().SchemeIsHTTPOrHTTPS() &&
                 contents->GetController().GetLastCommittedEntry();
  result.redaction_ready = result.valid;
  return result;
}

void ChromiumPageAdapter::RequestPageRead(ExecutionTicket ticket,
                                          Completion completion) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (ticket.cancelled->load()) {
    std::move(completion).Run({ExecutionStatus::kCancelled, {}});
    return;
  }
  const Inspection inspection = Inspect(ticket.call);
  if (!inspection.valid || inspection.incognito ||
      !inspection.redaction_ready) {
    std::move(completion).Run({ExecutionStatus::kFailed, {}});
    return;
  }
  const int tab_id = std::holds_alternative<PageSnapshot>(ticket.call)
                         ? std::get<PageSnapshot>(ticket.call).tab_id
                         : std::get<PageFind>(ticket.call).tab_id;
  content::WebContents* contents = FindTab(tab_id);
  if (!contents) {
    std::move(completion).Run({ExecutionStatus::kFailed, {}});
    return;
  }
  const int navigation_entry_id =
      contents->GetController().GetLastCommittedEntry()->GetUniqueID();
  ui::AXTreeUpdate empty_update;
  contents->RequestAXTreeSnapshot(
      mojo::WrapCallbackWithDefaultInvokeIfNotRun(
          base::BindOnce(&ChromiumPageAdapter::OnSnapshot,
                         weak_factory_.GetWeakPtr(), std::move(ticket),
                         contents->GetWeakPtr(), navigation_entry_id,
                         std::move(completion)),
          base::OwnedRef(std::move(empty_update))),
      ui::kAXModeWebContentsOnly, kMaxSnapshotNodes, base::Seconds(3),
      content::WebContents::AXTreeSnapshotPolicy::kSameOriginDirectDescendants);
}

void ChromiumPageAdapter::OnSnapshot(
    ExecutionTicket ticket,
    base::WeakPtr<content::WebContents> contents,
    int navigation_entry_id,
    Completion completion,
    ui::AXTreeUpdate& update) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  if (ticket.cancelled->load()) {
    std::move(completion).Run({ExecutionStatus::kCancelled, {}});
    return;
  }
  const int tab_id = std::holds_alternative<PageSnapshot>(ticket.call)
                         ? std::get<PageSnapshot>(ticket.call).tab_id
                         : std::get<PageFind>(ticket.call).tab_id;
  if (!contents || FindTab(tab_id) != contents.get() ||
      !contents->GetController().GetLastCommittedEntry() ||
      contents->GetController().GetLastCommittedEntry()->GetUniqueID() !=
          navigation_entry_id ||
      update.root_id <= 0 || update.nodes.empty()) {
    std::move(completion).Run({ExecutionStatus::kFailed, {}});
    return;
  }

  AccessibilityTreeInput tree;
  tree.tab_id = tab_id;
  tree.root_id = update.root_id;
  tree.origin =
      url::Origin::Create(contents->GetLastCommittedURL()).Serialize();
  tree.nodes.reserve(update.nodes.size());
  for (const ui::AXNodeData& source : update.nodes) {
    AccessibilityNode node;
    node.id = source.id;
    node.children.assign(source.child_ids.begin(), source.child_ids.end());
    node.role = MapRole(source.role);
    node.hidden = source.HasState(ax::mojom::State::kInvisible);
    node.ignored = source.IsIgnored();
    node.editable = source.HasState(ax::mojom::State::kEditable) ||
                    source.HasState(ax::mojom::State::kRichlyEditable);
    node.protected_field = source.HasState(ax::mojom::State::kProtected);
    if (!node.hidden && !node.ignored && !node.editable &&
        !node.protected_field &&
        (node.role == AccessibilityRole::kStaticText ||
         node.role == AccessibilityRole::kHeading ||
         node.role == AccessibilityRole::kButton ||
         node.role == AccessibilityRole::kLink ||
         node.role == AccessibilityRole::kCheckBox ||
         node.role == AccessibilityRole::kRadioButton ||
         node.role == AccessibilityRole::kSwitch)) {
      node.name = source.GetStringAttribute(ax::mojom::StringAttribute::kName);
    }
    tree.nodes.push_back(std::move(node));
  }
  PageContextInput input = BuildPageContextInput(tree);
  if (input.tab_id == 0 || ticket.cancelled->load()) {
    std::move(completion).Run({ExecutionStatus::kFailed, {}});
    return;
  }
  PageContextSnapshot snapshot = extractor_.Extract(input);
  if (const auto* find = std::get_if<PageFind>(&ticket.call)) {
    std::move(completion)
        .Run({ExecutionStatus::kCompleted,
              FindInSnapshot(snapshot, find->query)});
    return;
  }
  std::move(completion)
      .Run({ExecutionStatus::kCompleted,
            std::make_shared<const PageContextSnapshot>(std::move(snapshot))});
}

void ChromiumPageAdapter::Invalidate(int tab_id) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  extractor_.Invalidate(tab_id);
}

}  // namespace prism::ai
